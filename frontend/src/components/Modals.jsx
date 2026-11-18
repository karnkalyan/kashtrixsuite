import React, { useEffect, useState } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, CloudUpload, CreditCard, HelpCircle,
  Info, Lock, Sparkles, Trash2, Upload, X, Zap
} from 'lucide-react';
import { api, asset, B, Field, Pill } from './shared';

export function ToastStack({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="kx-toastify-container" role="region" aria-label="Broadcast Notifications">
      {toasts.map(t => {
        const type = t.type || 'ok';
        const Icon = type === 'error' ? AlertCircle : type === 'warn' ? AlertTriangle : type === 'info' ? Info : CheckCircle2;
        return (
          <div key={t.id} className={`kx-toastify-card ${type}`}>
            <div className="kx-toastify-icon">
              <Icon size={17} />
            </div>
            <div className="kx-toastify-body">
              <div className="kx-toastify-head">
                <strong>{t.title || (type === 'error' ? 'Broadcast Alert' : type === 'warn' ? 'Operator Notice' : 'Control Room Synced')}</strong>
                <small>{t.time || 'NOW'}</small>
              </div>
              <span>{t.text}</span>
            </div>
            <button
              type="button"
              className="kx-toastify-close"
              onClick={() => onDismiss?.(t.id)}
              title="Dismiss notification"
            >
              <X size={14} />
            </button>
            <div
              className="kx-toastify-progress"
              style={{ animationDuration: `${t.duration || 3800}ms` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function ConfirmDialogModal({ dialog, onClose }) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (dialog) {
      setInputValue(dialog.defaultValue || '');
    }
  }, [dialog]);

  if (!dialog) return null;

  const isDanger = dialog.variant === 'danger';
  const isPrompt = Boolean(dialog.isPrompt);
  const Icon = isDanger ? Trash2 : isPrompt ? Sparkles : AlertTriangle;

  const handleConfirm = (e) => {
    if (e) e.preventDefault();
    if (isPrompt && !inputValue.trim()) return;
    const fn = dialog.onConfirm;
    onClose?.();
    if (fn) fn(isPrompt ? inputValue.trim() : true);
  };

  return (
    <div className="modal-backdrop kx-confirm-backdrop" onClick={onClose}>
      <form className="modal-card kx-confirm-modal" onClick={e => e.stopPropagation()} onSubmit={handleConfirm}>
        <div className="modal-head">
          <div className={`modal-badge ${isDanger ? 'danger' : 'purple'}`}>
            <Icon size={15} />
            <span>{dialog.badge || (isDanger ? 'CONFIRM DESTRUCTIVE ACTION' : isPrompt ? 'OPERATOR INPUT REQUIRED' : 'CONFIRM BROADCAST ACTION')}</span>
          </div>
          <button type="button" className="icon-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="kx-confirm-content">
          <div className={`kx-confirm-icon-circle ${isDanger ? 'danger' : 'purple'}`}>
            <Icon size={22} />
          </div>
          <div className="kx-confirm-copy">
            <h3>{dialog.title || 'Confirm Action'}</h3>
            <p className="muted-paragraph">{dialog.message}</p>
          </div>
        </div>

        {isPrompt && (
          <div className="kx-confirm-prompt-field">
            <Field label={dialog.inputLabel || 'Name'}>
              <input
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={dialog.placeholder || 'Enter value...'}
                required
              />
            </Field>
          </div>
        )}

        <div className="modal-actions kx-confirm-actions">
          <B type="button" onClick={onClose}>{dialog.cancelLabel || 'Cancel'}</B>
          <B
            type="submit"
            variant={isDanger ? 'danger' : 'primary'}
            icon={isDanger ? Trash2 : CheckCircle2}
            disabled={isPrompt && !inputValue.trim()}
          >
            {dialog.confirmLabel || (isDanger ? 'Yes, Delete' : 'Confirm')}
          </B>
        </div>
      </form>
    </div>
  );
}

export function UpgradeModal({ prompt, onClose, onNavigatePlans, onActivatePlan }) {
  if (!prompt) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-badge"><Sparkles size={16} /><span>SUBSCRIPTION UPGRADE REQUIRED</span></div>
          <button type="button" className="icon-close" onClick={onClose}><X size={16} /></button>
        </div>
        <h3>{prompt.title || 'Feature Locked on Current Plan'}</h3>
        <p className="muted-paragraph">{prompt.message}</p>
        {prompt.recommendedPlan && (
          <div className="upgrade-highlight">
            <div>
              <small>RECOMMENDED DEMO PLAN</small>
              <strong>{prompt.recommendedName || prompt.recommendedPlan}</strong>
            </div>
            <B variant="primary" icon={Zap} onClick={() => { onActivatePlan(prompt.recommendedPlan); onClose(); }}>
              Activate {prompt.recommendedName || 'Plan'} (Free Demo)
            </B>
          </div>
        )}
        <div className="modal-actions">
          <B onClick={onClose}>Close</B>
          <B variant="primary" icon={CreditCard} onClick={() => { onClose(); onNavigatePlans(); }}>Compare All 6 Plans</B>
        </div>
      </div>
    </div>
  );
}

export function UploadMediaModal({ open, onClose, data, onUploaded, defaultFolder = 'General' }) {
  const [files, setFiles] = useState([]);
  const [folder, setFolder] = useState(defaultFolder);
  const [category, setCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  if (!open) return null;

  const quotaGb = data.entitlements?.storage_quota_gb || data.tenant?.storage_quota_gb || 150;
  const usedBytes = data.usage?.storage_used_bytes || 0;

  const handleFiles = (selected) => {
    setError('');
    const arr = Array.from(selected || []);
    const totalSize = arr.reduce((acc, f) => acc + f.size, 0);
    if (usedBytes + totalSize > quotaGb * 1024 ** 3) {
      setError(`Selected files exceed your ${quotaGb} GB plan storage quota.`);
      return;
    }
    setFiles(arr);
  };

  const startUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setError('');
    setProgress(0);
    const token = sessionStorage.getItem('kashtrix_token');
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const fd = new FormData();
          fd.append('file', file);
          fd.append('folder', folder || 'General');
          if (category) fd.append('category', category);
          xhr.open('POST', '/api/media/upload');
          if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const filePct = (ev.loaded / ev.total) * 100;
              const overall = Math.round(((i + filePct / 100) / files.length) * 100);
              setProgress(overall);
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
            else {
              let msg = 'Upload failed (' + xhr.status + ')';
              try { msg = JSON.parse(xhr.responseText).detail || msg; } catch {}
              reject(new Error(msg));
            }
          };
          xhr.onerror = () => reject(new Error('Network error during media upload'));
          xhr.send(fd);
        });
      }
      setFiles([]);
      setProgress(100);
      if (onUploaded) await onUploaded();
      onClose();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-badge"><CloudUpload size={16} /><span>UPLOAD BROADCAST MEDIA</span></div>
          <button type="button" className="icon-close" onClick={onClose}><X size={16} /></button>
        </div>
        <h3>Add Videos, Music Tracks, Audio & Broadcast Graphics</h3>
        <p className="muted-paragraph">
          Supported: Video (MP4, MOV, MKV, TS, WEBM), Audio (MP3, WAV, AAC), Images (PNG, JPG, WebP).
          Plan quota: {((usedBytes / (1024 ** 2)) || 0).toFixed(1)} MB used of {quotaGb} GB ({data.subscription?.plan_name || 'Active Plan'}).
        </p>

        <label
          className={'dropzone ' + (dragOver ? 'drag-over' : '')}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        >
          <CloudUpload size={28} />
          <strong>Drag & drop broadcast files here, or click to browse</strong>
          <span>MP4, MOV, MKV, TS • MP3, WAV, AAC • PNG, JPG, WebP</span>
          <input
            multiple
            type="file"
            accept=".mp4,.mov,.mkv,.ts,.webm,.m4v,.mp3,.wav,.aac,.m4a,.png,.jpg,.jpeg,.webp,video/*,audio/*,image/*"
            onChange={e => handleFiles(e.target.files)}
          />
        </label>

        <div className="form-grid">
          <Field label="Folder">
            <select value={folder} onChange={e => setFolder(e.target.value)}>
              {['General', 'Music', 'News', 'Promos', 'Commercials', 'Documentaries', 'Graphics', 'Audio'].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Asset Category (Auto-detected if blank)">
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Auto-detect from stream</option>
              <option value="music">Music Video / Song Track</option>
              <option value="video">Programme Video</option>
              <option value="audio">Broadcast Audio</option>
              <option value="image">Graphic / Still Image</option>
              <option value="logo">Channel / Sponsor Logo</option>
              <option value="promo">Promo Clip</option>
            </select>
          </Field>
        </div>

        {files.length > 0 && (
          <div className="upload-file-list">
            {files.map((f, idx) => (
              <div key={idx} className="upload-file-item">
                <span>{f.name}</span>
                <small>{(f.size / (1024 * 1024)).toFixed(2)} MB</small>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="upload-progress-wrap">
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
            <small>Uploading & running Broadcast Media Stream Inspector… {progress}%</small>
          </div>
        )}

        {error && <div className="alert error"><AlertCircle size={15} />{error}</div>}

        <div className="modal-actions">
          <B onClick={onClose} disabled={uploading}>Cancel</B>
          <B variant="primary" icon={Upload} disabled={!files.length || uploading} onClick={startUpload}>
            {uploading ? `Uploading (${progress}%)…` : `Upload ${files.length || ''} File${files.length === 1 ? '' : 's'}`}
          </B>
        </div>
      </div>
    </div>
  );
}

export function Login({ onAuth }) {
  const [username, setUsername] = useState('admin');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="login-shell">
      <div className="login-art">
        <div className="login-grid" />
        <img className="login-logo" src={asset + 'simulcast-logo-white.png'} alt="Simulcast" />
        <div className="login-copy">
          <Pill color="magenta" dot>SIMULCAST TECHNOLOGIES</Pill>
          <h1>One channel.<br /><span>Every moment.</span><br />Total control.</h1>
          <p>Enterprise Cloud Playout, Automated Programme Scheduling, 1920×1080 Visual CG Broadcast Editor, Dual-Bus CG Controller, Live Input Ingest, and multi-destination streaming in a single broadcast workspace.</p>
        </div>
        <div className="login-foot">KASHTRIX BROADCAST SUITE <span>V2.0 / CLOUD PLAYOUT SAAS</span></div>
      </div>
      <form className="login-form" onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        try {
          const d = await api('/login', { method: 'POST', body: JSON.stringify({ username, password: pass }) });
          sessionStorage.setItem('kashtrix_token', d.token);
          onAuth();
        } catch (e) {
          setErr(e.message);
        } finally {
          setBusy(false);
        }
      }}>
        <div className="login-avatar"><Lock size={22} /></div>
        <h2>Sign in to the control room</h2>
        <p>Your live channel workspace is protected by operator authentication.</p>
        <Field label="Username"><input value={username} onChange={e => setUsername(e.target.value)} required /></Field>
        <Field label="Operator password"><input autoFocus type="password" autoComplete="current-password" required placeholder="Enter your access password" value={pass} onChange={e => setPass(e.target.value)} /></Field>
        {err && <div className="alert error"><AlertCircle size={15} />{err}</div>}
        <B variant="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Enter Broadcast Suite'}</B>
        <small>Default Demo Admin: admin / KashtrixAdmin2026!</small>
      </form>
    </div>
  );
}

