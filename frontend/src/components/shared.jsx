import React, { useEffect, useState } from 'react';
import {
  CalendarClock, CreditCard, Database, Film, FolderOpen, Image as ImageIcon,
  Layers, LayoutDashboard, MonitorPlay, Music, Radio, Settings, Shield, Sliders, Tv, Video, Wifi
} from 'lucide-react';

export const asset = '/assets/';

export const ALL_KEYS = [
  'logo', 'logo_anim', 'live_anim', 'sponsor', 'ticker', 'crawl', 'lower_third',
  'breaking', 'flash', 'flash_premium', 'breaking_full', 'breaking_split', 'breaking_3win',
  'weather_map', 'update', 'clock', 'name_strap', 'quote', 'now_next', 'headline', 'promo',
  'music_now', 'music_credits', 'program_info', 'sponsored_by', 'live_location', 'fullscreen_alert',
  'hebron_logo', 'hebron_breaking', 'hebron_flash', 'hebron_crawl', 'hebron_ticker'
];

export const ALL_LABELS = {
  logo: 'Channel logo',
  logo_anim: 'Animated 3D Logo Bug',
  live_anim: 'Animated LIVE Bug',
  sponsor: 'Sponsor logo',
  ticker: 'Headline ticker',
  crawl: 'News crawl',
  lower_third: 'Lower third',
  breaking: 'Breaking news',
  flash: 'Flash news',
  flash_premium: 'Flash News Premium',
  breaking_full: 'Full-Screen Breaking News',
  breaking_split: '2-Window Split Breaking',
  breaking_3win: '3-Window Breaking News',
  weather_map: 'Nepal Weather Camera Map',
  update: 'News update',
  clock: 'Date & clock',
  name_strap: 'Name / designation',
  quote: 'Quote / soundbite',
  now_next: 'Now & next',
  headline: 'Main headline',
  promo: 'Programme promo',
  music_now: 'Music Now Playing',
  music_credits: 'Song Credits / Details',
  program_info: 'Programme Now Showing',
  sponsored_by: 'Sponsored By Badge',
  live_location: 'Live Location Tag',
  fullscreen_alert: 'Full-Screen Announcement',
  hebron_logo: 'Hebron TV Liquid-Glass Logo',
  hebron_breaking: 'Hebron TV Breaking News',
  hebron_flash: 'Hebron TV Flash News',
  hebron_crawl: 'Hebron TV News Crawl',
  hebron_ticker: 'Hebron TV Headline Ticker'
};

export const RES_PRESETS = {
  '360p': { w: 640, h: 360, label: '16:9 — 640 × 360 (360p)' },
  '480p': { w: 854, h: 480, label: '16:9 — 854 × 480 (480p)' },
  '720p': { w: 1280, h: 720, label: '16:9 — 1280 × 720 (HD 720p)' },
  '1080p': { w: 1920, h: 1080, label: '16:9 — 1920 × 1080 (Full HD 1080p)' }
};

export const FONT_FAMILIES = [
  'Inter, DM Sans, Noto Sans Devanagari, Nirmala UI, sans-serif',
  'Noto Sans Devanagari, Nirmala UI, Mangal, sans-serif',
  'DM Sans, Inter, Segoe UI, system-ui, sans-serif',
  'Poppins, Nirmala UI, sans-serif',
  'Suvadin, Noto Sans Devanagari, Nirmala UI, sans-serif',
  'ArapGraphics, Noto Sans Devanagari, sans-serif',
  'ArabBroadcast, Nirmala UI, sans-serif',
  'Georgia, Kalimati, serif',
  'JetBrains Mono, Consolas, monospace'
];

export const ANIMATIONS = [
  'char-scale-in-out', 'word-kinetic', 'blur-slide-up',
  'char-reveal', 'word-reveal', 'slide-in-out', 'typewriter', 'flip-3d',
  'glow-pulse', 'devanagari-wave', 'slide-left', 'slide-right', 'slide-up', 'slide-down',
  'fade-in', 'zoom-in', 'pulse-slide', 'flash-in', 'scroll-left',
  'slide', 'fade', 'wipe', 'scroll', 'zoom', 'none'
];

