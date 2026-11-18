import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  CheckCircle2, CheckSquare, ChevronDown, ChevronRight, ClipboardPaste, Clock,
  Copy, Edit3, Eye, EyeOff, Film, Grid, Image as ImageIcon, Layers, Lock, Maximize2,
  Move, Palette, Pause, Play, Plus, Radio, Redo2, RefreshCw, RotateCcw, Save, Scissors,
  Search, Sliders, Sparkles, Square, Trash2, Type, Undo2, Unlock, Zap
} from 'lucide-react';
import {
  ALL_KEYS, ALL_LABELS, ANIMATIONS, B, FONT_FAMILIES, Field, GRADIENT_PRESETS,
  Pill, RES_PRESETS, clock, fmt, localForInput, asKtmIso, mediaThumbUrl
} from './shared';
import { LiveVideoSurface, renderCgOverlayBox } from './MonitorStage';
import { AnimatedBroadcastText } from './CgDemoOverlays';
import { RichBroadcastEditor, isRichHtml, sanitizeBroadcastHtml, useAvailableFonts } from './RichBroadcastEditor';

const CATALOG_GROUPS = [
  { id: 'hebron', label: 'HEBRON TV CHANNEL DEMO', cats: ['hebron_logo', 'hebron_breaking', 'hebron_flash', 'hebron_crawl', 'hebron_ticker'] },
  { id: 'branding', label: 'BRANDING & ANIMATED BUGS', cats: ['logo', 'logo_anim', 'live_anim', 'sponsor', 'sponsored_by', 'clock', 'live_location'] },
  { id: 'newsroom', label: 'BREAKING & FLASH NEWS OVERLAYS', cats: ['flash_premium', 'breaking', 'flash', 'breaking_full', 'breaking_split', 'breaking_3win', 'update', 'headline', 'fullscreen_alert'] },
  { id: 'tickers', label: 'TICKERS, CRAWLS & WEATHER', cats: ['ticker', 'crawl', 'weather_map'] },
  { id: 'lower_thirds', label: 'LOWER THIRDS & STRAPS', cats: ['lower_third', 'name_strap', 'quote'] },
  { id: 'music_pack', label: 'MUSIC TV PACK', cats: ['music_now', 'music_credits'] },
  { id: 'programme', label: 'PROGRAMME & PROMOS', cats: ['now_next', 'program_info', 'promo'] }
];

/**
 * Palette of primitive & broadcast CG Item types for building multi-track compositions
 * (matches Screenshot 2 "CREATE CG ITEMS" & Screenshot 3 "LAYERS - SELECTED CG").
 */
const CG_ELEMENT_TYPES = [
  { type: 'Text', label: 'TEXT', color: '#38bdf8', defaultW: 620, defaultH: 64, defaultText: 'BROADCAST HEADLINE TEXT' },
  { type: 'Shape', label: 'SHAPE', color: '#a855f7', defaultW: 720, defaultH: 110, defaultText: '' },
  { type: 'Image', label: 'IMAGE', color: '#10b981', defaultW: 220, defaultH: 120, defaultText: 'GRAPHIC IMAGE' },
  { type: 'PNG Sequence', label: 'PNG SEQUENCE', color: '#ec4899', defaultW: 240, defaultH: 150, defaultText: '25 FPS PNG SEQ' },
  { type: 'Ticker', label: 'TICKER', color: '#f59e0b', defaultW: 1920, defaultH: 52, defaultText: 'LIVE BROADCAST TICKER STREAM • BREAKING UPDATES' },
  { type: 'Timer', label: 'TIMER / CLOCK', color: '#06b6d4', defaultW: 280, defaultH: 58, defaultText: '00:00:00 NPT' },
  { type: 'Flip Card', label: '3D FLIP CARD', color: '#3b82f6', defaultW: 860, defaultH: 85, defaultText: '3D FLIP HEADLINE CARD' },
  { type: 'Ellipse', label: 'ELLIPSE / BADGE', color: '#f43f5e', defaultW: 160, defaultH: 64, defaultText: 'LIVE' },
  { type: 'Line', label: 'ACCENT LINE', color: '#eab308', defaultW: 680, defaultH: 8, defaultText: '' },
  { type: 'Logo', label: 'LOGO BUG', color: '#e11d72', defaultW: 240, defaultH: 74, defaultText: 'KASHTRIX HD' },
  { type: '3D Box Text', label: '3D BOX TEXT', color: '#8b5cf6', defaultW: 540, defaultH: 84, defaultText: 'PRIME TIME HD' },
  { type: 'Weather', label: 'WEATHER CARD', color: '#0ea5e9', defaultW: 360, defaultH: 96, defaultText: 'KATHMANDU • 25°C' }
];

/**
 * Generates the default multi-track CG Items (Shape, Text, Image, PNG Sequence, Ticker, etc.)
 * for a given CG layer/composition when no custom items are stored yet in `style_json`.
 */
function buildDefaultCompositionItems(layer) {
  if (!layer) return [];
  const baseX = Number(layer.position_x ?? 48);
  const baseY = Number(layer.position_y ?? 800);
  const baseW = Number(layer.width ?? 680);
  const baseH = Number(layer.height ?? 110);
  const dur = Number(layer.duration_sec || 0) > 0 ? Number(layer.duration_sec) : 20;
  const startOff = Number(layer.start_offset_sec || 0);
  const cat = layer.category || 'lower_third';

  if (cat === 'logo_anim' || cat === 'live_anim') {
    return [
      {
        id: `${layer.id}_seq_1`,
        name: `${layer.name} Sequence`,
        type: 'PNG Sequence',
        x: baseX,
        y: baseY,
        width: baseW,
        height: baseH,
        start_sec: startOff,
        duration_sec: dur,
        color: layer.color || '#ec4899',
        bg_color: 'transparent',
        text_color: '#ffffff',
        text: layer.text || layer.name,
        font_size: 22,
        opacity: 1,
        animation: 'fade-in',
        is_base: true
      },
      {
        id: `${layer.id}_txt_1`,
        name: `${layer.name} Ident Tag`,
        type: 'Text',
        x: baseX,
        y: Math.min(1020, baseY + baseH - 34),
        width: baseW,
        height: 34,
        start_sec: startOff + 0.2,
        duration_sec: dur,
        color: '#38bdf8',
        bg_color: 'rgba(9,13,26,0.75)',
        text_color: '#ffffff',
        text: layer.subtext || 'HD LIVE',
        font_size: 16,
        opacity: 0.95,
        animation: 'slide-up',
        is_base: true
      }
    ];
  }

  if (cat === 'hebron_logo') {
    return [
      {
        id: `${layer.id}_img`,
        name: 'Hebron TV Logo',
        type: 'Image',
        x: baseX,
        y: baseY,
        width: baseW || 220,
        height: baseH || 110,
        start_sec: startOff,
        duration_sec: dur,
        color: '#38bdf8',
        bg_color: 'transparent',
        text_color: '#ffffff',
        text: '/cgdemo/hebron/Liquid-glass%20HEBRON%20TV%20logo.png',
        font_size: 18,
        opacity: 1,
        animation: 'fade-in',
        is_base: true
      }
    ];
  }

  if (cat === 'ticker' || cat === 'crawl' || cat === 'hebron_ticker' || cat === 'hebron_crawl') {
    return [
      {
        id: `${layer.id}_bar_1`,
        name: `${layer.name} Lower Bar`,
        type: 'Shape',
        x: 0,
        y: baseY,
        width: 1920,
        height: baseH,
        start_sec: startOff,
        duration_sec: dur,
        color: layer.bg_color || '#150d29',
        bg_color: layer.bg_color || '#150d29',
        text_color: '#ffffff',
        text: '',
        font_size: 24,
        opacity: 0.96,
        animation: 'slide-up',
        is_base: true
      },
      {
        id: `${layer.id}_badge_1`,
        name: `${layer.name} Header Badge`,
        type: 'Shape',
        x: 0,
        y: baseY,
        width: 240,
        height: baseH,
        start_sec: startOff,
        duration_sec: dur,
        color: layer.color || '#e11d72',
        bg_color: layer.color || '#e11d72',
        text_color: '#ffffff',
        text: layer.subtext || (cat === 'crawl' ? 'NEWS CRAWL' : 'HEADLINES'),
        font_size: 20,
        opacity: 1,
        animation: 'slide-left',
        is_base: true
      },
      {
        id: `${layer.id}_ticker_1`,
        name: `${layer.name} Live Crawl`,
        type: 'Ticker',
        x: 250,
        y: baseY,
        width: 1670,
        height: baseH,
        start_sec: startOff + 0.15,
        duration_sec: dur,
        color: '#f59e0b',
        bg_color: 'transparent',
        text_color: layer.text_color || '#ffffff',
        text: layer.text || 'LIVE BROADCAST HEADLINES',
        font_size: Number(layer.font_size || 26),
        opacity: 1,
        animation: 'scroll-left',
        is_base: true
      }
    ];
  }

  const items = [
    {
      id: `${layer.id}_plate`,
      name: `${layer.name} Background Plate`,
      type: 'Shape',
      x: baseX,
      y: baseY,
      width: baseW,
      height: baseH,
      start_sec: startOff,
      duration_sec: dur,
      color: layer.color || '#a855f7',
      bg_color: layer.bg_color || '#150d29',
      text_color: '#ffffff',
      text: '',
      font_size: 24,
      opacity: Number(layer.opacity ?? 0.95),
      animation: layer.animation || 'slide-left',
      is_base: true
    },
    {
      id: `${layer.id}_badge`,
      name: `${layer.name} Accent Badge`,
      type: cat === 'flash_premium' ? 'Flip Card' : 'Shape',
      x: baseX,
      y: baseY,
      width: Math.min(260, Math.round(baseW * 0.32)),
      height: Math.min(42, Math.round(baseH * 0.38)),
      start_sec: Number((startOff + 0.1).toFixed(2)),
      duration_sec: dur,
      color: layer.color || '#e11d72',
      bg_color: layer.color || '#e11d72',
      text_color: '#ffffff',
      text: (ALL_LABELS[cat] || cat).toUpperCase(),
      font_size: 16,
      opacity: 1,
      animation: 'slide-left',
      is_base: true
    },
    {
      id: `${layer.id}_headline`,
      name: `${layer.name} Primary Text`,
      type: 'Text',
      x: baseX + 18,
      y: baseY + 34,
      width: Math.max(160, baseW - 36),
      height: 46,
      start_sec: Number((startOff + 0.2).toFixed(2)),
      duration_sec: dur,
      color: '#38bdf8',
      bg_color: 'transparent',
      text_color: layer.text_color || '#ffffff',
      text: layer.text || layer.name,
      font_size: Number(layer.font_size || 30),
      opacity: 1,
      animation: layer.animation || 'char-reveal',
      is_base: true
    },
    {
      id: `${layer.id}_subtext`,
      name: `${layer.name} Subtext Strap`,
      type: 'Text',
      x: baseX + 18,
      y: baseY + Math.max(64, baseH - 36),
      width: Math.max(160, baseW - 36),
      height: 30,
      start_sec: Number((startOff + 0.35).toFixed(2)),
      duration_sec: dur,
      color: '#10b981',
      bg_color: 'transparent',
      text_color: '#cbd5e1',
      text: layer.subtext || 'LIVE BROADCAST STREAM',
      font_size: 20,
      opacity: 0.95,
      animation: 'word-reveal',
      is_base: true
    }
  ];

  if (['logo', 'sponsor', 'music_now', 'weather_map'].includes(cat)) {
    items.push({
      id: `${layer.id}_gfx`,
      name: `${layer.name} Graphic Bug`,
      type: 'Image',
      x: baseX + baseW - 110,
      y: baseY + 12,
      width: 96,
      height: Math.max(48, baseH - 24),
      start_sec: startOff,
      duration_sec: dur,
      color: '#f59e0b',
      bg_color: 'rgba(255,255,255,0.08)',
      text_color: '#ffffff',
      text: 'LOGO / ART',
      font_size: 14,
      opacity: 1,
      animation: 'zoom-in',
      is_base: true
    });
  }

  return items;
}

function parseLayerItems(layer) {
  if (!layer) return [];
  try {
    if (layer.style_json) {
      const parsed = typeof layer.style_json === 'string' ? JSON.parse(layer.style_json) : layer.style_json;
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return parsed.items;
      }
    }
  } catch {}
  return buildDefaultCompositionItems(layer);
}

