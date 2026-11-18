import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Image as ImageIcon,
  Italic, Sparkles, Underline
} from 'lucide-react';
import { FONT_FAMILIES, mediaStreamUrl } from './shared';

export function isRichHtml(val) {
  return typeof val === 'string' && /<[a-z][\s\S]*>/i.test(val);
}

export function stripRichHtml(val) {
  if (!val) return '';
  return String(val)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeBroadcastHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

const FONT_SIZE_OPTIONS = [14, 18, 22, 26, 30, 36, 44, 54, 64];

let _cachedFonts = null;
let _fontsPromise = null;

export function useAvailableFonts(systemFontsProp = null) {
  const [fontsData, setFontsData] = useState(systemFontsProp || _cachedFonts);
  useEffect(() => {
    if (systemFontsProp) {
      _cachedFonts = systemFontsProp;
      setFontsData(systemFontsProp);
      return;
    }
    if (_cachedFonts) {
      setFontsData(_cachedFonts);
      return;
    }
    if (!_fontsPromise) {
      _fontsPromise = fetch('/api/system/fonts')
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    let active = true;
    _fontsPromise.then(res => {
      if (res) {
        _cachedFonts = res;
        if (active) setFontsData(res);
      }
    });
    return () => { active = false; };
  }, [systemFontsProp]);
  return fontsData;
}

export function RichBroadcastEditor({
  value = '',
  onChange,
  mediaList = [],
  systemFonts = null,
  placeholder = 'Type broadcast headline, breaking strap, or ticker copy...',
  minHeight = 82,
  compact = false
}) {
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const isInternalRef = useRef(false);
  const [showImgMenu, setShowImgMenu] = useState(false);
  const [customImgUrl, setCustomImgUrl] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#e11d72');
  const fontsInfo = useAvailableFonts(systemFonts);
  const projectFonts = fontsInfo?.project_fonts || [];
  const installedFonts = fontsInfo?.system_fonts || [];

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (isInternalRef.current) {
      isInternalRef.current = false;
      return;
    }
    const sanitized = sanitizeBroadcastHtml(value || '');
    if (el.innerHTML !== sanitized) {
      el.innerHTML = sanitized;
    }
  }, [value]);

  const saveSelection = () => {
    const sel = window.getSelection();
    const el = editorRef.current;
    if (!sel || !el || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRangeRef.current && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      } catch {}
    }
  };

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    isInternalRef.current = true;
    const html = sanitizeBroadcastHtml(el.innerHTML);
    onChange?.(html, stripRichHtml(html));
  };

  const exec = (cmd, arg = null) => {
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {}
    document.execCommand(cmd, false, arg);
    saveSelection();
    emitChange();
  };

  const applyFontSize = (px) => {
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
    } else {
      exec('fontSize', '4');
    }
    emitChange();
  };

  const insertInlineImage = (src, alt = 'Logo') => {
    if (!src) return;
    restoreSelection();
    const imgHtml = `<img src="${src.replace(/"/g, '&quot;')}" alt="${alt.replace(/"/g, '&quot;')}" style="height:1.25em;max-height:28px;width:auto;vertical-align:middle;object-fit:contain;margin:0 6px;display:inline-block;" />`;
    document.execCommand('insertHTML', false, imgHtml);
    setShowImgMenu(false);
    setCustomImgUrl('');
    saveSelection();
    emitChange();
  };

  const handleUploadImageFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        // Auto-resize uploaded inline/ticker image to crisp broadcast height (max 64px)
        const maxH = 64;
        const scale = img.height > maxH ? maxH / img.height : 1;
        const w = Math.max(16, Math.round(img.width * scale));
        const h = Math.max(16, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        insertInlineImage(canvas.toDataURL('image/png'), file.name.replace(/\.[^.]+$/, ''));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const insertToken = (token) => {
    restoreSelection();
    document.execCommand('insertText', false, ` ${token} `);
    saveSelection();
    emitChange();
  };

  const imageAssets = (mediaList || []).filter(m =>
    (m.mime || '').startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(m.filename || '')
  );

  return (
    <div className="kx-rich-editor">
      <div className="kx-rich-toolbar">
        <select
          className="kx-rich-select"
          defaultValue=""
          onChange={(e) => { if (e.target.value) exec('fontName', e.target.value); e.target.value = ''; }}
          title="Font Family (Broadcast, Project Folders & System Fonts)"
        >
          <option value="" disabled>Font</option>
          <optgroup label="Broadcast Fonts">
            {FONT_FAMILIES.map(f => (
              <option key={f} value={f.split(',')[0].trim()}>{f.split(',')[0]}</option>
            ))}
          </optgroup>
          {projectFonts.length > 0 && (
            <optgroup label="Project Font Folders">
              {projectFonts.map(pf => (
                <option key={`pf-${pf.family}-${pf.file}`} value={pf.family}>{pf.family} ({pf.folder})</option>
              ))}
            </optgroup>
          )}
          {installedFonts.length > 0 && (
            <optgroup label={`Installed System Fonts (${installedFonts.length})`}>
              {installedFonts.map(sf => (
                <option key={`sf-${sf}`} value={sf}>{sf}</option>
              ))}
            </optgroup>
          )}
        </select>

        <select
          className="kx-rich-select size"
          defaultValue=""
          onChange={(e) => { if (e.target.value) applyFontSize(Number(e.target.value)); e.target.value = ''; }}
          title="Font Size (px)"
        >
          <option value="" disabled>Size</option>
          {FONT_SIZE_OPTIONS.map(s => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>

        <button type="button" className="kx-rich-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} title="Bold"><Bold size={12} /></button>
        <button type="button" className="kx-rich-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} title="Italic"><Italic size={12} /></button>
        <button type="button" className="kx-rich-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} title="Underline"><Underline size={12} /></button>

        <label className="kx-rich-color" title="Text Color">
          <span>A</span>
          <input
            type="color"
            value={textColor}
            onChange={(e) => { setTextColor(e.target.value); exec('foreColor', e.target.value); }}
          />
        </label>

        <label className="kx-rich-color bg" title="Highlight / Badge Color">
          <span>BG</span>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => { setBgColor(e.target.value); exec('hiliteColor', e.target.value); }}
          />
        </label>

        <button type="button" className="kx-rich-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('justifyLeft')} title="Align Left"><AlignLeft size={12} /></button>
        <button type="button" className="kx-rich-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('justifyCenter')} title="Align Center"><AlignCenter size={12} /></button>
        <button type="button" className="kx-rich-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('justifyRight')} title="Align Right"><AlignRight size={12} /></button>

        <button type="button" className="kx-rich-btn" onMouseDown={e => e.preventDefault()} onClick={() => insertToken('•')} title="Insert Ticker Dot">•</button>
        <button type="button" className="kx-rich-btn" onMouseDown={e => e.preventDefault()} onClick={() => insertToken('◆')} title="Insert Ticker Diamond">◆</button>

        <div className="kx-rich-img-wrap">
          <button
            type="button"
            className="kx-rich-btn img-btn"
            onMouseDown={e => { e.preventDefault(); saveSelection(); }}
            onClick={() => setShowImgMenu(!showImgMenu)}
            title="Insert or Upload Inline Logo / Separator Image (Auto-Resized)"
          >
            <ImageIcon size={12} /> Logo/Img
          </button>
          {showImgMenu && (
            <div className="kx-rich-img-pop">
              <label className="kx-rich-pop-item" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={12} /> Upload Image (Auto-Resize)
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadImageFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {imageAssets.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className="kx-rich-pop-item"
                  onClick={() => insertInlineImage(mediaStreamUrl(m.id), m.title)}
                >
                  <ImageIcon size={12} /> {m.title}
                </button>
              ))}
              <div className="kx-rich-pop-url">
                <input
                  value={customImgUrl}
                  onChange={e => setCustomImgUrl(e.target.value)}
                  placeholder="https://... or /media/..."
                />
                <button type="button" onClick={() => insertInlineImage(customImgUrl, 'Badge')}>Add</button>
              </div>
            </div>
          )}
        </div>

        <button type="button" className="kx-rich-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('removeFormat')} title="Clear Formatting">
          <Eraser size={12} />
        </button>
      </div>

      <div
        ref={editorRef}
        className="kx-rich-surface"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={{ minHeight }}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onSelect={saveSelection}
        onInput={() => { saveSelection(); emitChange(); }}
        onBlur={() => { saveSelection(); emitChange(); }}
      />
    </div>
  );
}

