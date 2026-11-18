import React, { useEffect, useState } from 'react';
import { Eye, Lock, Music, Save, X, Zap } from 'lucide-react';
import { ANIMATIONS, B, Card, Field, Pill } from './shared';

const MUSIC_FIELDS = [
  ['song_title', 'Song / Track Title'],
  ['artist', 'Artist / Singer'],
  ['album', 'Album'],
  ['music_director', 'Music Director'],
  ['composer', 'Composer'],
  ['lyricist', 'Lyricist'],
  ['record_label', 'Record Label'],
  ['release_year', 'Release Year']
];

export function MusicMetadataModal({ open = true, item, onClose, mutate }) {
  const [form, setForm] = useState({
    song_title: '',
    artist: '',
    album: '',
    music_director: '',
    composer: '',
    lyricist: '',
    record_label: '',
    release_year: '',
    genre: 'Pop / Adhunik',
    language: 'Nepali',
    copyright_credit: '',
    custom_fields_json: '{}',
    override_enabled: false,
    start_delay_sec: 20,
    start_duration_sec: 10,
    end_lead_sec: 30,
    end_duration_sec: 10,
    animation: 'slide-up'
  });

  useEffect(() => {
    if (!item) return;
    const m = item.music_metadata || {};
    setForm({
      song_title: m.song_title || item.title || '',
      artist: m.artist || '',
      album: m.album || '',
      music_director: m.music_director || '',
      composer: m.composer || '',
      lyricist: m.lyricist || '',
      record_label: m.record_label || '',
      release_year: m.release_year || '2083',
      genre: m.genre || 'Adhunik / Folk',
      language: m.language || 'Nepali',
      copyright_credit: m.copyright_credit || '',
      custom_fields_json: m.custom_fields_json || '{}',
      override_enabled: Boolean(m.override_enabled),
      start_delay_sec: m.start_delay_sec ?? 20,
      start_duration_sec: m.start_duration_sec ?? 10,
      end_lead_sec: m.end_lead_sec ?? 30,
      end_duration_sec: m.end_duration_sec ?? 10,
      animation: m.animation || 'slide-up'
    });
  }, [item]);

  if (!open || !item) return null;

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    const res = await mutate(`/music/metadata/${item.id}`, 'PUT', {
      ...form,
      mark_as_music: true
    }, `Saved Music Metadata for "${form.song_title || item.title}"`);
    if (res) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-head">
          <div className="modal-badge"><Music size={15} /><span>MUSIC METADATA CMS & TIMING OVERRIDES</span></div>
          <button type="button" className="icon-close" onClick={onClose}><X size={16} /></button>
        </div>
        <h3>Music Metadata: {item.title}</h3>
        <p className="muted-paragraph">
          Used automatically for Music Now Playing lower thirds (20s after playback start & 30s before track end).
        </p>

        <div className="form-grid">
          <Field label="Song / Track Title (Nepali or English)"><input value={form.song_title} onChange={e => set('song_title', e.target.value)} placeholder="सम्झनाको फूल" /></Field>
          <Field label="Artist / Singer"><input value={form.artist} onChange={e => set('artist', e.target.value)} placeholder="Example Singer" /></Field>
          <Field label="Album"><input value={form.album} onChange={e => set('album', e.target.value)} placeholder="Example Album" /></Field>
          <Field label="Music Director"><input value={form.music_director} onChange={e => set('music_director', e.target.value)} placeholder="Music Director" /></Field>
          <Field label="Composer"><input value={form.composer} onChange={e => set('composer', e.target.value)} placeholder="Composer" /></Field>
          <Field label="Lyricist"><input value={form.lyricist} onChange={e => set('lyricist', e.target.value)} placeholder="Lyricist" /></Field>
          <Field label="Record Label"><input value={form.record_label} onChange={e => set('record_label', e.target.value)} placeholder="Kashtrix Music" /></Field>
          <Field label="Release Year"><input value={form.release_year} onChange={e => set('release_year', e.target.value)} placeholder="2083 / 2026" /></Field>
          <Field label="Genre"><input value={form.genre} onChange={e => set('genre', e.target.value)} placeholder="Adhunik / Pop / Lok Dohori" /></Field>
          <Field label="Language"><input value={form.language} onChange={e => set('language', e.target.value)} placeholder="Nepali / English" /></Field>
        </div>

        <div className="form-grid">
          <Field label="Copyright / Credit Information">
            <input value={form.copyright_credit} onChange={e => set('copyright_credit', e.target.value)} placeholder="© 2026 Kashtrix Music Pvt. Ltd." />
          </Field>
          <Field label="Custom Metadata Fields (JSON)">
            <input value={form.custom_fields_json} onChange={e => set('custom_fields_json', e.target.value)} placeholder='{"isrc":"NP-KSH-26-0001","mood":"Romantic"}' />
          </Field>
        </div>

        <div className="music-override-box">
          <label className="checkbox-row">
            <input type="checkbox" checked={form.override_enabled} onChange={e => set('override_enabled', e.target.checked)} />
            <strong>Enable Per-Media Music CG Timing Override (overrides channel default 20s / 30s)</strong>
          </label>
          {form.override_enabled && (
            <div className="form-grid four-cols" style={{ marginTop: 10 }}>
              <Field label="Start Delay (s)"><input type="number" min="0" max="600" value={form.start_delay_sec} onChange={e => set('start_delay_sec', Number(e.target.value))} /></Field>
              <Field label="Start Duration (s)"><input type="number" min="1" max="120" value={form.start_duration_sec} onChange={e => set('start_duration_sec', Number(e.target.value))} /></Field>
              <Field label="Before End (s)"><input type="number" min="1" max="600" value={form.end_lead_sec} onChange={e => set('end_lead_sec', Number(e.target.value))} /></Field>
              <Field label="End Duration (s)"><input type="number" min="1" max="120" value={form.end_duration_sec} onChange={e => set('end_duration_sec', Number(e.target.value))} /></Field>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <B onClick={onClose}>Cancel</B>
          <B variant="primary" icon={Save} onClick={save}>Save Music Metadata</B>
        </div>
      </div>
    </div>
  );
}

export function BulkMusicMetadataModal({ open, mediaList, media, onClose, mutate }) {
  const [rows, setRows] = useState([]);
  const list = mediaList || media || [];

  useEffect(() => {
    if (!open) return;
    const candidates = list.filter(m => (m.duration || 0) > 0);
    setRows(candidates.map(m => ({
      media_id: m.id,
      title: m.title,
      song_title: m.music_metadata?.song_title || m.title,
      artist: m.music_metadata?.artist || '',
      album: m.music_metadata?.album || '',
      composer: m.music_metadata?.composer || '',
      lyricist: m.music_metadata?.lyricist || '',
      record_label: m.music_metadata?.record_label || ''
    })));
  }, [open, list.length]);

  if (!open) return null;

  const updateRow = (idx, key, val) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  };

  const saveBulk = async () => {
    const res = await mutate('/music/metadata/bulk', 'POST', { items: rows }, `Bulk updated ${rows.length} music tracks`);
    if (res) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="modal-head">
          <div className="modal-badge"><Music size={15} /><span>BULK MUSIC METADATA EDITOR</span></div>
          <button type="button" className="icon-close" onClick={onClose}><X size={16} /></button>
        </div>
        <h3>Bulk Edit Music Video Metadata ({rows.length} tracks)</h3>
        <div className="comparison-table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
          <table className="comparison-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Song Title</th>
                <th>Artist / Singer</th>
                <th>Album</th>
                <th>Composer</th>
                <th>Record Label</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.media_id}>
                  <td>#{r.media_id}</td>
                  <td><input value={r.song_title} onChange={e => updateRow(idx, 'song_title', e.target.value)} /></td>
                  <td><input value={r.artist} onChange={e => updateRow(idx, 'artist', e.target.value)} placeholder="Artist" /></td>
                  <td><input value={r.album} onChange={e => updateRow(idx, 'album', e.target.value)} placeholder="Album" /></td>
                  <td><input value={r.composer} onChange={e => updateRow(idx, 'composer', e.target.value)} placeholder="Composer" /></td>
                  <td><input value={r.record_label} onChange={e => updateRow(idx, 'record_label', e.target.value)} placeholder="Label" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-actions">
          <B onClick={onClose}>Cancel</B>
          <B variant="primary" icon={Save} onClick={saveBulk}>Save All Music Tracks</B>
        </div>
      </div>
    </div>
  );
}