export const GRADIENT_PRESETS = [
  { label: 'Solid Fill (None)', value: '' },
  { label: 'Kashtrix Magenta', value: 'linear-gradient(135deg, #240d3d 0%, #6d1454 55%, #e11d72 100%)' },
  { label: 'Breaking News Red', value: 'linear-gradient(100deg, #991b1b 0%, #dc2626 55%, #be123c 100%)' },
  { label: 'Royal Broadcast Purple', value: 'linear-gradient(135deg, #0f0a1e 0%, #3b0764 60%, #7e22ce 100%)' },
  { label: 'Cyber Midnight Blue', value: 'linear-gradient(135deg, #090e1d 0%, #1e3a8a 60%, #2563eb 100%)' },
  { label: 'Emerald Studio', value: 'linear-gradient(135deg, #06281e 0%, #065f46 60%, #10b981 100%)' },
  { label: 'Gold Headline', value: 'linear-gradient(135deg, #271705 0%, #92400e 60%, #f59e0b 100%)' }
];

export const sections = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['playout', 'Playout Console', MonitorPlay],
  ['cg_editor', 'CG Timeline Editor', Sliders],
  ['cg_controller', 'CG Live Controller', Tv],
  ['live_inputs', 'Live Input Ingest', Wifi],
  ['playlist', 'Playlists', Film],
  ['scheduler', 'Scheduler', CalendarClock],
  ['cms', 'Content CMS', Database],
  ['media', 'Media Library', FolderOpen],
  ['streaming', 'Streaming Outputs', Radio],
  ['subscriptions', 'Subscriptions & Plans', CreditCard],
  ['users', 'Team & Access', Shield],
  ['settings', 'Settings', Settings]
];

export const defaultData = {
  media: [], playlists: [], playlist_items: [], cg: [], cg_content: [],
  cg_templates: [], cg_preview_states: [], cg_layout_presets: [],
  schedules: [], outputs: [], inputs: [], settings: {},
  engine: { state: 'idle', outputs: {}, position_sec: 0, live_input_id: null, live_input_name: null },
  system_telemetry: { status: 'OK', cpu_pct: 9, ram_mb: 420, ram_gb_total: 24, vcpu_total: 8, disk_pct: 0, db_status: 'CLOUD DB READY' },
  audit: [],
  subscription: { plan_id: 'music_graphics_pro', plan_name: 'Graphics Automation Pro', price_npr: 60000, max_outputs: 8, storage_gb: 450 },
  entitlements: {
    plan_id: 'music_graphics_pro', plan_name: 'Graphics Automation Pro', max_outputs: 8, storage_quota_gb: 450,
    protocols: ['rtmp', 'srt', 'udp', 'youtube', 'facebook', 'hls'],
    cg_categories: ALL_KEYS, cms_enabled: true, cms_workflow: true, custom_templates: true,
    cg_scheduling: true, embed_player: true, social_monitoring: true,
    cg_timeline: true, cg_controller: true, live_input_streaming: true, max_inputs: 4,
    music_now_playing: true, music_metadata_cms: true, program_now_next_auto: true,
    visual_cg_designer: true, cg_preview_workflow: true, animated_template_library: true, cg_layout_presets: true
  },
  usage: { storage_used_bytes: 0, storage_used_mb: 0, storage_quota_gb: 450, storage_percent: 0, active_outputs: 0, total_outputs: 0, max_outputs: 8, remaining_outputs: 8 },
  plans: []
};

export const ru = (s) => (s == null ? '—' : s);

export const fmt = (s) => {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
    .map(v => String(v).padStart(2, '0'))
    .join(':');
};

export const fmtNpr = (n) => 'NPR ' + Number(n || 0).toLocaleString('en-IN');