export function VisualCGStudio({
  data,
  can,
  entitlements,
  selectedCg,
  setSelectedCg,
  cgDraft,
  setCgDraft,
  savePreviewCg,
  takeCgLayer,
  cutCgLayer,
  duplicateCgLayer,
  resetCgLayout,
  saveLayoutPreset,
  applyLayoutPreset,
  saveAsNewTemplate,
  save,
  del,
  studioMode = 'editor',
  setStudioMode,
  setTab,
  notifyToast
}) {
  const fontsInfo = useAvailableFonts(data?.system_fonts);
  const projectFonts = fontsInfo?.project_fonts || [];
  const installedFonts = fontsInfo?.system_fonts || [];
  const [mode, setMode] = useState(studioMode || 'editor'); // 'editor' | 'controller'
  const [leftTab, setLeftTab] = useState('cg_item'); // Default to CG ITEM / Composition view
  const [inspectorTab, setInspectorTab] = useState('layer'); // 'layer' | 'effects' | 'data' | 'composition'
  const [controllerTab, setControllerTab] = useState('layers'); // 'layers' | 'overlays' | 'on_air' | 'quick_edit' | 'scheduler'
  const [targetTab, setTargetTab] = useState('targets'); // 'targets' | 'output' | 'status'
  const [expandedGroups, setExpandedGroups] = useState({ branding: true, lower_thirds: true, newsroom: true, tickers: true, music_pack: true, programme: true });

  // Canvas & Preview controls
  const [showSafeGuides, setShowSafeGuides] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLiveBg, setShowLiveBg] = useState(true);
  const [zoomPct, setZoomPct] = useState(100);
  const [filterCat, setFilterCat] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [dragState, setDragState] = useState(null);

  // Composition CG Items state (Shape, Text, Image, PNG Sequence, Ticker, etc.)
  const [compItems, setCompItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectAllActive, setSelectAllActive] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);
  const [canvasCleared, setCanvasCleared] = useState(false);
  const [clipboardItem, setClipboardItem] = useState(null);
  const [timelineViewMode, setTimelineViewMode] = useState('items'); // 'items' (selected CG composition items) | 'all_layers'

  // Timeline state & Mouse-draggable playhead / clip bar state
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(1.0);
  const [timelineMaxSec, setTimelineMaxSec] = useState(20);
  const [timelineLoop, setTimelineLoop] = useState(true);
  const [autoKey, setAutoKey] = useState(true);
  const [isScrubbingPlayhead, setIsScrubbingPlayhead] = useState(false);
  const [tlBarDrag, setTlBarDrag] = useState(null);

  // Switcher state (CG Controller)
  const [takeTransition, setTakeTransition] = useState('Slide');
  const [switcherDurSec, setSwitcherDurSec] = useState(10);
  const [previewBusPlaying, setPreviewBusPlaying] = useState(true);
  const [liveTime, setLiveTime] = useState(() => new Date());

  // Quick CG Scheduler form inside Controller
  const [schedName, setSchedName] = useState('');
  const [schedStartsAt, setSchedStartsAt] = useState(localForInput());
  const [schedDurSec, setSchedDurSec] = useState(60);

  // New CG Composition modal & Template rename state
  const [newCompOpen, setNewCompOpen] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompCat, setNewCompCat] = useState('ticker');
  const [newCompTplId, setNewCompTplId] = useState('');
  const [editingTplId, setEditingTplId] = useState(null);
  const [editingTplName, setEditingTplName] = useState('');

  const canvasRef = useRef(null);
  const rulerTrackRef = useRef(null);

  // Undo / Redo history stack (works across CG Editor & CG Controller)
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const latestStateRef = useRef({});
  const lastHistoryTimeRef = useRef(0);
  const dragStartSnapshotRef = useRef(null);

  latestStateRef.current = {
    compItems,
    cgDraft,
    selectedItemId,
    isGrouped,
    canvasCleared,
    selectAllActive
  };

  const pushUndo = (label = 'Edit', coalesceMs = 0) => {
    const now = Date.now();
    if (coalesceMs > 0 && now - lastHistoryTimeRef.current < coalesceMs && undoStack.length > 0) {
      return;
    }
    lastHistoryTimeRef.current = now;
    const snap = JSON.parse(JSON.stringify(latestStateRef.current));
    setUndoStack(prev => [...prev.slice(-59), { kind: 'snapshot', ...snap, label }]);
    setRedoStack([]);
  };

  const updateDraft = (patchOrFn, label = 'Edit Properties', coalesceMs = 450) => {
    pushUndo(label, coalesceMs);
    setCgDraft(d => (typeof patchOrFn === 'function' ? patchOrFn(d) : { ...d, ...patchOrFn }));
  };

  const handleUndo = () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      const currentSnap = JSON.parse(JSON.stringify(latestStateRef.current));
      setRedoStack(r => [...r.slice(-59), { kind: 'snapshot', ...currentSnap, label: entry.label }]);
      setCompItems(entry.compItems || []);
      if (entry.cgDraft) setCgDraft(entry.cgDraft);
      setSelectedItemId(entry.selectedItemId ?? null);
      setIsGrouped(Boolean(entry.isGrouped));
      setCanvasCleared(Boolean(entry.canvasCleared));
      setSelectAllActive(Boolean(entry.selectAllActive));
      notifyToast?.(`Undo${entry.label ? `: ${entry.label}` : ''}`);
      return prev.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      const currentSnap = JSON.parse(JSON.stringify(latestStateRef.current));
      setUndoStack(u => [...u.slice(-59), { kind: 'snapshot', ...currentSnap, label: entry.label }]);
      setCompItems(entry.compItems || []);
      if (entry.cgDraft) setCgDraft(entry.cgDraft);
      setSelectedItemId(entry.selectedItemId ?? null);
      setIsGrouped(Boolean(entry.isGrouped));
      setCanvasCleared(Boolean(entry.canvasCleared));
      setSelectAllActive(Boolean(entry.selectAllActive));
      notifyToast?.(`Redo${entry.label ? `: ${entry.label}` : ''}`);
      return prev.slice(0, -1);
    });
  };

  useEffect(() => {
    if (studioMode && studioMode !== mode) {
      setMode(studioMode);
    }
  }, [studioMode]);

  const switchMode = (m) => {
    setMode(m);
    setStudioMode?.(m);
    if (m === 'editor') setTab?.('cg_editor');
    else if (m === 'controller') setTab?.('cg_controller');
  };

  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load composition items whenever the selected CG layer changes
  useEffect(() => {
    if (!selectedCg) return;
    const loaded = parseLayerItems(cgDraft?.id === selectedCg.id ? cgDraft : selectedCg);
    setCompItems(loaded);
    setCanvasCleared(false);
    if (!selectedItemId || !loaded.some(i => i.id === selectedItemId)) {
      setSelectedItemId(loaded[0]?.id || null);
    }
    setSelectAllActive(false);
    setUndoStack([]);
    setRedoStack([]);
    lastHistoryTimeRef.current = 0;
    dragStartSnapshotRef.current = null;
  }, [selectedCg?.id]);

  // Sync compItems changes back into cgDraft.style_json (and primary text/geometry)
  const updateCompositionItems = (updater, opts = {}) => {
    if (!opts.skipHistory) {
      pushUndo(opts.label || 'Edit Layer', opts.coalesceMs || 0);
    }
    setCanvasCleared(false);
    setCompItems(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      let existingStyle = {};
      try {
        existingStyle = cgDraft?.style_json ? JSON.parse(cgDraft.style_json) : {};
      } catch {}
      const nextStyleJson = JSON.stringify({ ...existingStyle, items: next });

      // Also sync headline/subtext/plate if composition items were edited
      const headlineItem = next.find(i => String(i.id).endsWith('_headline') || String(i.id).endsWith('_ticker_1'));
      const subtextItem = next.find(i => String(i.id).endsWith('_subtext') || String(i.id).endsWith('_badge_1'));
      const plateItem = next.find(i => String(i.id).endsWith('_plate') || String(i.id).endsWith('_bar_1'));

      setCgDraft(d => ({
        ...d,
        style_json: nextStyleJson,
        ...(headlineItem && headlineItem.text !== undefined ? { text: headlineItem.text } : {}),
        ...(subtextItem && subtextItem.text !== undefined ? { subtext: subtextItem.text } : {}),
        ...(plateItem ? {
          position_x: plateItem.x,
          position_y: plateItem.y,
          width: plateItem.width,
          height: plateItem.height
        } : {})
      }));
      return next;
    });
  };

  const selectedItem = useMemo(
    () => compItems.find(i => i.id === selectedItemId) || null,
    [compItems, selectedItemId]
  );

  // Timeline playback loop
  useEffect(() => {
    if (!timelinePlaying) return;
    const timer = setInterval(() => {
      setPlayheadSec(prev => {
        const next = prev + 0.1;
        if (next >= timelineMaxSec) {
          return timelineLoop ? 0 : timelineMaxSec;
        }
        return Number(next.toFixed(2));
      });
    }, 100);
    return () => clearInterval(timer);
  }, [timelinePlaying, timelineMaxSec, timelineLoop]);

  // Mouse-draggable Timeline Playhead (Scrubber) across the entire timeline ruler & track area
  useEffect(() => {
    if (!isScrubbingPlayhead) return;
    const updatePlayheadFromMouse = (clientX) => {
      const el = rulerTrackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      setPlayheadSec(Number((ratio * timelineMaxSec).toFixed(2)));
    };
    const onMove = (e) => updatePlayheadFromMouse(e.clientX);
    const onUp = () => setIsScrubbingPlayhead(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isScrubbingPlayhead, timelineMaxSec]);

  // Mouse-draggable & resizable Timeline Clip Bars (move start_sec or resize duration_sec)
  useEffect(() => {
    if (!tlBarDrag) return;
    if (!dragStartSnapshotRef.current) {
      dragStartSnapshotRef.current = JSON.parse(JSON.stringify(latestStateRef.current));
    }
    const onMove = (e) => {
      const el = rulerTrackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const deltaSec = ((e.clientX - tlBarDrag.startClientX) / Math.max(1, rect.width)) * timelineMaxSec;

      if (tlBarDrag.kind === 'item') {
        updateCompositionItems(prev => prev.map(item => {
          if (item.id !== tlBarDrag.id) return item;
          if (tlBarDrag.action === 'move') {
            const newStart = Math.max(0, Math.min(timelineMaxSec - 0.5, Number((tlBarDrag.origStart + deltaSec).toFixed(2))));
            return { ...item, start_sec: newStart };
          }
          if (tlBarDrag.action === 'resize-r') {
            const newDur = Math.max(0.5, Math.min(timelineMaxSec - tlBarDrag.origStart, Number((tlBarDrag.origDur + deltaSec).toFixed(2))));
            return { ...item, duration_sec: newDur };
          }
          if (tlBarDrag.action === 'resize-l') {
            const newStart = Math.max(0, Math.min(tlBarDrag.origStart + tlBarDrag.origDur - 0.5, Number((tlBarDrag.origStart + deltaSec).toFixed(2))));
            const newDur = Math.max(0.5, Number((tlBarDrag.origDur - (newStart - tlBarDrag.origStart)).toFixed(2)));
            return { ...item, start_sec: newStart, duration_sec: newDur };
          }
          return item;
        }), { skipHistory: true });
      } else if (tlBarDrag.kind === 'layer') {
        if (tlBarDrag.action === 'move') {
          const newStart = Math.max(0, Math.round(tlBarDrag.origStart + deltaSec));
          setCgDraft(d => ({ ...d, start_offset_sec: newStart }));
        } else if (tlBarDrag.action === 'resize-r') {
          const newDur = Math.max(1, Math.round(tlBarDrag.origDur + deltaSec));
          setCgDraft(d => ({ ...d, duration_sec: newDur }));
        }
      }
    };
    const onUp = () => {
      const startSnap = dragStartSnapshotRef.current;
      dragStartSnapshotRef.current = null;
      if (startSnap && (
        JSON.stringify(startSnap.compItems) !== JSON.stringify(latestStateRef.current.compItems) ||
        JSON.stringify(startSnap.cgDraft) !== JSON.stringify(latestStateRef.current.cgDraft)
      )) {
        setUndoStack(prev => [...prev.slice(-59), { kind: 'snapshot', ...startSnap, label: 'Timeline Adjust' }]);
        setRedoStack([]);
      }
      setTlBarDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [tlBarDrag, timelineMaxSec]);

  const allowedCats = useMemo(
    () => new Set(entitlements?.cg_categories || ALL_KEYS),
    [entitlements]
  );

  const hasVisualStudio = Boolean(entitlements?.visual_cg_designer);
  const hasTimeline = Boolean(entitlements?.cg_timeline);

  const filteredLayers = useMemo(() => {
    return (data.cg || []).filter(layer => {
      if (filterCat !== 'all' && layer.category !== filterCat) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        return (layer.name || '').toLowerCase().includes(q) || (layer.category || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [data.cg, filterCat, searchText]);

  const activeOnAirLayers = useMemo(
    () => (data.cg || []).filter(l => l.effective_active && !l.hidden),
    [data.cg]
  );

  // Drag / Resize on 1920x1080 Canvas (supports moving whole CG Layer, individual CG Item, or Select All group)
  useEffect(() => {
    if (!dragState) return;
    if (!dragStartSnapshotRef.current) {
      dragStartSnapshotRef.current = JSON.parse(JSON.stringify(latestStateRef.current));
    }
    const onMove = (e) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dxRef = Math.round(((e.clientX - dragState.startX) / Math.max(1, rect.width)) * 1920);
      const dyRef = Math.round(((e.clientY - dragState.startY) / Math.max(1, rect.height)) * 1080);

      if (dragState.targetType === 'custom_item') {
        updateCompositionItems(prev => prev.map(it => {
          if (!selectAllActive && it.id !== dragState.itemId) return it;
          const orig = dragState.origItemsMap?.[it.id] || dragState;
          if (dragState.mode === 'move') {
            return {
              ...it,
              x: Math.max(0, Math.min(1920 - 40, orig.origX + dxRef)),
              y: Math.max(0, Math.min(1080 - 24, orig.origY + dyRef))
            };
          }
          if (dragState.mode === 'resize' && it.id === dragState.itemId) {
            return {
              ...it,
              width: Math.max(20, Math.min(1920 - orig.origX, orig.origW + dxRef)),
              height: Math.max(8, Math.min(1080 - orig.origY, orig.origH + dyRef))
            };
          }
          return it;
        }), { skipHistory: true });
      } else if (dragState.mode === 'move') {
        const nextX = Math.max(0, Math.min(1920 - (dragState.origW || 200), dragState.origX + dxRef));
        const nextY = Math.max(0, Math.min(1080 - (dragState.origH || 80), dragState.origY + dyRef));
        const deltaX = nextX - dragState.origX;
        const deltaY = nextY - dragState.origY;
        setCgDraft(d => ({ ...d, position_x: nextX, position_y: nextY }));
        if ( dragState.origItemsMap ) {
          setCompItems(prev => prev.map(it => {
            const o = dragState.origItemsMap[it.id];
            return o ? { ...it, x: Math.max(0, o.origX + deltaX), y: Math.max(0, o.origY + deltaY) } : it;
          }));
        }
      } else if (dragState.mode === 'resize') {
        const nextW = Math.max(120, Math.min(1920 - dragState.origX, dragState.origW + dxRef));
        const nextH = Math.max(44, Math.min(1080 - dragState.origY, dragState.origH + dyRef));
        setCgDraft(d => ({ ...d, width: nextW, height: nextH }));
      }
    };
    const onUp = () => {
      const startSnap = dragStartSnapshotRef.current;
      dragStartSnapshotRef.current = null;
      if (startSnap && (
        JSON.stringify(startSnap.compItems) !== JSON.stringify(latestStateRef.current.compItems) ||
        JSON.stringify(startSnap.cgDraft) !== JSON.stringify(latestStateRef.current.cgDraft)
      )) {
        setUndoStack(prev => [...prev.slice(-59), { kind: 'snapshot', ...startSnap, label: dragState.mode === 'resize' ? 'Resize Layer' : 'Move Layer' }]);
        setRedoStack([]);
      }
      setDragState(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState, selectAllActive, setCgDraft]);

  const startLayerDrag = (e, layer, dragMode = 'move') => {
    e.preventDefault();
    e.stopPropagation();
    if (layer.locked) return;
    if (selectedCg?.id !== layer.id) {
      setSelectedCg(layer);
    }
    const source = selectedCg?.id === layer.id ? cgDraft : layer;
    const origItemsMap = {};
    for (const it of compItems) {
      origItemsMap[it.id] = { origX: Number(it.x || 0), origY: Number(it.y || 0), origW: Number(it.width || 200), origH: Number(it.height || 60) };
    }
    setDragState({
      targetType: 'layer',
      mode: dragMode,
      startX: e.clientX,
      startY: e.clientY,
      origX: Number(source.position_x ?? 48),
      origY: Number(source.position_y ?? 800),
      origW: Number(source.width ?? 680),
      origH: Number(source.height ?? 110),
      origItemsMap
    });
  };

  const startCustomItemDrag = (e, item, dragMode = 'move') => {
    e.preventDefault();
    e.stopPropagation();
    if (item.locked) return;
    setSelectedItemId(item.id);
    const origItemsMap = {};
    for (const it of compItems) {
      origItemsMap[it.id] = { origX: Number(it.x || 0), origY: Number(it.y || 0), origW: Number(it.width || 200), origH: Number(it.height || 60) };
    }
    setDragState({
      targetType: 'custom_item',
      itemId: item.id,
      mode: dragMode,
      startX: e.clientX,
      startY: e.clientY,
      origX: Number(item.x ?? 100),
      origY: Number(item.y ?? 700),
      origW: Number(item.width ?? 400),
      origH: Number(item.height ?? 80),
      origItemsMap
    });
  };

  // Add a new CG Item (Shape, Text, Image, PNG Sequence, Ticker, etc.) to the current composition
  const handleAddCgItem = (spec) => {
    const newId = `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const countOfType = compItems.filter(i => i.type === spec.type).length + 1;
    const offsetStep = (compItems.length % 6) * 24;
    const newItem = {
      id: newId,
      name: `${spec.type} ${countOfType}`,
      type: spec.type,
      x: spec.type === 'Ticker' ? 0 : Math.min(1400, 120 + offsetStep),
      y: spec.type === 'Ticker' ? 960 : Math.min(900, 180 + offsetStep),
      width: spec.defaultW,
      height: spec.defaultH,
      start_sec: Number(playheadSec.toFixed(2)),
      duration_sec: Math.max(5, Number((timelineMaxSec - playheadSec).toFixed(2))),
      color: spec.color,
      bg_color: spec.type === 'Text' ? 'transparent' : '#160d2d',
      text_color: '#ffffff',
      text: spec.defaultText,
      font_size: spec.type === '3D Box Text' ? 36 : 26,
      opacity: 0.96,
      animation: spec.type === 'Ticker' ? 'scroll-left' : 'slide-up',
      is_base: false
    };
    updateCompositionItems(prev => [...prev, newItem]);
    setSelectedItemId(newId);
    setTimelineViewMode('items');
    notifyToast?.(`Added ${spec.type} "${newItem.name}" to CG Composition & Timeline`);
  };

  // Copy, Cut, Paste, Duplicate, Delete, Select All, and Arrow-Key Nudging on Canvas
  const handleCopySelected = () => {
    if (selectedItem) {
      setClipboardItem({ kind: 'item', data: { ...selectedItem } });
      notifyToast?.(`Copied CG Item "${selectedItem.name}"`);
    } else if (cgDraft) {
      setClipboardItem({ kind: 'layer', data: { ...cgDraft } });
      notifyToast?.(`Copied CG Layer "${cgDraft.name}"`);
    }
  };

  const handleCutSelected = () => {
    if (selectedItem) {
      setClipboardItem({ kind: 'item', data: { ...selectedItem } });
      updateCompositionItems(prev => prev.filter(i => i.id !== selectedItem.id));
      setSelectedItemId(null);
      notifyToast?.(`Cut CG Item "${selectedItem.name}"`);
    } else if (cgDraft) {
      setClipboardItem({ kind: 'layer', data: { ...cgDraft } });
      setCgDraft(d => ({ ...d, text: '', subtext: '' }));
      notifyToast?.(`Cut CG Layer content "${cgDraft.name}"`);
    }
  };

  const handlePasteClipboard = () => {
    if (!clipboardItem) {
      notifyToast?.('Clipboard is empty — Copy or Cut a CG item first');
      return;
    }
    if (clipboardItem.kind === 'item') {
      const src = clipboardItem.data;
      const newId = `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const pasted = {
        ...src,
        id: newId,
        name: `${src.name} (Copy)`,
        x: Math.min(1800, Number(src.x || 80) + 30),
        y: Math.min(1000, Number(src.y || 700) + 30),
        is_base: false
      };
      updateCompositionItems(prev => [...prev, pasted]);
      setSelectedItemId(newId);
      notifyToast?.(`Pasted "${pasted.name}" onto 16:9 Canvas`);
    } else if (clipboardItem.kind === 'layer' && cgDraft) {
      const src = clipboardItem.data;
      setCgDraft(d => ({
        ...d,
        text: src.text || d.text,
        subtext: src.subtext || d.subtext,
        color: src.color || d.color,
        bg_color: src.bg_color || d.bg_color,
        text_color: src.text_color || d.text_color,
        position_x: Math.min(1800, Number(src.position_x || 48) + 24),
        position_y: Math.min(1000, Number(src.position_y || 800) + 24)
      }));
      notifyToast?.('Pasted CG layer properties onto selected layer');
    }
  };

  const handleDuplicateSelected = () => {
    if (selectedItem) {
      const newId = `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const dup = {
        ...selectedItem,
        id: newId,
        name: `${selectedItem.name} (Dup)`,
        x: Math.min(1800, Number(selectedItem.x || 80) + 24),
        y: Math.min(1000, Number(selectedItem.y || 700) + 24),
        is_base: false
      };
      updateCompositionItems(prev => [...prev, dup]);
      setSelectedItemId(newId);
      notifyToast?.(`Duplicated CG Item "${dup.name}"`);
    } else if (selectedCg && hasVisualStudio) {
      duplicateCgLayer(selectedCg.id);
    }
  };

  const handleDeleteSelected = () => {
    if (selectAllActive && compItems.length > 0) {
      updateCompositionItems([]);
      setSelectedItemId(null);
      setSelectAllActive(false);
      notifyToast?.('Deleted all CG items from composition');
      return;
    }
    if (selectedItem) {
      const deletedName = selectedItem.name;
      updateCompositionItems(prev => {
        const filtered = prev.filter(i => i.id !== selectedItem.id);
        setSelectedItemId(filtered[0]?.id || null);
        return filtered;
      });
      notifyToast?.(`Deleted CG Item "${deletedName}"`);
    }
  };

  const handleSelectAll = () => {
    setSelectAllActive(prev => {
      const next = !prev;
      notifyToast?.(next ? `Selected all ${compItems.length} CG items on canvas` : 'Cleared multi-selection');
      return next;
    });
  };

  const handleToggleGroup = () => {
    pushUndo(isGrouped ? 'Ungroup Layers' : 'Group Layers');
    setIsGrouped(prev => {
      const next = !prev;
      notifyToast?.(next ? 'Grouped composition layers into unified broadcast overlay' : 'Ungrouped layers — click any item on canvas or timeline to edit individually');
      return next;
    });
  };

  const nudgeSelected = (dx, dy) => {
    if (selectAllActive || isGrouped) {
      updateCompositionItems(prev => prev.map(it => (
        it.locked ? it : {
          ...it,
          x: Math.max(0, Math.min(1900, Number(it.x || 0) + dx)),
          y: Math.max(0, Math.min(1060, Number(it.y || 0) + dy))
        }
      )), { label: 'Nudge Layer', coalesceMs: 350 });
      setCgDraft(d => ({
        ...d,
        position_x: Math.max(0, Math.min(1900, Number(d.position_x || 0) + dx)),
        position_y: Math.max(0, Math.min(1060, Number(d.position_y || 0) + dy))
      }));
    } else if (selectedItem && !selectedItem.locked) {
      updateCompositionItems(prev => prev.map(it =>
        it.id === selectedItem.id
          ? {
              ...it,
              x: Math.max(0, Math.min(1900, Number(it.x || 0) + dx)),
              y: Math.max(0, Math.min(1060, Number(it.y || 0) + dy))
            }
          : it
      ), { label: 'Nudge Layer', coalesceMs: 350 });
    } else if (cgDraft) {
      pushUndo('Nudge Layer', 350);
      setCgDraft(d => ({
        ...d,
        position_x: Math.max(0, Math.min(1900, Number(d.position_x || 0) + dx)),
        position_y: Math.max(0, Math.min(1060, Number(d.position_y || 0) + dy))
      }));
    }
  };

  // Keyboard shortcuts: Undo (Ctrl+Z), Redo (Ctrl+Y / Ctrl+Shift+Z), Copy (Ctrl+C), Cut (Ctrl+X), Paste (Ctrl+V), Select All (Ctrl+A), Duplicate (Ctrl+D), Group (Ctrl+G), Delete, and Arrow Nudge
  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = (e.key || '').toLowerCase();
      const tag = (e.target?.tagName || '').toLowerCase();
      const isTextField = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;
      const isSearchInput = isTextField && /search|filter/i.test(e.target?.placeholder || '');

      // Undo / Redo works in both Editor and Controller modes (and even inside inspector inputs, except search boxes)
      if (mod && !isSearchInput) {
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (mode !== 'editor' || isTextField) {
        return;
      }
      if (mod && key === 'c') {
        e.preventDefault();
        handleCopySelected();
      } else if (mod && key === 'x') {
        e.preventDefault();
        handleCutSelected();
      } else if (mod && key === 'v') {
        e.preventDefault();
        handlePasteClipboard();
      } else if (mod && key === 'a') {
        e.preventDefault();
        handleSelectAll();
      } else if (mod && key === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (mod && key === 'g') {
        e.preventDefault();
        handleToggleGroup();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        if (e.key === 'ArrowLeft') nudgeSelected(-step, 0);
        if (e.key === 'ArrowRight') nudgeSelected(step, 0);
        if (e.key === 'ArrowUp') nudgeSelected(0, -step);
        if (e.key === 'ArrowDown') nudgeSelected(0, step);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, selectedItem, cgDraft, clipboardItem, selectAllActive, compItems, isGrouped, undoStack.length, redoStack.length]);

  // Layers rendered on the 1920x1080 Editor Canvas (when Grouped, selected layer renders as composite; when Ungrouped, its items render individually)
  const canvasLayers = useMemo(() => {
    if (canvasCleared) return [];
    const all = data.cg || [];
    const list = [];
    for (const l of all) {
      if (l.hidden) continue;
      if (selectedCg && l.id === selectedCg.id) {
        if (isGrouped) {
          list.push({ ...l, ...cgDraft, isSelected: true });
        }
      } else if (l.effective_active) {
        list.push({ ...l, isSelected: false });
      }
    }
    return list;
  }, [data.cg, selectedCg, cgDraft, isGrouped, canvasCleared]);

  // Individual CG Items visible at the current playheadSec
  const visibleCustomItems = useMemo(() => {
    if (canvasCleared) return [];
    return compItems.filter(it => {
      if (it.hidden) return false;
      if (isGrouped && it.is_base) return false;
      const st = Number(it.start_sec || 0);
      const dur = Number(it.duration_sec || 20);
      return playheadSec >= st && playheadSec <= st + dur;
    });
  }, [compItems, playheadSec, isGrouped, canvasCleared]);

  const centerSelectedLayer = () => {
    if (selectedItem && !isGrouped) {
      const w = Number(selectedItem.width || 400);
      const h = Number(selectedItem.height || 80);
      updateCompositionItems(prev => prev.map(it =>
        it.id === selectedItem.id
          ? { ...it, x: Math.round((1920 - w) / 2), y: Math.round((1080 - h) / 2) }
          : it
      ));
      return;
    }
    if (!cgDraft) return;
    const w = Number(cgDraft.width || 680);
    const h = Number(cgDraft.height || 120);
    setCgDraft(d => ({
      ...d,
      position_x: Math.round((1920 - w) / 2),
      position_y: Math.round((1080 - h) / 2)
    }));
  };

  const clearAllOnAirCg = async () => {
    for (const l of activeOnAirLayers) {
      await cutCgLayer(l.id);
    }
    notifyToast?.('All On-Air CG overlays cleared');
  };

  const clearEditorCanvas = async () => {
    pushUndo('Clear Canvas');
    for (const l of activeOnAirLayers) {
      await cutCgLayer(l.id);
    }
    updateCompositionItems([], { skipHistory: true });
    setSelectedItemId(null);
    setSelectAllActive(false);
    setCanvasCleared(true);
    notifyToast?.('Canvas & active overlays cleared');
  };

  const applyTemplateToDraft = (tpl) => {
    pushUndo('Apply Template');
    setCgDraft(d => {
      const updated = {
        ...d,
        template_id: tpl.id,
        color: tpl.accent || d.color,
        bg_color: tpl.bg_color || d.bg_color,
        text_color: tpl.text_color || d.text_color,
        gradient: tpl.gradient ?? d.gradient,
        font_family: tpl.font_family || d.font_family,
        font_size: tpl.font_size || d.font_size,
        animation: tpl.animation || d.animation,
        position_x: tpl.position_x ?? d.position_x,
        position_y: tpl.position_y ?? d.position_y,
        width: tpl.width ?? d.width,
        height: tpl.height ?? d.height,
        border_radius: tpl.border_radius ?? d.border_radius,
        border_width: tpl.border_width ?? d.border_width,
        border_color: tpl.border_color || tpl.accent || d.border_color,
        text: d.text || tpl.sample_text || '',
        subtext: d.subtext || tpl.sample_subtext || ''
      };
      const rebuilt = buildDefaultCompositionItems(updated);
      setCompItems(rebuilt);
      setSelectedItemId(rebuilt[0]?.id || null);
      return updated;
    });
  };

  // ============================================================================
  // MODE 2: KASHTRIX CG CONTROLLER (DUAL-BUS LIVE SWITCHER — SCREENSHOT 3)
  // ============================================================================
  if (mode === 'controller') {
    const previewOverlayObj = selectedCg ? { ...selectedCg, ...cgDraft } : (data.cg?.[0] || null);
    return (
      <div className="kx-cg-controller">
        {/* TOP CONTROLLER HEADER */}
        <header className="kx-cg-topbar">
          <div className="kx-cg-brand">
            <button type="button" className="kx-studio-nav-btn back" onClick={() => setTab?.('dashboard')} title="Back to Overview">
              ← Overview
            </button>
            <button type="button" className="kx-studio-nav-btn" onClick={() => setTab?.('playout')} title="Open Playout Console">
              Playout
            </button>
            <span className="kx-cg-logo-badge"><Layers size={15} /></span>
            <div>
              <strong>KASHTRIX CG CONTROLLER</strong>
              <small>Multi-overlay graphics playback • dynamic layers • live broadcast switcher</small>
            </div>
          </div>

          <div className="kx-cg-mode-Dynamic">
            <button type="button" className="kx-mode-pill" onClick={() => switchMode('editor')}>
              1. CG BROADCAST EDITOR (CANVAS)
            </button>
            <button type="button" className="kx-mode-pill active" onClick={() => switchMode('controller')}>
              2. CG LIVE CONTROLLER (SWITCHER)
            </button>
          </div>

          <div className="kx-cg-top-right">
            <button
              type="button"
              className="kx-top-btn"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title={`Undo (Ctrl+Z)${undoStack.length ? ` — ${undoStack[undoStack.length - 1].label}` : ''}`}
            >
              <Undo2 size={13} /> UNDO
            </button>
            <button
              type="button"
              className="kx-top-btn"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title={`Redo (Ctrl+Y)${redoStack.length ? ` — ${redoStack[redoStack.length - 1].label}` : ''}`}
            >
              <Redo2 size={13} /> REDO
            </button>
            <span className="kx-cg-clock">{clock(liveTime)}</span>
            <span className="kx-conn-pill">● CONNECTED</span>
            <button type="button" className="kx-top-btn" onClick={() => switchMode('editor')}>
              DESIGNER
            </button>
          </div>
        </header>

        {/* TOP 3-COLUMN DUAL-BUS SWITCHER: PREVIEW BUS | SWITCHER | PROGRAM BUS */}
        <div className="kx-controller-upper">
          {/* LEFT: PREVIEW BUS */}
          <div className="kx-bus-panel preview-bus">
            <div className="kx-bus-head">
              <span className="kx-bus-title purple">PREVIEW BUS</span>
              <span className="kx-bus-sub">{previewOverlayObj ? `${previewOverlayObj.name} (${ALL_LABELS[previewOverlayObj.category] || previewOverlayObj.category})` : 'No Layer Selected'}</span>
            </div>
            <div className="kx-bus-monitor">
              {showLiveBg && <LiveVideoSurface data={data} allowFallbackMedia={true} showAudioToggle={false} />}
              <div className="kx-bus-overlay-plane">
                {previewBusPlaying && previewOverlayObj && renderCgOverlayBox(previewOverlayObj, data.server_time, { cgContent: data.cg_content })}
              </div>
            </div>
            <div className="kx-bus-actions three">
              <button
                type="button"
                className="kx-bus-btn play-prev"
                onClick={() => {
                  setPreviewBusPlaying(true);
                  if (selectedCg && hasVisualStudio) savePreviewCg(selectedCg.id, cgDraft);
                }}
              >
                PLAY PREVIEW
              </button>
              <button
                type="button"
                className="kx-bus-btn stop"
                onClick={() => setPreviewBusPlaying(false)}
              >
                STOP
              </button>
              <button
                type="button"
                className="kx-bus-btn clear"
                onClick={() => {
                  setPreviewBusPlaying(false);
                  setCgDraft(d => ({ ...d, text: '', subtext: '' }));
                }}
              >
                CLEAR
              </button>
            </div>
          </div>

          {/* CENTER: SWITCHER */}
          <div className="kx-switcher-column">
            <div className="kx-switcher-title">SWITCHER</div>
            <button
              type="button"
              className="kx-sw-btn auto"
              disabled={!can('operator') || !selectedCg}
              onClick={() => {
                if (!selectedCg) return;
                const payload = {
                  ...cgDraft,
                  enter_transition: takeTransition.toLowerCase(),
                  duration_sec: Number(switcherDurSec || 0)
                };
                if (hasVisualStudio) {
                  takeCgLayer(selectedCg.id, payload);
                } else {
                  save('cg', { ...payload, active: 1 }, selectedCg.id);
                }
              }}
            >
              AUTO
            </button>
            <button
              type="button"
              className="kx-sw-btn cut"
              disabled={!can('operator') || !selectedCg}
              onClick={() => selectedCg && cutCgLayer(selectedCg.id)}
            >
              CUT
            </button>
            <button
              type="button"
              className="kx-sw-btn take"
              disabled={!can('operator') || !selectedCg}
              onClick={() => {
                if (!selectedCg) return;
                if (hasVisualStudio) {
                  takeCgLayer(selectedCg.id, cgDraft);
                } else {
                  save('cg', { ...cgDraft, active: 1 }, selectedCg.id);
                }
              }}
            >
              TAKE
            </button>

            <div className="kx-sw-field">
              <label>TAKE TRANSITION</label>
              <select value={takeTransition} onChange={(e) => setTakeTransition(e.target.value)}>
                <option value="None">None</option>
                <option value="Slide">Slide</option>
                <option value="Fade">Fade</option>
                <option value="Wipe">Wipe</option>
                <option value="Zoom">Zoom</option>
              </select>
            </div>

            <div className="kx-sw-field">
              <label>DURATION SEC (0 = HOLD)</label>
              <input
                type="number"
                min="0"
                max="3600"
                value={switcherDurSec}
                onChange={(e) => {
                  const v = Number(e.target.value || 0);
                  setSwitcherDurSec(v);
                  setCgDraft(d => ({ ...d, duration_sec: v }));
                }}
              />
            </div>

            <p className="kx-sw-hint">
              TAKE promotes Preview Bus directly to Program Bus On-Air output.
            </p>
          </div>

          {/* RIGHT: PROGRAM BUS (ON AIR) */}
          <div className="kx-bus-panel program-bus">
            <div className="kx-bus-head">
              <span className="kx-bus-title coral">PROGRAM BUS</span>
              <span className="kx-bus-sub">
                {activeOnAirLayers.length
                  ? `${activeOnAirLayers.length} Overlay(s) Live — ${activeOnAirLayers.map(l => l.name).slice(0, 2).join(' • ')}`
                  : 'Clean Feed (0 CG Overlays On Air)'}
              </span>
            </div>
            <div className="kx-bus-monitor program">
              <LiveVideoSurface data={data} allowFallbackMedia={true} showAudioToggle={true} />
              <div className="kx-bus-overlay-plane">
                {activeOnAirLayers.map(l => renderCgOverlayBox(l, data.server_time, { cgContent: data.cg_content }))}
              </div>
            </div>
            <div className="kx-bus-actions four">
              <button
                type="button"
                className="kx-bus-btn play-prog"
                disabled={!can('operator') || !selectedCg}
                onClick={() => selectedCg && (hasVisualStudio ? takeCgLayer(selectedCg.id, cgDraft) : save('cg', { ...cgDraft, active: 1 }, selectedCg.id))}
              >
                PLAY PROGRAM
              </button>
              <button
                type="button"
                className="kx-bus-btn stop"
                disabled={!can('operator') || !selectedCg}
                onClick={() => selectedCg && cutCgLayer(selectedCg.id)}
              >
                STOP
              </button>
              <button
                type="button"
                className="kx-bus-btn update"
                disabled={!can('editor') || !selectedCg}
                onClick={() => selectedCg && save('cg', { ...cgDraft }, selectedCg.id)}
              >
                UPDATE
              </button>
              <button
                type="button"
                className="kx-bus-btn clear"
                disabled={!can('operator')}
                onClick={clearAllOnAirCg}
              >
                CLEAR
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM 3-COLUMN CONTROLLER DECK: CG CATALOG | LAYERS - SELECTED CG | TARGETS / OUTPUT / STATUS */}
        <div className="kx-controller-lower">
          {/* BOTTOM LEFT: CG CATALOG */}
          <div className="kx-ctrl-pane catalog-pane">
            <div className="kx-ctrl-pane-head">
              <span>CG CATALOG <small>• {data.cg_templates?.length || 20} broadcast templates</small></span>
            </div>
            <div className="kx-catalog-tree">
              {CATALOG_GROUPS.map(grp => {
                const templates = (data.cg_templates || []).filter(t => grp.cats.includes(t.category));
                const isOpen = expandedGroups[grp.id];
                return (
                  <div key={grp.id} className="kx-tree-group">
                    <button
                      type="button"
                      className="kx-tree-group-head"
                      onClick={() => setExpandedGroups(g => ({ ...g, [grp.id]: !g[grp.id] }))}
                    >
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <strong>{grp.label}</strong>
                      <span>({templates.length})</span>
                    </button>
                    {isOpen && (
                      <div className="kx-tree-items">
                        {templates.map(tpl => {
                          const entitled = allowedCats.has(tpl.category);
                          const isCurrent = Number(cgDraft.template_id) === tpl.id;
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              className={`kx-tree-leaf ${isCurrent ? 'selected' : ''}`}
                              disabled={!entitled}
                              onClick={() => {
                                const matchingLayer = (data.cg || []).find(c => c.category === tpl.category);
                                if (matchingLayer) setSelectedCg(matchingLayer);
                                applyTemplateToDraft(tpl);
                              }}
                            >
                              <i style={{ background: tpl.accent || '#e11d72' }} />
                              <span>{tpl.name}</span>
                              {!entitled && <Lock size={11} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="kx-ctrl-pane-foot">
              <button type="button" className="kx-foot-btn" onClick={() => saveLayoutPreset()}>
                SAVE PRESET
              </button>
              <button type="button" className="kx-foot-btn" onClick={() => resetCgLayout()}>
                RELOAD
              </button>
              <button type="button" className="kx-foot-btn accent" onClick={() => switchMode('editor')}>
                DESIGNER
              </button>
            </div>
          </div>

          {/* BOTTOM CENTER: LAYERS - SELECTED CG / OVERLAYS / ON AIR / QUICK EDIT / CG SCHEDULER */}
          <div className="kx-ctrl-pane center-layers-pane">
            <div className="kx-ctrl-tabs">
              {[
                ['layers', `LAYERS - SELECTED CG (${compItems.length})`],
                ['overlays', `ALL OVERLAYS (${data.cg?.length || 0})`],
                ['on_air', `ON AIR (${activeOnAirLayers.length})`],
                ['quick_edit', 'QUICK EDIT'],
                ['scheduler', 'CG SCHEDULER']
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={controllerTab === k ? 'active' : ''}
                  onClick={() => setControllerTab(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="kx-ctrl-center-body">
              {controllerTab === 'layers' && (
                <div className="kx-ctrl-layer-cards">
                  {compItems.map(item => {
                    const isSel = selectedItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`kx-ctrl-layer-card ${isSel ? 'selected' : ''}`}
                        onClick={() => setSelectedItemId(item.id)}
                      >
                        <div className="kx-layer-mini-preview" style={{ borderColor: item.color || '#e11d72', background: item.bg_color || '#150d29' }}>
                          <span style={{ color: item.text_color || '#fff' }}>
                            {(item.type || 'ITEM').slice(0, 6).toUpperCase()}
                          </span>
                        </div>
                        <span className="kx-time-badge start">{Number(item.start_sec || 0).toFixed(2)}s</span>
                        <div className="kx-layer-card-info">
                          <strong>{item.name}</strong>
                          <small>{item.type} • {item.text || `${item.width}×${item.height}px (${item.x}, ${item.y})`}</small>
                        </div>
                        <span className="kx-time-badge dur">
                          {Number(item.duration_sec || 20).toFixed(2)}s
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {(controllerTab === 'overlays' || controllerTab === 'on_air') && (
                <div className="kx-ctrl-layer-cards">
                  {(controllerTab === 'on_air' ? activeOnAirLayers : (data.cg || [])).map(layer => {
                    const entitled = allowedCats.has(layer.category);
                    const isSelected = selectedCg?.id === layer.id;
                    return (
                      <div
                        key={layer.id}
                        className={`kx-ctrl-layer-card ${isSelected ? 'selected' : ''} ${layer.effective_active ? 'live' : ''}`}
                        onClick={() => {
                          setSelectedCg(layer);
                          setCgDraft({ ...layer });
                        }}
                      >
                        <div className="kx-layer-mini-preview" style={{ borderColor: layer.color || '#e11d72', background: layer.bg_color || '#150d29' }}>
                          <span style={{ color: layer.text_color || '#fff' }}>
                            {(layer.category || 'CG').slice(0, 6).toUpperCase()}
                          </span>
                        </div>
                        <span className="kx-time-badge start">{Number(layer.start_offset_sec || 0).toFixed(2)}s</span>
                        <div className="kx-layer-card-info">
                          <strong>{layer.name}</strong>
                          <small>{ALL_LABELS[layer.category] || layer.category} • {layer.text || 'No headline text'}</small>
                        </div>
                        <span className="kx-time-badge dur">
                          {layer.duration_sec ? `${Number(layer.duration_sec).toFixed(1)}s` : 'HOLD'}
                        </span>
                        <div className="kx-layer-card-btns" onClick={(e) => e.stopPropagation()}>
                          {!entitled ? (
                            <span className="kx-lock-tag"><Lock size={11} /> Locked</span>
                          ) : layer.effective_active ? (
                            <button type="button" className="kx-act-btn danger" onClick={() => cutCgLayer(layer.id)}>
                              CUT OFF
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="kx-act-btn take"
                              onClick={() => hasVisualStudio ? takeCgLayer(layer.id, layer) : save('cg', { ...layer, active: 1 }, layer.id)}
                            >
                              TAKE AIR
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {controllerTab === 'quick_edit' && cgDraft && (
                <div className="kx-quick-edit-form">
                  <div className="kx-qe-grid">
                    <Field label="Layer Name">
                      <input value={cgDraft.name || ''} onChange={e => updateDraft({ name: e.target.value }, 'Edit Name')} />
                    </Field>
                    <Field label="Auto-Cut Duration (sec)">
                      <input type="number" min="0" value={cgDraft.duration_sec || 0} onChange={e => updateDraft({ duration_sec: Number(e.target.value) }, 'Edit Duration')} />
                    </Field>
                  </div>
                  <Field label="Primary Headline / Strap Text">
                    <textarea rows={2} value={cgDraft.text || ''} onChange={e => updateDraft({ text: e.target.value }, 'Edit Headline')} />
                  </Field>
                  <Field label="Secondary Subtext / Designation">
                    <input value={cgDraft.subtext || ''} onChange={e => updateDraft({ subtext: e.target.value }, 'Edit Subtext')} />
                  </Field>
                  <div className="kx-qe-actions">
                    {hasVisualStudio && (
                      <B variant="outline" icon={Save} onClick={() => savePreviewCg(selectedCg.id, cgDraft)}>
                        Save to Preview Bus
                      </B>
                    )}
                    <B
                      variant="primary"
                      icon={Zap}
                      onClick={() => hasVisualStudio ? takeCgLayer(selectedCg.id, cgDraft) : save('cg', { ...cgDraft, active: 1 }, selectedCg.id)}
                    >
                      TAKE TO PROGRAM AIR
                    </B>
                  </div>
                </div>
              )}

              {controllerTab === 'scheduler' && (
                <div className="kx-quick-edit-form">
                  <div className="kx-qe-grid">
                    <Field label="CG Event Title">
                      <input
                        placeholder="e.g. 8 PM Headline Lower Third"
                        value={schedName}
                        onChange={e => setSchedName(e.target.value)}
                      />
                    </Field>
                    <Field label="Start Time (Nepal Time)">
                      <input
                        type="datetime-local"
                        value={schedStartsAt}
                        onChange={e => setSchedStartsAt(e.target.value)}
                      />
                    </Field>
                    <Field label="On-Air Duration (sec)">
                      <input
                        type="number"
                        min="5"
                        value={schedDurSec}
                        onChange={e => setSchedDurSec(Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <div className="kx-qe-actions">
                    <B
                      variant="primary"
                      icon={Plus}
                      disabled={!selectedCg || !entitlements?.cg_scheduling}
                      onClick={async () => {
                        if (!selectedCg) return;
                        await save('schedules', {
                          name: schedName || `${selectedCg.name} Auto-Take`,
                          kind: 'cg',
                          target_id: selectedCg.id,
                          starts_at: asKtmIso(schedStartsAt),
                          duration_sec: Number(schedDurSec || 60),
                          repeat: 'none',
                          priority: 75,
                          enabled: 1
                        });
                        setSchedName('');
                        notifyToast?.('Scheduled CG event armed');
                      }}
                    >
                      Schedule Selected CG Layer
                    </B>
                  </div>
                </div>
              )}
            </div>

            {selectedCg && (
              <div className="kx-ctrl-selected-footer">
                <strong>{selectedItem ? `${selectedItem.name} (${selectedItem.type})` : selectedCg.name}</strong>
                <span>
                  PLAY routes the complete selected CG project ({compItems.length} items) as one composition • ({cgDraft.position_x || 0}, {cgDraft.position_y || 0})
                </span>
              </div>
            )}
          </div>

          {/* BOTTOM RIGHT: TARGETS / OUTPUT / STATUS */}
          <div className="kx-ctrl-pane targets-pane">
            <div className="kx-ctrl-tabs">
              {[['targets', 'TARGETS'], ['output', 'OUTPUT'], ['status', 'STATUS']].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={targetTab === k ? 'active' : ''}
                  onClick={() => setTargetTab(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="kx-targets-body">
              {targetTab === 'targets' && (
                <div className="kx-target-list">
                  <label className="kx-target-item active">
                    <input type="checkbox" checked readOnly />
                    <div>
                      <strong>KASHTRIX_MAIN <span className="green">CLOUD PLAYOUT</span></strong>
                      <small>KTX-PLAYOUT-01 • {data.settings?.resolution || '1080p'}@{data.settings?.fps || 25}fps</small>
                    </div>
                  </label>
                  {(data.outputs || []).map(out => (
                    <label key={out.id} className={`kx-target-item ${out.enabled ? 'active' : ''}`}>
                      <input type="checkbox" checked={Boolean(out.enabled)} readOnly />
                      <div>
                        <strong>{out.name} <span className={out.enabled ? 'green' : 'muted'}>{out.protocol?.toUpperCase()}</span></strong>
                        <small>{out.url}</small>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {targetTab === 'output' && (
                <div className="kx-target-list">
                  <div className="kx-stat-kv"><span>Output Resolution</span><strong>{data.settings?.width || 1920}×{data.settings?.height || 1080} ({data.settings?.resolution || '1080p'})</strong></div>
                  <div className="kx-stat-kv"><span>Frame Rate</span><strong>{data.settings?.fps || 25} fps</strong></div>
                  <div className="kx-stat-kv"><span>Video Bitrate</span><strong>{data.settings?.video_bitrate || '4500k'}</strong></div>
                  <div className="kx-stat-kv"><span>Active CG Layers</span><strong>{activeOnAirLayers.length} / {entitlements?.cg_categories?.length || 20}</strong></div>
                </div>
              )}

              {targetTab === 'status' && (
                <div className="kx-target-list">
                  <div className="kx-stat-kv"><span>Broadcast Core</span><strong className="green">ONLINE</strong></div>
                  <div className="kx-stat-kv"><span>Auto Music CG</span><strong>{data.music_cg_settings?.enabled ? 'ARMED' : 'OFF'}</strong></div>
                  <div className="kx-stat-kv"><span>Auto Programme CG</span><strong>{data.programme_cg_settings?.enabled ? 'ARMED' : 'OFF'}</strong></div>
                  <div className="kx-stat-kv"><span>Active Plan</span><strong>{data.subscription?.plan_name}</strong></div>
                </div>
              )}
            </div>

            <div className="kx-ctrl-pane-foot two">
              <button type="button" className="kx-foot-btn" onClick={() => setTab('streaming')}>
                CONFIGURE OUTPUTS
              </button>
              <button type="button" className="kx-foot-btn danger" onClick={clearAllOnAirCg}>
                CLEAR ALL ON AIR
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MODE 1: KASHTRIX CG BROADCAST EDITOR (16:9 CANVAS + INSPECTOR + MULTI-TRACK ITEM TIMELINE)
  // ============================================================================
  return (
    <div className="kx-cg-editor-suite">
      {/* TOP BAR */}
      <header className="kx-cg-topbar">
        <div className="kx-cg-brand">
          <button type="button" className="kx-studio-nav-btn back" onClick={() => setTab?.('dashboard')} title="Back to Overview">
            ← Overview
          </button>
          <button type="button" className="kx-studio-nav-btn" onClick={() => setTab?.('playout')} title="Open Playout Console">
            Playout
          </button>
          <span className="kx-cg-logo-badge"><Sparkles size={15} /></span>
          <div>
            <strong>KASHTRIX CG</strong>
            <small>BROADCAST EDITOR</small>
          </div>
        </div>

        <div className="kx-cg-mode-Dynamic">
          <button type="button" className="kx-mode-pill active" onClick={() => switchMode('editor')}>
            1. CG BROADCAST EDITOR (CANVAS)
          </button>
          <button type="button" className="kx-mode-pill" onClick={() => switchMode('controller')}>
            2. CG LIVE CONTROLLER (SWITCHER)
          </button>
        </div>

        <div className="kx-cg-filter-bar">
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="all">ALL ({data.cg?.length || 20} TEMPLATES)</option>
            {ALL_KEYS.map(k => (
              <option key={k} value={k}>{ALL_LABELS[k] || k}</option>
            ))}
          </select>
          <div className="kx-cg-search">
            <Search size={13} />
            <input
              placeholder="Search CG templates..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        <div className="kx-cg-top-actions">
          <button
            type="button"
            className="kx-top-btn"
            disabled={!can('editor')}
            onClick={() => { setNewCompName(''); setNewCompCat('ticker'); setNewCompTplId(''); setNewCompOpen(true); }}
            title="Create a new CG composition / graphics design"
          >
            <Plus size={13} /> NEW
          </button>
          <button
            type="button"
            className="kx-top-btn"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title={`Undo (Ctrl+Z)${undoStack.length ? ` — ${undoStack[undoStack.length - 1].label}` : ''}`}
          >
            <Undo2 size={13} /> UNDO
          </button>
          <button
            type="button"
            className="kx-top-btn"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title={`Redo (Ctrl+Y)${redoStack.length ? ` — ${redoStack[redoStack.length - 1].label}` : ''}`}
          >
            <Redo2 size={13} /> REDO
          </button>
          {hasVisualStudio && selectedCg && (
            <button
              type="button"
              className="kx-top-btn"
              onClick={() => savePreviewCg(selectedCg.id, cgDraft)}
              title="Save in isolated Preview state without changing live output"
            >
              SAVE PREVIEW
            </button>
          )}
          <button
            type="button"
            className="kx-top-btn"
            disabled={!can('editor') || !selectedCg}
            onClick={() => selectedCg && save('cg', cgDraft, selectedCg.id)}
          >
            SAVE
          </button>
          {can('editor') && (
            <button
              type="button"
              className="kx-top-btn"
              onClick={() => {
                const tplId = cgDraft.template_id || data.cg_templates?.[0]?.id || 1;
                saveAsNewTemplate(tplId, cgDraft);
              }}
            >
              SAVE AS TEMPLATE
            </button>
          )}
          {hasVisualStudio && (
            <button type="button" className="kx-top-btn" onClick={() => saveLayoutPreset()}>
              SAVE PRESET
            </button>
          )}
          <button type="button" className="kx-top-btn" onClick={clearEditorCanvas}>
            CLEAR CANVAS
          </button>
          <button
            type="button"
            className="kx-top-btn take-air"
            disabled={!can('operator') || !selectedCg}
            onClick={() => {
              if (!selectedCg) return;
              if (hasVisualStudio) {
                takeCgLayer(selectedCg.id, cgDraft);
              } else {
                save('cg', { ...cgDraft, active: 1 }, selectedCg.id);
              }
            }}
          >
            TAKE ON AIR
          </button>
        </div>
      </header>

      {/* MAIN 3-COLUMN WORKSPACE: LAYERS & SOURCES | 1920x1080 CANVAS | INSPECTOR / PROPERTIES */}
      <div className="kx-editor-main-grid">
        {/* LEFT COLUMN: LAYERS & SOURCES */}
        <aside className="kx-editor-left">
          <div className="kx-pane-title-row">
            <span>LAYERS & SOURCES</span>
            <button type="button" className="kx-xs-btn" onClick={() => resetCgLayout()}>RESET</button>
          </div>

          <div className="kx-left-subtabs">
            <button
              type="button"
              className={leftTab === 'cg_item' ? 'active' : ''}
              onClick={() => setLeftTab('cg_item')}
            >
              ITEMS ({compItems.length})
            </button>
            <button
              type="button"
              className={leftTab === 'cg_layers' ? 'active' : ''}
              onClick={() => setLeftTab('cg_layers')}
            >
              LAYERS ({filteredLayers.length})
            </button>
            <button
              type="button"
              className={leftTab === 'cg_templates' ? 'active' : ''}
              onClick={() => setLeftTab('cg_templates')}
            >
              TEMPLATES ({(data.cg_templates || []).length})
            </button>
          </div>

          {leftTab === 'cg_item' ? (
            <div className="kx-cg-items-palette">
              <small className="kx-palette-title">CREATE CG ITEMS (CLICK TO ADD TO TIMELINE)</small>
              <div className="kx-cg-item-grid">
                {CG_ELEMENT_TYPES.map(spec => (
                  <button
                    key={spec.type}
                    type="button"
                    className="kx-cg-item-chip"
                    onClick={() => handleAddCgItem(spec)}
                    title={`Add ${spec.type} track to current CG composition`}
                  >
                    <i style={{ width: 7, height: 7, borderRadius: '50%', background: spec.color, display: 'inline-block', marginRight: 5 }} />
                    <span>+ {spec.label}</span>
                  </button>
                ))}
              </div>

              <small className="kx-palette-title" style={{ marginTop: 12 }}>
                COMPOSITION ITEMS — {selectedCg?.name || 'ACTIVE PROJECT'}
              </small>
              <div className="kx-layer-stack-scroll" style={{ maxHeight: 240 }}>
                {compItems.map(item => {
                  const isSel = selectAllActive || selectedItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`kx-editor-layer-row ${isSel ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectAllActive(false);
                        setSelectedItemId(item.id);
                      }}
                    >
                      <span className="kx-color-bar" style={{ background: item.color || '#e11d72' }} />
                      <div className="kx-layer-row-copy">
                        <strong>{item.name}</strong>
                        <small>
                          {item.type} • ({item.x ?? 0}, {item.y ?? 0}) • {Number(item.start_sec || 0).toFixed(1)}s–{(Number(item.start_sec || 0) + Number(item.duration_sec || 20)).toFixed(1)}s
                        </small>
                      </div>
                      <div className="kx-layer-row-badges">
                        <span className="kx-mini-pill amber">{item.type}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {data.cg_layout_presets?.length > 0 && (
                <div className="kx-presets-section">
                  <small className="kx-palette-title">SAVED LAYOUT PRESETS</small>
                  {data.cg_layout_presets.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="kx-preset-row-btn"
                      onClick={() => applyLayoutPreset(p.id)}
                    >
                      <Layers size={12} />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : leftTab === 'cg_layers' ? (
            <div className="kx-layer-stack-scroll">
              {filteredLayers.map(layer => {
                const entitled = allowedCats.has(layer.category);
                const hasPreview = (data.cg_preview_states || []).some(p => p.layer_id === layer.id);
                const isSelected = selectedCg?.id === layer.id;
                return (
                  <div
                    key={layer.id}
                    className={`kx-editor-layer-row ${isSelected ? 'selected' : ''} ${!entitled ? 'locked' : ''}`}
                    onClick={() => {
                      setSelectedCg(layer);
                      setCgDraft({ ...layer });
                    }}
                  >
                    <span className="kx-color-bar" style={{ background: layer.color || '#e11d72' }} />
                    <div className="kx-layer-row-copy">
                      <strong>{layer.name}</strong>
                      <small>
                        {ALL_LABELS[layer.category] || layer.category} • ({layer.position_x ?? 0}, {layer.position_y ?? 0})
                      </small>
                    </div>
                    <div className="kx-layer-row-badges" onClick={e => e.stopPropagation()}>
                      {hasPreview && <span className="kx-mini-pill amber">PVW</span>}
                      {!entitled ? (
                        <span className="kx-mini-pill locked"><Lock size={10} /></span>
                      ) : (
                        <span className={`kx-mini-pill ${layer.effective_active ? 'live' : 'off'}`}>
                          {layer.effective_active ? '● LIVE' : 'OFF'}
                        </span>
                      )}
                      {can('editor') && (
                        <button
                          type="button"
                          className="kx-xs-btn danger"
                          title="Delete CG Layer"
                          onClick={() => del('cg', layer.id)}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="kx-layer-stack-scroll">
              <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small className="kx-palette-title" style={{ margin: 0 }}>SAVED CG TEMPLATES</small>
                {can('editor') && selectedCg && (
                  <button
                    type="button"
                    className="kx-xs-btn"
                    onClick={() => {
                      const tplId = cgDraft.template_id || data.cg_templates?.[0]?.id || 1;
                      saveAsNewTemplate(tplId, cgDraft);
                    }}
                  >
                    + SAVE CURRENT
                  </button>
                )}
              </div>
              {(data.cg_templates || []).map(tpl => (
                <div key={tpl.id} className="kx-editor-layer-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="kx-color-bar" style={{ background: tpl.accent || '#e11d72' }} />
                    <div className="kx-layer-row-copy" style={{ flex: 1 }}>
                      {editingTplId === tpl.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            value={editingTplName}
                            onChange={e => setEditingTplName(e.target.value)}
                            style={{ fontSize: 11, padding: '2px 6px', flex: 1 }}
                          />
                          <button
                            type="button"
                            className="kx-xs-btn"
                            onClick={async () => {
                              await save('cg_templates', { ...tpl, name: editingTplName || tpl.name }, tpl.id, `Renamed template "${editingTplName}"`);
                              setEditingTplId(null);
                            }}
                          >Save</button>
                        </div>
                      ) : (
                        <strong>{tpl.name}</strong>
                      )}
                      <small>{ALL_LABELS[tpl.category] || tpl.category} • {tpl.width || 680}×{tpl.height || 130}</small>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button type="button" className="kx-xs-btn" onClick={() => applyTemplateToDraft(tpl)} title="Apply template style to selected layer">
                      Apply
                    </button>
                    {can('editor') && (
                      <>
                        <button
                          type="button"
                          className="kx-xs-btn"
                          onClick={() => save('cg', {
                            name: `${tpl.name} Copy`,
                            category: tpl.category,
                            text: tpl.sample_text || tpl.name,
                            subtext: tpl.sample_subtext || '',
                            color: tpl.accent || '#e11d72',
                            bg_color: tpl.bg_color || '#150d29',
                            text_color: tpl.text_color || '#ffffff',
                            gradient: tpl.gradient || '',
                            font_family: tpl.font_family || FONT_FAMILIES[0],
                            font_size: tpl.font_size || 32,
                            font_weight: tpl.font_weight || '700',
                            text_align: tpl.text_align || 'left',
                            position_x: tpl.position_x ?? 40,
                            position_y: tpl.position_y ?? 820,
                            width: tpl.width ?? 680,
                            height: tpl.height ?? 130,
                            z_index: tpl.z_index ?? 15,
                            opacity: tpl.opacity ?? 0.95,
                            border_radius: tpl.border_radius ?? 12,
                            border_width: tpl.border_width ?? 2,
                            border_color: tpl.border_color || tpl.accent || '#e11d72',
                            animation: tpl.animation || 'slide',
                            speed: tpl.speed || 100,
                            template_id: tpl.id,
                            style_json: tpl.style_json || '',
                            active: 0
                          }, null, `Created new layer from "${tpl.name}"`)}
                          title="Create new CG layer from this template"
                        >
                          + Layer
                        </button>
                        <button
                          type="button"
                          className="kx-xs-btn"
                          onClick={() => save('cg_templates', {
                            ...tpl,
                            accent: cgDraft.color || tpl.accent,
                            bg_color: cgDraft.bg_color || tpl.bg_color,
                            text_color: cgDraft.text_color || tpl.text_color,
                            gradient: cgDraft.gradient ?? tpl.gradient,
                            font_family: cgDraft.font_family || tpl.font_family,
                            font_size: cgDraft.font_size || tpl.font_size,
                            position_x: cgDraft.position_x ?? tpl.position_x,
                            position_y: cgDraft.position_y ?? tpl.position_y,
                            width: cgDraft.width ?? tpl.width,
                            height: cgDraft.height ?? tpl.height,
                            style_json: cgDraft.style_json || tpl.style_json || '',
                            sample_text: cgDraft.text || tpl.sample_text || '',
                            sample_subtext: cgDraft.subtext || tpl.sample_subtext || ''
                          }, tpl.id, `Updated template "${tpl.name}" with current design`)}
                          title="Update this template with current canvas design"
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          className="kx-xs-btn"
                          onClick={() => { setEditingTplId(tpl.id); setEditingTplName(tpl.name); }}
                          title="Rename template"
                        >
                          <Edit3 size={10} />
                        </button>
                        <button
                          type="button"
                          className="kx-xs-btn danger"
                          onClick={() => del('cg_templates', tpl.id)}
                          title="Delete template"
                        >
                          <Trash2 size={10} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* CENTER COLUMN: PROGRAM GRAPHICS PREVIEW — 1920x1080 DESIGN CANVAS */}
        <section className="kx-editor-center">
          <div className="kx-canvas-toolbar">
            <div className="kx-canvas-title">
              <strong>PROGRAM GRAPHICS PREVIEW (16:9 WIDESCREEN)</strong>
              <small>{selectedCg ? `${selectedCg.name} • ` : ''}{compItems.length} CG Items ({data.settings?.resolution || '1080p'} @ {data.settings?.fps || 25} fps)</small>
            </div>

            {/* Canvas Edit Actions: Select All, Copy, Cut, Paste, Duplicate, Delete, Nudge */}
            <div className="kx-canvas-controls" style={{ flexWrap: 'wrap', gap: 5 }}>
              <button
                type="button"
                className={`kx-xs-btn ${selectAllActive ? 'active' : ''}`}
                onClick={handleSelectAll}
                title="Select All CG Items on Canvas (Ctrl+A)"
              >
                <CheckSquare size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                SELECT ALL
              </button>
              <button
                type="button"
                className={`kx-xs-btn ${isGrouped ? 'active' : ''}`}
                onClick={handleToggleGroup}
                title="Toggle Group / Ungroup layers (Ctrl+G)"
              >
                <Layers size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                {isGrouped ? 'UNGROUP' : 'GROUP'}
              </button>
              <button
                type="button"
                className="kx-xs-btn"
                onClick={handleCopySelected}
                title="Copy Selected CG Item / Layer (Ctrl+C)"
              >
                <Copy size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                COPY
              </button>
              <button
                type="button"
                className="kx-xs-btn"
                onClick={handleCutSelected}
                title="Cut Selected CG Item / Layer (Ctrl+X)"
              >
                <Scissors size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                CUT
              </button>
              <button
                type="button"
                className="kx-xs-btn"
                onClick={handlePasteClipboard}
                title="Paste CG Item / Layer from Clipboard (Ctrl+V)"
              >
                <ClipboardPaste size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                PASTE
              </button>
              <button
                type="button"
                className="kx-xs-btn"
                onClick={handleDuplicateSelected}
                title="Duplicate Selected CG Item (Ctrl+D)"
              >
                DUP
              </button>
              <button
                type="button"
                className="kx-xs-btn"
                onClick={handleDeleteSelected}
                title="Delete Selected CG Item (Del)"
              >
                <Trash2 size={11} />
              </button>

              <div className="kx-zoom-group" title="Move / Nudge Selected Element">
                <button type="button" onClick={() => nudgeSelected(-10, 0)} title="Move Left 10px"><ArrowLeft size={11} /></button>
                <button type="button" onClick={() => nudgeSelected(0, -10)} title="Move Up 10px"><ArrowUp size={11} /></button>
                <button type="button" onClick={() => nudgeSelected(0, 10)} title="Move Down 10px"><ArrowDown size={11} /></button>
                <button type="button" onClick={() => nudgeSelected(10, 0)} title="Move Right 10px"><ArrowRight size={11} /></button>
              </div>

              <div className="kx-zoom-group">
                <button type="button" onClick={() => setZoomPct(z => Math.max(60, z - 10))}>-</button>
                <span>{zoomPct}%</span>
                <button type="button" onClick={() => setZoomPct(z => Math.min(125, z + 10))}>+</button>
                <button type="button" onClick={() => setZoomPct(100)}>FIT</button>
              </div>
              <label className="kx-chk-label">
                <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
                <span>GRID</span>
              </label>
              <label className="kx-chk-label">
                <input type="checkbox" checked={showSafeGuides} onChange={e => setShowSafeGuides(e.target.checked)} />
                <span>SAFE</span>
              </label>
              <label className="kx-chk-label">
                <input type="checkbox" checked={showLiveBg} onChange={e => setShowLiveBg(e.target.checked)} />
                <span>LIVE BG</span>
              </label>
              <button type="button" className="kx-xs-btn" onClick={centerSelectedLayer}>
                CENTER
              </button>
            </div>
          </div>

          <div className="kx-canvas-viewport-outer">
            <div
              ref={canvasRef}
              className={`kx-canvas-1080p ${showGrid ? 'with-grid' : ''} ${!showLiveBg ? 'checkerboard' : ''}`}
              style={{ transform: `scale(${zoomPct / 100})` }}
            >
              {showLiveBg && (
                <LiveVideoSurface data={data} allowFallbackMedia={true} showAudioToggle={false} />
              )}

              {showSafeGuides && (
                <>
                  <div className="kx-safe-box action"><span>ACTION SAFE 5%</span></div>
                  <div className="kx-safe-box title"><span>TITLE SAFE 10%</span></div>
                  <div className="kx-center-crosshair-h" />
                  <div className="kx-center-crosshair-v" />
                </>
              )}

              <div className="stage-cg-overlay-plane">
                {canvasLayers.map(layer => {
                  const isSel = layer.isSelected || selectAllActive;
                  return renderCgOverlayBox(layer, data.server_time, {
                    cgContent: data.cg_content,
                    className: `studio-draggable ${isSel ? 'selected-in-studio' : ''}`,
                    zBoost: isSel ? 100 : 0,
                    onMouseDown: (e) => startLayerDrag(e, layer, 'move'),
                    headerBadge: isSel ? (
                      <div className="cg-drag-handle-bar">
                        <span><Move size={10} /> {layer.name} ({layer.position_x ?? 0}, {layer.position_y ?? 0}) — {layer.width ?? 680}×{layer.height ?? 110}</span>
                      </div>
                    ) : null,
                    resizeHandle: isSel && !layer.locked ? (
                      <div
                        className="cg-resize-corner"
                        onMouseDown={(e) => startLayerDrag(e, layer, 'resize')}
                        title="Drag to resize width & height"
                      />
                    ) : null
                  });
                })}

                {/* Render individual CG Composition Items (Shape, Text, Image, PNG Sequence, Ticker, etc.) */}
                {visibleCustomItems.map((item, idx) => {
                  const isItemSel = selectAllActive || selectedItemId === item.id;
                  const leftPct = Math.max(0, Math.min(98, (Number(item.x || 0) / 1920) * 100));
                  const topPct = Math.max(0, Math.min(96, (Number(item.y || 0) / 1080) * 100));
                  const widthPct = Math.max(3, Math.min(100 - leftPct, (Number(item.width || 300) / 1920) * 100));
                  const heightPct = Math.max(1.5, Math.min(100 - topPct, (Number(item.height || 70) / 1080) * 100));
                  const isImagePath = item.type === 'Image' && (String(item.text || '').startsWith('/') || String(item.text || '').startsWith('http'));

                  return (
                    <div
                      key={item.id}
                      className={`cg-live-layer studio-draggable ${isItemSel ? 'selected-in-studio' : ''}`}
                      onMouseDown={(e) => startCustomItemDrag(e, item, 'move')}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                        zIndex: 120 + idx + (isItemSel ? 30 : 0),
                        background: isImagePath ? 'transparent' : (item.type === 'Text' ? (item.bg_color || 'transparent') : (item.bg_color || '#160d2d')),
                        color: item.text_color || '#ffffff',
                        opacity: item.opacity ?? 1,
                        borderRadius: item.type === 'Ellipse' ? '999px' : (isImagePath ? '0px' : '6px'),
                        border: isItemSel ? `2px solid ${item.color || '#38bdf8'}` : (isImagePath ? 'none' : `1px solid ${item.color || '#38bdf8'}44`),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: (item.type === 'Ellipse' || isImagePath) ? 'center' : 'flex-start',
                        padding: isImagePath ? '0px' : '4px 12px',
                        boxShadow: isImagePath ? 'none' : '0 6px 18px rgba(0,0,0,0.35)',
                        cursor: item.locked ? 'not-allowed' : 'move',
                        overflow: 'visible'
                      }}
                    >
                      {isItemSel && (
                        <div className="cg-drag-handle-bar">
                          <span><Move size={10} /> [{item.type}] {item.name} ({item.x}, {item.y}) — {item.width}×{item.height}</span>
                        </div>
                      )}
                      {isImagePath ? (
                        <img
                          src={item.text}
                          alt={item.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            display: 'block',
                            pointerEvents: 'none',
                            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))'
                          }}
                        />
                      ) : item.type === 'Shape' && !item.text ? null : isRichHtml(item.text) ? (
                        <div
                          className={`kx-rich-cg-html ${item.type === 'Ticker' || item.animation === 'scroll-left' ? 'ticker-scroll' : ''}`}
                          style={{
                            fontSize: `clamp(9px, ${Math.max(0.6, ((item.font_size || 24) / 1080) * 40)}vw, 24px)`,
                            fontFamily: item.font_family || 'Inter, DM Sans, sans-serif',
                            color: item.text_color || '#ffffff',
                            width: '100%',
                            pointerEvents: 'none'
                          }}
                          dangerouslySetInnerHTML={{ __html: sanitizeBroadcastHtml(item.text) }}
                        />
                      ) : (
                        <strong
                          style={{
                            fontSize: `clamp(9px, ${Math.max(0.6, ((item.font_size || 24) / 1080) * 40)}vw, 24px)`,
                            fontFamily: item.font_family || 'Inter, DM Sans, sans-serif',
                            color: item.text_color || '#ffffff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            pointerEvents: 'none'
                          }}
                        >
                          <AnimatedBroadcastText
                            text={item.type === 'Timer' ? `${clock(data.server_time)} NPT` : (item.text || item.name)}
                            animation={item.animation || 'none'}
                          />
                        </strong>
                      )}
                      {isItemSel && !item.locked && (
                        <div
                          className="cg-resize-corner"
                          onMouseDown={(e) => startCustomItemDrag(e, item, 'resize')}
                          title="Drag to resize CG item"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BOTTOM CANVAS TRANSPORT SCRUBBER */}
          <div className="kx-canvas-scrubber-bar">
            <button
              type="button"
              className="kx-mini-btn icon"
              onClick={() => setTimelinePlaying(p => !p)}
            >
              {timelinePlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <input
              type="range"
              className="kx-scrub-slider"
              min="0"
              max={timelineMaxSec}
              step="0.05"
              value={playheadSec}
              onChange={(e) => setPlayheadSec(Number(e.target.value))}
            />
            <span className="kx-scrubber-tc">00:{playheadSec.toFixed(2).padStart(5, '0')}</span>
            <label className="kx-chk-label">
              <input type="checkbox" checked={timelineLoop} onChange={e => setTimelineLoop(e.target.checked)} />
              <span>LOOP</span>
            </label>
          </div>
        </section>

        {/* RIGHT COLUMN: INSPECTOR / PROPERTIES */}
        <aside className="kx-editor-right">
          <div className="kx-pane-title-row">
            <span>INSPECTOR / PROPERTIES</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="kx-xs-btn"
                onClick={handleDuplicateSelected}
                title="Duplicate Selected Item or Layer (Ctrl+D)"
              >
                DUPLICATE
              </button>
            </div>
          </div>

          <div className="kx-inspector-tabs">
            {[
              ['layer', 'ELEMENT'],
              ['effects', 'STYLE & COLORS'],
              ['data', 'DATA / CMS'],
              ['composition', 'COMPOSITION']
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={inspectorTab === k ? 'active' : ''}
                onClick={() => setInspectorTab(k)}
              >
                {label}
              </button>
            ))}
          </div>

          {selectedCg && cgDraft ? (
            <div className="kx-inspector-scroll">
              <div className="kx-selected-el-head">
                <strong>
                  SELECTED: {selectedItem ? `${selectedItem.name} [${selectedItem.type}]` : cgDraft.name}
                </strong>
                <small>
                  {selectedItem
                    ? `Editing ${selectedItem.type} track inside "${cgDraft.name}". Drag on canvas or timeline to adjust.`
                    : 'Properties, transforms, typography, colors, and animation for the selected CG layer.'}
                </small>
              </div>

              {inspectorTab === 'layer' && (
                <div className="kx-prop-section">
                  {selectedItem && (
                    <>
                      <div className="kx-prop-sec-title">SELECTED CG ITEM ({selectedItem.type.toUpperCase()})</div>
                      <div className="kx-prop-grid two">
                        <Field label="Item Name">
                          <input
                            value={selectedItem.name || ''}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, name: e.target.value } : it))}
                          />
                        </Field>
                        <Field label="CG Item Type">
                          <select
                            value={selectedItem.type || 'Text'}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, type: e.target.value } : it))}
                          >
                            {CG_ELEMENT_TYPES.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
                          </select>
                        </Field>
                      </div>
                      <div className="kx-prop-grid four">
                        <Field label="Item X">
                          <input
                            type="number"
                            value={selectedItem.x ?? 0}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, x: Number(e.target.value) } : it))}
                          />
                        </Field>
                        <Field label="Item Y">
                          <input
                            type="number"
                            value={selectedItem.y ?? 0}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, y: Number(e.target.value) } : it))}
                          />
                        </Field>
                        <Field label="Width">
                          <input
                            type="number"
                            value={selectedItem.width ?? 300}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, width: Number(e.target.value) } : it))}
                          />
                        </Field>
                        <Field label="Height">
                          <input
                            type="number"
                            value={selectedItem.height ?? 60}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, height: Number(e.target.value) } : it))}
                          />
                        </Field>
                      </div>
                      <div className="kx-prop-grid three">
                        <Field label="Start (sec)">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={selectedItem.start_sec ?? 0}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, start_sec: Number(e.target.value) } : it))}
                          />
                        </Field>
                        <Field label="Duration (sec)">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={selectedItem.duration_sec ?? 20}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, duration_sec: Number(e.target.value) } : it))}
                          />
                        </Field>
                        <Field label="Track Color">
                          <input
                            type="color"
                            value={selectedItem.color || '#38bdf8'}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, color: e.target.value } : it))}
                          />
                        </Field>
                      </div>
                      <Field label="Rich Text / Inline Logo Content">
                        <RichBroadcastEditor
                          value={selectedItem.text || ''}
                          mediaList={data.media || []}
                          minHeight={68}
                          onChange={(html) => updateCompositionItems(
                            prev => prev.map(it => it.id === selectedItem.id ? { ...it, text: html } : it),
                            { label: 'Edit Item Content', coalesceMs: 450 }
                          )}
                        />
                      </Field>
                      <div className="kx-prop-grid four">
                        <Field label="Font Size">
                          <input
                            type="number"
                            min="10"
                            max="120"
                            value={selectedItem.font_size ?? 24}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, font_size: Number(e.target.value) } : it))}
                          />
                        </Field>
                        <Field label="Text Color">
                          <input
                            type="color"
                            value={selectedItem.text_color || '#ffffff'}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, text_color: e.target.value } : it))}
                          />
                        </Field>
                        <Field label="Fill Color">
                          <input
                            type="color"
                            value={(selectedItem.bg_color && selectedItem.bg_color.startsWith('#')) ? selectedItem.bg_color : '#160d2d'}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, bg_color: e.target.value } : it))}
                          />
                        </Field>
                        <Field label="Opacity">
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={selectedItem.opacity ?? 1}
                            onChange={e => updateCompositionItems(prev => prev.map(it => it.id === selectedItem.id ? { ...it, opacity: Number(e.target.value) } : it))}
                          />
                        </Field>
                      </div>
                    </>
                  )}

                  <div className="kx-prop-sec-title" style={{ marginTop: 10 }}>MASTER TEMPLATE GEOMETRY (16:9)</div>
                  <div className="kx-prop-grid two">
                    <Field label="Composition Name">
                      <input value={cgDraft.name || ''} onChange={e => setCgDraft({ ...cgDraft, name: e.target.value })} />
                    </Field>
                    <Field label="Category">
                      <input value={ALL_LABELS[cgDraft.category] || cgDraft.category} readOnly />
                    </Field>
                  </div>
                  <div className="kx-prop-grid three">
                    <Field label="X (0–1920)">
                      <input type="number" min="0" max="1900" value={cgDraft.position_x ?? 48} onChange={e => updateDraft({ position_x: Number(e.target.value) }, 'Edit X')} />
                    </Field>
                    <Field label="Y (0–1080)">
                      <input type="number" min="0" max="1060" value={cgDraft.position_y ?? 800} onChange={e => updateDraft({ position_y: Number(e.target.value) }, 'Edit Y')} />
                    </Field>
                    <Field label="Z-Index">
                      <input type="number" min="1" max="100" value={cgDraft.z_index ?? 15} onChange={e => updateDraft({ z_index: Number(e.target.value) }, 'Edit Z-Index')} />
                    </Field>
                  </div>
                  <div className="kx-prop-grid three">
                    <Field label="Width (px)">
                      <input type="number" min="100" max="1920" value={cgDraft.width ?? 680} onChange={e => updateDraft({ width: Number(e.target.value) }, 'Edit Width')} />
                    </Field>
                    <Field label="Height (px)">
                      <input type="number" min="36" max="1080" value={cgDraft.height ?? 110} onChange={e => updateDraft({ height: Number(e.target.value) }, 'Edit Height')} />
                    </Field>
                    <Field label="Opacity (0–1)">
                      <input type="number" min="0.1" max="1" step="0.05" value={cgDraft.opacity ?? 0.94} onChange={e => updateDraft({ opacity: Number(e.target.value) }, 'Edit Opacity')} />
                    </Field>
                  </div>

                  <div className="kx-prop-sec-title" style={{ marginTop: 10 }}>HEADLINE & SUBTEXT CONTENT</div>
                  <Field label="Rich Broadcast Text (Fonts, Colors & Inline Logos)">
                    <RichBroadcastEditor
                      value={cgDraft.text || ''}
                      mediaList={data.media || []}
                      minHeight={72}
                      onChange={(html) => updateDraft({ text: html }, 'Edit Text')}
                    />
                  </Field>
                  <Field label="Secondary Subtext / Ticker Details">
                    <input value={cgDraft.subtext || ''} onChange={e => updateDraft({ subtext: e.target.value }, 'Edit Subtext')} />
                  </Field>
                </div>
              )}

              {inspectorTab === 'effects' && (
                <div className="kx-prop-section">
                  <div className="kx-prop-sec-title">TYPOGRAPHY & COLORS</div>
                  <Field label="Font Family">
                    <select value={cgDraft.font_family || FONT_FAMILIES[0]} onChange={e => updateDraft({ font_family: e.target.value }, 'Edit Font', 0)}>
                      <optgroup label="Broadcast Fonts">
                        {FONT_FAMILIES.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
                      </optgroup>
                      {projectFonts.length > 0 && (
                        <optgroup label="Project Font Folders">
                          {projectFonts.map(pf => (
                            <option key={`pf-${pf.family}-${pf.file}`} value={`'${pf.family}', sans-serif`}>{pf.family} ({pf.folder})</option>
                          ))}
                        </optgroup>
                      )}
                      {installedFonts.length > 0 && (
                        <optgroup label={`Installed System Fonts (${installedFonts.length})`}>
                          {installedFonts.map(sf => (
                            <option key={`sf-${sf}`} value={`'${sf}', sans-serif`}>{sf}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </Field>
                  <div className="kx-prop-grid three">
                    <Field label="Size (px)">
                      <input type="number" min="14" max="96" value={cgDraft.font_size ?? 32} onChange={e => updateDraft({ font_size: Number(e.target.value) }, 'Edit Font Size')} />
                    </Field>
                    <Field label="Weight">
                      <select value={cgDraft.font_weight || '700'} onChange={e => updateDraft({ font_weight: e.target.value }, 'Edit Font Weight', 0)}>
                        <option value="500">Medium 500</option>
                        <option value="600">SemiBold 600</option>
                        <option value="700">Bold 700</option>
                        <option value="800">ExtraBold 800</option>
                      </select>
                    </Field>
                    <Field label="Align">
                      <select value={cgDraft.text_align || 'left'} onChange={e => updateDraft({ text_align: e.target.value }, 'Edit Align', 0)}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </Field>
                  </div>

                  <div className="kx-prop-grid three">
                    <Field label="Accent">
                      <input type="color" value={cgDraft.color || '#e11d72'} onChange={e => updateDraft({ color: e.target.value, border_color: e.target.value }, 'Edit Accent Color')} />
                    </Field>
                    <Field label="BG Color">
                      <input type="color" value={cgDraft.bg_color || '#150d29'} onChange={e => updateDraft({ bg_color: e.target.value }, 'Edit BG Color')} />
                    </Field>
                    <Field label="Text Color">
                      <input type="color" value={cgDraft.text_color || '#ffffff'} onChange={e => updateDraft({ text_color: e.target.value }, 'Edit Text Color')} />
                    </Field>
                  </div>

                  <Field label="Gradient Preset">
                    <select value={cgDraft.gradient || ''} onChange={e => updateDraft({ gradient: e.target.value }, 'Edit Gradient', 0)}>
                      {GRADIENT_PRESETS.map(g => <option key={g.label} value={g.value}>{g.label}</option>)}
                    </select>
                  </Field>

                  <div className="kx-prop-sec-title" style={{ marginTop: 10 }}>ANIMATION & MOTION</div>
                  <div className="kx-prop-grid two">
                    <Field label="Animation Style">
                      <select value={cgDraft.animation || 'slide'} onChange={e => updateDraft({ animation: e.target.value }, 'Edit Animation', 0)}>
                        {ANIMATIONS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </Field>
                    <Field label="Scroll Speed">
                      <input type="number" min="10" max="250" value={cgDraft.speed ?? 85} onChange={e => updateDraft({ speed: Number(e.target.value) }, 'Edit Speed')} />
                    </Field>
                  </div>
                </div>
              )}

              {inspectorTab === 'data' && (
                <div className="kx-prop-section">
                  <div className="kx-prop-sec-title">DATA BINDING / CMS API & ASSETS</div>
                  <div className="kx-stat-kv" style={{ marginBottom: 8 }}>
                    <span>Editorial CMS API (`/api/cg_content`)</span>
                    <strong style={{ color: '#2dd4a0' }}>{(data.cg_content || []).length} Stories Ready</strong>
                  </div>
                  <Field label="Bind CMS Newsroom Story">
                    <select
                      value={cgDraft.content_id || ''}
                      onChange={e => {
                        const cid = e.target.value ? Number(e.target.value) : null;
                        const story = (data.cg_content || []).find(c => c.id === cid);
                        if (story) {
                          const newText = story.text || story.title;
                          const newSub = story.subtext || cgDraft.subtext;
                          updateDraft({ content_id: cid, text: newText, subtext: newSub }, 'Bind CMS Story', 0);
                          updateCompositionItems(prev => prev.map((it, idx) =>
                            (String(it.id).endsWith('_headline') || String(it.id).endsWith('_ticker_1') || it.type === 'Ticker' || idx === prev.length - 1)
                              ? { ...it, text: newText }
                              : it
                          ), { label: 'Sync CMS Text' });
                          notifyToast?.(`Connected CMS "${story.title}" to CG composition`);
                        } else {
                          updateDraft({ content_id: null }, 'Unbind CMS Story', 0);
                        }
                      }}
                    >
                      <option value="">Manual text entry (unbound)</option>
                      {(data.cg_content || []).map(c => (
                        <option key={c.id} value={c.id}>
                          [{c.category?.toUpperCase()}] {c.title} ({c.status})
                        </option>
                      ))}
                    </select>
                  </Field>
                  {cgDraft.content_id && (
                    <button
                      type="button"
                      className="btn sm primary"
                      style={{ width: '100%', marginBottom: 10, justifyContent: 'center' }}
                      onClick={() => {
                        const story = (data.cg_content || []).find(c => c.id === Number(cgDraft.content_id));
                        if (story) {
                          setCgDraft({
                            ...cgDraft,
                            text: story.text || story.title,
                            subtext: story.subtext || cgDraft.subtext
                          });
                        }
                      }}
                    >
                      Sync Latest Text from CMS API
                    </button>
                  )}
                  <Field label="Apply Broadcast Template">
                    <select
                      value={cgDraft.template_id || ''}
                      onChange={e => {
                        const tid = Number(e.target.value);
                        const tpl = (data.cg_templates || []).find(t => t.id === tid);
                        if (tpl) applyTemplateToDraft(tpl);
                      }}
                    >
                      <option value="">Custom styling</option>
                      {(data.cg_templates || []).filter(t => t.category === cgDraft.category).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </Field>
                  {['logo', 'sponsor'].includes(cgDraft.category) && (
                    <Field label="PNG / JPG Logo Asset">
                      <select value={cgDraft.image_media_id || ''} onChange={e => setCgDraft({ ...cgDraft, image_media_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Text Badge Mode</option>
                        {(data.media || []).filter(m => m.category === 'image' || m.mime?.includes('image')).map(m => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
              )}

              {inspectorTab === 'composition' && (
                <div className="kx-prop-section">
                  <div className="kx-prop-sec-title">COMPOSITION & SAFE ANCHORS</div>
                  <div className="kx-prop-grid two">
                    <Field label="Safe Zone Anchor">
                      <select value={cgDraft.safe_anchor || 'auto'} onChange={e => setCgDraft({ ...cgDraft, safe_anchor: e.target.value })}>
                        <option value="auto">Auto Safe Zone</option>
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-full">Bottom Full-Width</option>
                      </select>
                    </Field>
                    <Field label="Collision Priority">
                      <input type="number" min="1" max="100" value={cgDraft.priority ?? 50} onChange={e => setCgDraft({ ...cgDraft, priority: Number(e.target.value) })} />
                    </Field>
                  </div>
                  <div className="kx-prop-grid two">
                    <Field label="Border Radius (px)">
                      <input type="number" min="0" max="40" value={cgDraft.border_radius ?? 10} onChange={e => setCgDraft({ ...cgDraft, border_radius: Number(e.target.value) })} />
                    </Field>
                    <Field label="Border Width (px)">
                      <input type="number" min="0" max="10" value={cgDraft.border_width ?? 2} onChange={e => setCgDraft({ ...cgDraft, border_width: Number(e.target.value) })} />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="kx-inspector-empty">Select a CG layer to inspect properties</div>
          )}
        </aside>
      </div>

      {/* BOTTOM PANEL: MULTI-TRACK CG TIMELINE (COMPOSITION CG ITEMS: SHAPE, TEXT, IMAGE, PNG SEQUENCE, TICKER) */}
      <div className="kx-cg-timeline-dock">
        <div className="kx-timeline-header">
          <div className="kx-tl-left">
            <span className="kx-tl-title">TIMELINE</span>
            <button
              type="button"
              className={`kx-xs-btn ${timelineViewMode === 'items' ? 'active' : ''}`}
              onClick={() => setTimelineViewMode('items')}
            >
              CG ITEMS ({compItems.length})
            </button>
            <button
              type="button"
              className={`kx-xs-btn ${timelineViewMode === 'all_layers' ? 'active' : ''}`}
              onClick={() => setTimelineViewMode('all_layers')}
            >
              ALL TEMPLATES ({filteredLayers.length})
            </button>
            <span className="kx-tl-comp">{selectedCg ? `${selectedCg.name} Composition` : 'Master Composition'}</span>
          </div>

          <div className="kx-tl-right">
            <label className="kx-tl-dur">
              <span>DUR (S)</span>
              <input
                type="number"
                min="5"
                max="120"
                value={timelineMaxSec}
                onChange={e => setTimelineMaxSec(Math.max(5, Number(e.target.value || 20)))}
              />
            </label>
            <label className="kx-chk-label">
              <input type="checkbox" checked={autoKey} onChange={e => setAutoKey(e.target.checked)} />
              <span>AUTO KEY</span>
            </label>
            <span className="kx-tl-now">NOW <strong>00:{playheadSec.toFixed(2).padStart(5, '0')}</strong></span>
            <span className="kx-tl-left-tc">LEFT <strong>00:{Math.max(0, timelineMaxSec - playheadSec).toFixed(2).padStart(5, '0')}</strong></span>
          </div>
        </div>

        {!hasTimeline ? (
          <div className="kx-timeline-locked-banner">
            <div className="kx-tl-lock-copy">
              <Lock size={16} />
              <div>
                <strong>Multi-Track CG Timeline Editor is an Enterprise High-Tier Feature</strong>
                <span>Upgrade to Broadcast Plus (NPR 45,000/mo) or Graphics Automation Pro (NPR 60,000/mo) to unlock multi-layer timeline sequencing, start offsets, and keyframe timing.</span>
              </div>
            </div>
            <button type="button" className="btn sm primary" onClick={() => setTab('subscriptions')}>
              Upgrade Plan to Unlock CG Timeline
            </button>
          </div>
        ) : (
          <div className="kx-timeline-body">
            {/* Time Ruler — Click or Drag with Mouse to Scrub Playhead */}
            <div className="kx-tl-ruler-row">
              <div className="kx-tl-layer-col-head">
                {timelineViewMode === 'items' ? 'CG ITEMS (SHAPE / TEXT / SEQ)' : 'CHANNEL OVERLAYS'}
              </div>
              <div
                ref={rulerTrackRef}
                className="kx-tl-ruler-track"
                style={{ cursor: 'ew-resize', userSelect: 'none' }}
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                  setPlayheadSec(Number((ratio * timelineMaxSec).toFixed(2)));
                  setIsScrubbingPlayhead(true);
                }}
              >
                {Array.from({ length: 21 }).map((_, idx) => {
                  const sec = ((timelineMaxSec / 20) * idx).toFixed(1);
                  return (
                    <span key={idx} className="kx-tl-tick" style={{ left: `${(idx / 20) * 100}%` }}>
                      {sec}s
                    </span>
                  );
                })}
                <div
                  className="kx-tl-playhead"
                  style={{
                    left: `${Math.min(100, (playheadSec / timelineMaxSec) * 100)}%`,
                    cursor: 'ew-resize'
                  }}
                  title="Drag playhead with mouse to scrub timeline"
                />
              </div>
            </div>

            {/* Track Rows: either Composition CG Items (Shape, Text, Image, PNG Sequence, Ticker) or Channel Layers */}
            <div className="kx-tl-tracks-scroll">
              {timelineViewMode === 'items' ? (
                compItems.map(item => {
                  const isSel = selectAllActive || selectedItemId === item.id;
                  const startSec = Number(item.start_sec || 0);
                  const dur = Number(item.duration_sec || 20);
                  const leftPct = Math.max(0, Math.min(96, (startSec / timelineMaxSec) * 100));
                  const widthPct = Math.max(3, Math.min(100 - leftPct, (dur / timelineMaxSec) * 100));

                  return (
                    <div
                      key={item.id}
                      className={`kx-tl-track-row ${isSel ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectAllActive(false);
                        setSelectedItemId(item.id);
                      }}
                    >
                      <div className="kx-tl-track-label" style={{ justifyContent: 'space-between', paddingRight: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <i style={{ background: item.color || '#38bdf8' }} />
                          <span title={`${item.name} (${item.type})`} style={{ minWidth: 0 }}>
                            <strong style={{ color: item.hidden ? '#64748b' : '#e2e8f0', fontSize: 11, textDecoration: item.hidden ? 'line-through' : 'none' }}>{item.name}</strong>
                            <small style={{ display: 'block', color: '#94a3b8', fontSize: 9.5 }}>{item.type}</small>
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="kx-xs-btn"
                            style={{ padding: '2px 4px' }}
                            title={item.hidden ? 'Show Item' : 'Hide Item'}
                            onClick={() => updateCompositionItems(prev => prev.map(it => it.id === item.id ? { ...it, hidden: !it.hidden } : it))}
                          >
                            {item.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                          </button>
                          <button
                            type="button"
                            className="kx-xs-btn"
                            style={{ padding: '2px 4px' }}
                            title={item.locked ? 'Unlock Item' : 'Lock Item'}
                            onClick={() => updateCompositionItems(prev => prev.map(it => it.id === item.id ? { ...it, locked: !it.locked } : it))}
                          >
                            {item.locked ? <Lock size={10} /> : <Unlock size={10} />}
                          </button>
                          <button
                            type="button"
                            className="kx-xs-btn"
                            style={{ padding: '2px 4px', color: '#f87171' }}
                            title="Delete Item from Timeline"
                            onClick={() => updateCompositionItems(prev => prev.filter(it => it.id !== item.id))}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                      <div
                        className="kx-tl-track-lane"
                        onMouseDown={(e) => {
                          if (e.target === e.currentTarget) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                            setPlayheadSec(Number((ratio * timelineMaxSec).toFixed(2)));
                            setIsScrubbingPlayhead(true);
                          }
                        }}
                      >
                        <div
                          className="kx-tl-clip-bar live"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            background: item.color || '#38bdf8',
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 6px'
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedItemId(item.id);
                            setTlBarDrag({
                              kind: 'item',
                              id: item.id,
                              action: 'move',
                              startClientX: e.clientX,
                              origStart: startSec,
                              origDur: dur
                            });
                          }}
                          title={`Drag to move "${item.name}" (${item.type}) • Drag edges to trim duration`}
                        >
                          <span
                            style={{ width: 6, height: '100%', cursor: 'ew-resize', display: 'inline-block' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setSelectedItemId(item.id);
                              setTlBarDrag({
                                kind: 'item',
                                id: item.id,
                                action: 'resize-l',
                                startClientX: e.clientX,
                                origStart: startSec,
                                origDur: dur
                              });
                            }}
                          />
                          <span style={{ pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            [{item.type.toUpperCase()}] {item.name} ({startSec.toFixed(1)}s → {(startSec + dur).toFixed(1)}s)
                          </span>
                          <span
                            style={{ width: 6, height: '100%', cursor: 'ew-resize', display: 'inline-block' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setSelectedItemId(item.id);
                              setTlBarDrag({
                                kind: 'item',
                                id: item.id,
                                action: 'resize-r',
                                startClientX: e.clientX,
                                origStart: startSec,
                                origDur: dur
                              });
                            }}
                          />
                        </div>
                        <div
                          className="kx-tl-playhead-line"
                          style={{ left: `${Math.min(100, (playheadSec / timelineMaxSec) * 100)}%`, cursor: 'ew-resize' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsScrubbingPlayhead(true);
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                filteredLayers.map(layer => {
                  const isSelected = selectedCg?.id === layer.id;
                  const src = isSelected ? cgDraft : layer;
                  const startSec = Number(src.start_offset_sec || 0);
                  const dur = Number(src.duration_sec || 0) > 0 ? Number(src.duration_sec) : timelineMaxSec;
                  const leftPct = Math.max(0, Math.min(96, (startSec / timelineMaxSec) * 100));
                  const widthPct = Math.max(3, Math.min(100 - leftPct, (dur / timelineMaxSec) * 100));

                  return (
                    <div
                      key={layer.id}
                      className={`kx-tl-track-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedCg(layer);
                        setCgDraft({ ...layer });
                      }}
                    >
                      <div className="kx-tl-track-label">
                        <i style={{ background: layer.color || '#e11d72' }} />
                        <span>{layer.name}</span>
                      </div>
                      <div
                        className="kx-tl-track-lane"
                        onMouseDown={(e) => {
                          if (e.target === e.currentTarget) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                            setPlayheadSec(Number((ratio * timelineMaxSec).toFixed(2)));
                            setIsScrubbingPlayhead(true);
                          }
                        }}
                      >
                        <div
                          className={`kx-tl-clip-bar ${layer.effective_active ? 'live' : ''}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            background: layer.color || '#e11d72',
                            cursor: 'grab'
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedCg(layer);
                            setCgDraft({ ...layer });
                            setTlBarDrag({
                              kind: 'layer',
                              id: layer.id,
                              action: 'move',
                              startClientX: e.clientX,
                              origStart: startSec,
                              origDur: dur
                            });
                          }}
                        >
                          <span>
                            {startSec}s → {src.duration_sec ? `${startSec + Number(src.duration_sec)}s` : 'HOLD'}
                          </span>
                        </div>
                        <div
                          className="kx-tl-playhead-line"
                          style={{ left: `${Math.min(100, (playheadSec / timelineMaxSec) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {newCompOpen && (
        <div className="kx-cg-modal-backdrop" onClick={() => setNewCompOpen(false)}>
          <div className="kx-cg-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="kx-cg-modal-head">
              <strong>Create New CG Composition</strong>
              <button className="kx-xs-btn" onClick={() => setNewCompOpen(false)}>Close</button>
            </div>
            <div className="kx-cg-modal-body">
              <label className="kx-cg-modal-field">
                <span>Composition / Layer Name</span>
                <input
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="e.g. Evening News Ticker"
                />
              </label>
              <label className="kx-cg-modal-field">
                <span>CG Category</span>
                <select value={newCompCat} onChange={(e) => setNewCompCat(e.target.value)}>
                  {ALL_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {ALL_LABELS[k] || k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="kx-cg-modal-field">
                <span>Starter Template (Optional)</span>
                <select value={newCompTplId} onChange={(e) => setNewCompTplId(e.target.value)}>
                  <option value="">Blank Composition</option>
                  {(data.cg_templates || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="kx-cg-modal-foot">
              <button className="kx-xs-btn" onClick={() => setNewCompOpen(false)}>Cancel</button>
              <button
                className="kx-xs-btn primary"
                onClick={async () => {
                  const tpl = (data.cg_templates || []).find((t) => Number(t.id) === Number(newCompTplId));
                  const category = tpl?.category || newCompCat || 'ticker';
                  const name = (newCompName || '').trim() || (tpl ? `${tpl.name} Copy` : `New ${ALL_LABELS[category] || category}`);
                  const payload = tpl
                    ? {
                        name,
                        category,
                        template_id: tpl.id,
                        text: tpl.sample_text || `${name} — Live Broadcast`,
                        subtext: tpl.sample_subtext || '',
                        color: tpl.accent || '#38bdf8',
                        bg_color: tpl.bg_color || '#020617',
                        text_color: tpl.text_color || '#ffffff',
                        gradient: tpl.gradient || '',
                        font_family: tpl.font_family || 'Inter',
                        font_size: Number(tpl.font_size || 28),
                        font_weight: tpl.font_weight || '700',
                        text_align: tpl.text_align || 'left',
                        position_x: Number(tpl.position_x ?? 4),
                        position_y: Number(tpl.position_y ?? 84),
                        width: Number(tpl.width ?? 92),
                        height: Number(tpl.height ?? 10),
                        z_index: Number(tpl.z_index ?? 10),
                        opacity: Number(tpl.opacity ?? 1),
                        border_radius: Number(tpl.border_radius ?? 8),
                        border_width: Number(tpl.border_width ?? 1),
                        border_color: tpl.border_color || tpl.accent || '#38bdf8',
                        animation: tpl.animation || 'slide',
                        speed: Number(tpl.speed ?? 65),
                        style_json: tpl.style_json || '',
                        active: 0,
                      }
                    : {
                        name,
                        category,
                        text: `${name} — Live Broadcast`,
                        subtext: '',
                        color: '#38bdf8',
                        bg_color: '#020617',
                        text_color: '#ffffff',
                        font_family: 'Inter',
                        font_size: 28,
                        font_weight: '700',
                        text_align: 'left',
                        position_x: 4,
                        position_y: category === 'ticker' ? 88 : 76,
                        width: 92,
                        height: category === 'ticker' ? 8 : 14,
                        z_index: 10,
                        opacity: 1,
                        border_radius: 8,
                        border_width: 1,
                        border_color: '#38bdf8',
                        animation: 'slide',
                        speed: 65,
                        active: 0,
                      };
                  const created = await save('cg', payload, null, `Created CG composition "${name}"`);
                  if (created?.id) {
                    setSelectedCg?.(created);
                    setCgDraft?.(created);
                  }
                  setNewCompOpen(false);
                  setNewCompName('');
                  setNewCompTplId('');
                }}
              >
                Create Composition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