export function MusicAndProgrammeSettingsPanel({ data, mutate, onUpgrade }) {
  const isMusicPro = Boolean(data.entitlements?.music_now_playing);
  const mCfg = data.music_cg_settings || {};
  const pCfg = data.programme_cg_settings || {};

  const [musicForm, setMusicForm] = useState({
    enabled: true,
    show_at_start: true,
    start_delay_sec: 20,
    start_duration_sec: 10,
    show_before_end: true,
    end_lead_sec: 30,
    end_duration_sec: 10,
    template_key: 'music_now_playing_gradient',
    visible_fields: ['song_title', 'artist', 'album'],
    position_x: 60,
    position_y: 805,
    width: 760,
    height: 155,
    opacity: 0.95,
    text_color: '#ffffff',
    bg_color: '#160d2d',
    accent_color: '#e11d72',
    animation: 'slide-up'
  });

  const [progForm, setProgForm] = useState({
    enabled: true,
    show_at_start: true,
    start_delay_sec: 10,
    start_duration_sec: 12,
    show_before_end: true,
    end_lead_sec: 45,
    end_duration_sec: 12,
    template_key: 'programme_now_next',
    eligible_categories: ['news', 'talk', 'special', 'music', 'live'],
    show_title: true,
    show_category: true,
    show_time: true,
    show_next: true,
    position_x: 1180,
    position_y: 250,
    animation: 'slide-left'
  });

  const [previewBanner, setPreviewBanner] = useState(null);

  useEffect(() => {
    let vf = ['song_title', 'artist', 'album'];
    try { vf = JSON.parse(mCfg.visible_fields_json || '["song_title","artist","album"]'); } catch {}
    setMusicForm({
      enabled: mCfg.enabled ?? true,
      show_at_start: mCfg.show_at_start ?? true,
      start_delay_sec: mCfg.start_delay_sec ?? 20,
      start_duration_sec: mCfg.start_duration_sec ?? 10,
      show_before_end: mCfg.show_before_end ?? true,
      end_lead_sec: mCfg.end_lead_sec ?? 30,
      end_duration_sec: mCfg.end_duration_sec ?? 10,
      template_key: mCfg.template_key || 'music_now_playing_gradient',
      visible_fields: Array.isArray(vf) ? vf : ['song_title', 'artist', 'album'],
      position_x: mCfg.position_x ?? 60,
      position_y: mCfg.position_y ?? 805,
      width: mCfg.width ?? 760,
      height: mCfg.height ?? 155,
      opacity: mCfg.opacity ?? 0.95,
      text_color: mCfg.text_color || '#ffffff',
      bg_color: mCfg.bg_color || '#160d2d',
      accent_color: mCfg.accent_color || '#e11d72',
      animation: mCfg.animation || 'slide-up'
    });
  }, [mCfg.updated_at, mCfg.start_delay_sec, mCfg.end_lead_sec, mCfg.template_key]);

  useEffect(() => {
    let ec = ['news', 'talk', 'special', 'music', 'live'];
    try { ec = JSON.parse(pCfg.eligible_categories_json || '["news","talk","special","music","live"]'); } catch {}
    setProgForm({
      enabled: pCfg.enabled ?? true,
      show_at_start: pCfg.show_at_start ?? true,
      start_delay_sec: pCfg.start_delay_sec ?? 10,
      start_duration_sec: pCfg.start_duration_sec ?? 12,
      show_before_end: pCfg.show_before_end ?? true,
      end_lead_sec: pCfg.end_lead_sec ?? 45,
      end_duration_sec: pCfg.end_duration_sec ?? 12,
      template_key: pCfg.template_key || 'programme_now_next',
      eligible_categories: Array.isArray(ec) ? ec : ['news', 'talk', 'special', 'music', 'live'],
      show_title: pCfg.show_title ?? true,
      show_category: pCfg.show_category ?? true,
      show_time: pCfg.show_time ?? true,
      show_next: pCfg.show_next ?? true,
      position_x: pCfg.position_x ?? 1180,
      position_y: pCfg.position_y ?? 250,
      animation: pCfg.animation || 'slide-left'
    });
  }, [pCfg.updated_at, pCfg.template_key]);

  if (!isMusicPro) {
    return (
      <Card
        title="Settings → Music Graphics & Programme Now/Next Automation"
        desc="Exclusively available on Graphics Automation Pro (NPR 60,000/month)"
        extra={<Pill color="magenta">MUSIC & GRAPHICS PRO</Pill>}
        className="mt-gap"
      >
        <div className="locked-banner">
          <Lock size={28} />
          <h4>Unlock Automatic Music Now Playing & Programme Now/Next CG</h4>
          <p className="muted-paragraph">
            Activate the <strong>Graphics Automation Pro (NPR 60,000/month)</strong> Demo Plan to configure 20s start / 30s before-end automatic Music Now Playing lower thirds, Music Metadata CMS, and Programme Now/Next automation.
          </p>
          <B
            variant="primary"
            icon={Zap}
            onClick={() => onUpgrade({
              title: 'Graphics Automation Pro Required (NPR 60,000/month)',
              message: 'Automatic Music Now Playing CG, Programme Now/Next CG, and the 1920×1080 Drag-and-Drop Visual CG Studio are exclusive to Graphics Automation Pro.',
              recommendedPlan: 'music_graphics_pro',
              recommendedName: 'Graphics Automation Pro (NPR 60,000/mo)'
            })}
          >
            Unlock with Graphics Automation Pro (Free Demo)
          </B>
        </div>
      </Card>
    );
  }

  const toggleMusicField = (fieldKey) => {
    setMusicForm(prev => {
      const exists = prev.visible_fields.includes(fieldKey);
      const next = exists ? prev.visible_fields.filter(f => f !== fieldKey) : [...prev.visible_fields, fieldKey];
      return { ...prev, visible_fields: next.length ? next : ['song_title'] };
    });
  };

  const toggleProgCat = (catKey) => {
    setProgForm(prev => {
      const exists = prev.eligible_categories.includes(catKey);
      const next = exists ? prev.eligible_categories.filter(c => c !== catKey) : [...prev.eligible_categories, catKey];
      return { ...prev, eligible_categories: next };
    });
  };

  return (
    <div className="grid-two mt-gap">
      <Card
        title="Settings → Music Graphics (Automatic Now Playing)"
        desc="Triggers at song beginning (default +20s for 10s) and before song end (default -30s for 10s)"
        extra={<Pill color={musicForm.enabled ? 'green' : 'muted'} dot>{musicForm.enabled ? 'AUTO MUSIC CG ON' : 'DISABLED'}</Pill>}
      >
        <div className="form-stack">
          <div className="checkbox-grid">
            <label className="checkbox-row">
              <input type="checkbox" checked={musicForm.enabled} onChange={e => setMusicForm({ ...musicForm, enabled: e.target.checked })} />
              <span>Enable automatic Music Now Playing</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={musicForm.show_at_start} onChange={e => setMusicForm({ ...musicForm, show_at_start: e.target.checked })} />
              <span>Show at beginning of song</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={musicForm.show_before_end} onChange={e => setMusicForm({ ...musicForm, show_before_end: e.target.checked })} />
              <span>Show near ending of song</span>
            </label>
          </div>

          <div className="form-grid four-cols">
            <Field label="Start delay (s, def 20)">
              <input type="number" min="0" max="300" value={musicForm.start_delay_sec} onChange={e => setMusicForm({ ...musicForm, start_delay_sec: Number(e.target.value) })} />
            </Field>
            <Field label="Start dur (s, def 10)">
              <input type="number" min="1" max="120" value={musicForm.start_duration_sec} onChange={e => setMusicForm({ ...musicForm, start_duration_sec: Number(e.target.value) })} />
            </Field>
            <Field label="Before end (s, def 30)">
              <input type="number" min="1" max="300" value={musicForm.end_lead_sec} onChange={e => setMusicForm({ ...musicForm, end_lead_sec: Number(e.target.value) })} />
            </Field>
            <Field label="End dur (s, def 10)">
              <input type="number" min="1" max="120" value={musicForm.end_duration_sec} onChange={e => setMusicForm({ ...musicForm, end_duration_sec: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="form-grid">
            <Field label="Music CG Template">
              <select value={musicForm.template_key} onChange={e => setMusicForm({ ...musicForm, template_key: e.target.value })}>
                <option value="music_now_playing_minimal">1. Music Now Playing — Minimal</option>
                <option value="music_now_playing_gradient">2. Music Now Playing — Premium Gradient</option>
                <option value="music_now_playing_album">3. Music Now Playing — Album Art</option>
                <option value="song_credits_details">4. Song Credits / Artist Details</option>
              </select>
            </Field>
            <Field label="Entrance / Exit Animation">
              <select value={musicForm.animation} onChange={e => setMusicForm({ ...musicForm, animation: e.target.value })}>
                {ANIMATIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Visible Metadata Fields in Lower Third">
            <div className="category-chips compact-chips">
              {MUSIC_FIELDS.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={musicForm.visible_fields.includes(key) ? 'on' : ''}
                  onClick={() => toggleMusicField(key)}
                >
                  {musicForm.visible_fields.includes(key) ? '✓ ' : ''}{label}
                </button>
              ))}
            </div>
          </Field>

          <div className="form-grid four-cols">
            <Field label="Pos X (1920 ref)"><input type="number" value={musicForm.position_x} onChange={e => setMusicForm({ ...musicForm, position_x: Number(e.target.value) })} /></Field>
            <Field label="Pos Y (1080 ref)"><input type="number" value={musicForm.position_y} onChange={e => setMusicForm({ ...musicForm, position_y: Number(e.target.value) })} /></Field>
            <Field label="Accent Color">
              <div className="color-picker-wrap">
                <input type="color" value={musicForm.accent_color} onChange={e => setMusicForm({ ...musicForm, accent_color: e.target.value })} />
                <code>{musicForm.accent_color}</code>
              </div>
            </Field>
            <Field label="BG Color">
              <div className="color-picker-wrap">
                <input type="color" value={musicForm.bg_color} onChange={e => setMusicForm({ ...musicForm, bg_color: e.target.value })} />
                <code>{musicForm.bg_color}</code>
              </div>
            </Field>
          </div>

          {previewBanner && (
            <div className="music-cg-live-card" style={{ borderColor: musicForm.accent_color, background: musicForm.bg_color }}>
              <small style={{ color: musicForm.accent_color }}>MUSIC CG PREVIEW ({musicForm.template_key})</small>
              <strong>{previewBanner.headline}</strong>
              <span>{previewBanner.subtext}</span>
            </div>
          )}

          <div className="button-row">
            <B variant="primary" icon={Save} onClick={() => mutate('/music/cg-settings', 'PUT', musicForm, 'Saved Music Graphics settings')}>
              Save Music CG Settings
            </B>
            <B variant="outline" icon={Eye} onClick={async () => {
              const res = await mutate('/music/cg-preview', 'POST', {}, 'Generated Music CG Preview');
              if (res) setPreviewBanner(res);
            }}>
              Preview Now Playing
            </B>
          </div>
        </div>
      </Card>

      <Card
        title="Programme Information CG (Now Showing / Next)"
        desc="Driven automatically by eligible scheduled programmes in Broadcast Scheduler"
        extra={<Pill color={progForm.enabled ? 'purple' : 'muted'} dot>{progForm.enabled ? 'PROGRAMME CG ON' : 'DISABLED'}</Pill>}
      >
        <div className="form-stack">
          <div className="checkbox-grid">
            <label className="checkbox-row">
              <input type="checkbox" checked={progForm.enabled} onChange={e => setProgForm({ ...progForm, enabled: e.target.checked })} />
              <span>Enable automatic Programme Now/Next CG</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={progForm.show_at_start} onChange={e => setProgForm({ ...progForm, show_at_start: e.target.checked })} />
              <span>Display at programme start</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={progForm.show_before_end} onChange={e => setProgForm({ ...progForm, show_before_end: e.target.checked })} />
              <span>Display before programme ends</span>
            </label>
          </div>

          <div className="form-grid">
            <Field label="Programme CG Template">
              <select value={progForm.template_key} onChange={e => setProgForm({ ...progForm, template_key: e.target.value })}>
                <option value="programme_now_showing">NOW SHOWING</option>
                <option value="programme_now_next">NOW / NEXT</option>
                <option value="next_programme">NEXT PROGRAMME</option>
                <option value="upcoming">UPCOMING</option>
                <option value="programme_starting_soon">PROGRAMME STARTING SOON</option>
                <option value="current_programme_title">CURRENT PROGRAMME TITLE</option>
              </select>
            </Field>
            <Field label="Animation">
              <select value={progForm.animation} onChange={e => setProgForm({ ...progForm, animation: e.target.value })}>
                {ANIMATIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          </div>

          <div className="form-grid four-cols">
            <Field label="Start Delay (s)"><input type="number" min="0" max="600" value={progForm.start_delay_sec} onChange={e => setProgForm({ ...progForm, start_delay_sec: Number(e.target.value) })} /></Field>
            <Field label="Start Dur (s)"><input type="number" min="1" max="120" value={progForm.start_duration_sec} onChange={e => setProgForm({ ...progForm, start_duration_sec: Number(e.target.value) })} /></Field>
            <Field label="Before End (s)"><input type="number" min="1" max="600" value={progForm.end_lead_sec} onChange={e => setProgForm({ ...progForm, end_lead_sec: Number(e.target.value) })} /></Field>
            <Field label="End Dur (s)"><input type="number" min="1" max="120" value={progForm.end_duration_sec} onChange={e => setProgForm({ ...progForm, end_duration_sec: Number(e.target.value) })} /></Field>
          </div>

          <Field label="Eligible Programme Categories (never shown on unscheduled rotation)">
            <div className="category-chips compact-chips">
              {['news', 'talk', 'special', 'music', 'live', 'documentary'].map(cat => (
                <button
                  type="button"
                  key={cat}
                  className={progForm.eligible_categories.includes(cat) ? 'on' : ''}
                  onClick={() => toggleProgCat(cat)}
                >
                  {progForm.eligible_categories.includes(cat) ? '✓ ' : ''}{cat.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>

          <div className="checkbox-grid">
            <label className="checkbox-row"><input type="checkbox" checked={progForm.show_title} onChange={e => setProgForm({ ...progForm, show_title: e.target.checked })} /><span>Show Programme Title</span></label>
            <label className="checkbox-row"><input type="checkbox" checked={progForm.show_category} onChange={e => setProgForm({ ...progForm, show_category: e.target.checked })} /><span>Show Category Tag</span></label>
            <label className="checkbox-row"><input type="checkbox" checked={progForm.show_time} onChange={e => setProgForm({ ...progForm, show_time: e.target.checked })} /><span>Show Scheduled Time</span></label>
            <label className="checkbox-row"><input type="checkbox" checked={progForm.show_next} onChange={e => setProgForm({ ...progForm, show_next: e.target.checked })} /><span>Show NEXT Programme</span></label>
          </div>

          <div className="button-row">
            <B variant="primary" icon={Save} onClick={() => mutate('/programme/cg-settings', 'PUT', progForm, 'Saved Programme Information CG settings')}>
              Save Programme CG Settings
            </B>
          </div>
        </div>
      </Card>
    </div>
  );
}