export const clock = (s) => {
  try {
    return new Date(s || Date.now()).toLocaleString('en-NP', {
      timeZone: 'Asia/Kathmandu',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return '--:--:--';
  }
};

export const TIMEZONE_OPTIONS = [
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney'
];

export const tzOffsetStr = (tz = 'Asia/Kathmandu') => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date());
    const off = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+05:45';
    const m = off.match(/GMT([+-]\d{2}:\d{2})/);
    return m ? m[1] : (off === 'GMT' ? '+00:00' : '+05:45');
  } catch {
    return '+05:45';
  }
};

export const localForInput = (tz = 'Asia/Kathmandu') =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz || 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date()).replace(' ', 'T');

export const asKtmIso = (v, tz = 'Asia/Kathmandu') => {
  if (!v) return '';
  if (v.includes('+') || v.endsWith('Z')) return v;
  const off = tzOffsetStr(tz || 'Asia/Kathmandu');
  return (v.length === 16 ? v + ':00' : v) + off;
};

export const nptTime = (v, tz = 'Asia/Kathmandu') => {
  try {
    return new Date(v).toLocaleTimeString('en-GB', {
      timeZone: tz || 'Asia/Kathmandu',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '--:--';
  }
};

export function mediaStreamUrl(mediaId) {
  if (!mediaId) return '';
  const token = sessionStorage.getItem('kashtrix_token') || '';
  return `/api/media/file/${mediaId}?token=${encodeURIComponent(token)}`;
}

export function mediaThumbUrl(mediaId) {
  if (!mediaId) return '';
  const token = sessionStorage.getItem('kashtrix_token') || '';
  return `/api/media/thumb/${mediaId}?token=${encodeURIComponent(token)}`;
}

export function api(path, opt = {}) {
  const token = sessionStorage.getItem('kashtrix_token');
  return fetch('/api' + path, {
    ...opt,
    headers: {
      ...(opt.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...opt.headers
    }
  }).then(async r => {
    if (!r.ok) {
      let e;
      try { e = (await r.json()).detail; } catch {}
      throw new Error(typeof e === 'string' ? e : 'Request failed ' + r.status);
    }
    return r.json();
  });
}

export function MediaThumbnail({ id, mime = '', alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [id]);
  if (!id) return <Video size={22} />;
  if (mime && mime.startsWith('audio/')) return <Music size={22} />;
  if (failed) return mime?.includes('image') ? <ImageIcon size={22} /> : <Video size={22} />;
  return (
    <img
      loading="lazy"
      className={className}
      src={mediaThumbUrl(id)}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

export const B = ({
  children,
  onClick,
  variant = 'outline',
  disabled = false,
  icon: Icon,
  small = false,
  type = 'button',
  title = '',
  className = ''
}) => (
  <button
    type={type}
    title={title}
    disabled={disabled}
    className={`btn ${variant}${small ? ' sm' : ''}${className ? ' ' + className : ''}`}
    onClick={onClick}
  >
    {Icon && <Icon size={small ? 13 : 15} />}
    {children !== undefined && children !== null && children !== '' && <span>{children}</span>}
  </button>
);

export const Pill = ({ children, color = 'muted', dot = false }) => (
  <span className={'pill ' + color}>{dot && <i />}{children}</span>
);

export const Card = ({ children, title, desc, extra, className = '', tight = false }) => (
  <section className={'panel ' + className}>
    <div className={'panel-head ' + (tight ? 'compact' : '')}>
      <div className="panel-title-wrap">
        <h3>{title}</h3>
        {desc && <p>{desc}</p>}
      </div>
      {extra && <div className="panel-head-extra">{extra}</div>}
    </div>
    <div className="panel-body">{children}</div>
  </section>
);

export const Field = ({ label, children, hint }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
);

export function Empty({ text }) {
  return (
    <div className="empty">
      <FolderOpen size={22} />
      <span>{text}</span>
    </div>
  );
}

export function SummaryStat({ icon: Icon, value, label, sub, accent = 'purple' }) {
  return (
    <div className="stat">
      <span className={'stat-icon ' + accent}><Icon size={18} /></span>
      <div className="stat-copy">
        <small>{label}</small>
        <strong title={String(value)}>{value}</strong>
        <span>{sub}</span>
      </div>
    </div>
  );
}

