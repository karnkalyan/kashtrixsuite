import React, { useEffect, useMemo, useState } from 'react';
import {
  Airplay, AlertCircle, ArrowDown, ArrowRight, ArrowUp, Award, CalendarClock,
  Check, CheckCircle2, CloudUpload, Cpu, CreditCard, Edit3, Eye, Film,
  FolderOpen, Gauge, HardDrive, Layers, Lock, Music, Pause, Play, Plus,
  Radio, Save, Search, Shield, SkipForward, SlidersHorizontal, Square,
  Trash2, Upload, Wifi, X, Zap
} from 'lucide-react';
import {
  ALL_KEYS, ALL_LABELS, api, asKtmIso, B, Card, Empty, Field, fmt, fmtNpr,
  localForInput, mediaStreamUrl, MediaThumbnail, nptTime, Pill, ru, SummaryStat, TIMEZONE_OPTIONS
} from './shared';
import { LiveMonitor } from './MonitorStage';
import { VisualCGStudio } from './VisualCGStudio';
import { PlayoutConsole } from './PlayoutConsole';
import { RichBroadcastEditor, isRichHtml, sanitizeBroadcastHtml } from './RichBroadcastEditor';
import {
  MusicMetadataModal,
  BulkMusicMetadataModal,
  MusicAndProgrammeSettingsPanel
} from './MusicAndProgrammeSettings';

export function Overview({ data, control, navigate, toggleCgLayer }) {
  const next = (data.playlist_items || []).slice(0, 5);
  const cgs = (data.cg || []).filter(c => c.effective_active);
  const maxOut = data.entitlements?.max_outputs || data.tenant?.max_outputs || 8;

  const currentMedia = useMemo(() => {
    const id = data.engine?.media_id;
    return (data.media || []).find(m => m.id === id) || null;
  }, [data.engine?.media_id, data.media]);

  const posSec = Number(data.engine?.position_sec || 0);
  const durSec = Number(currentMedia?.duration || 0);
  const progressPct = durSec > 0 ? Math.min(100, Math.max(0, (posSec / durSec) * 100)) : (data.engine?.state === 'on_air' ? 100 : 0);

  return (
    <>
      <div className="stats-grid">
        <SummaryStat icon={Radio} value={(data.engine?.state || 'idle').toUpperCase()} label="CHANNEL ENGINE" sub={data.engine?.dry_run ? 'Preview simulation mode' : 'Cloud Master Playout Core'} accent="pink" />
        <SummaryStat icon={CreditCard} value={data.subscription?.plan_name || 'Graphics Automation Pro'} label="ACTIVE PLAN (DEMO)" sub={`${fmtNpr(data.subscription?.price_npr || 60000)}/mo • ${data.hardware?.cpu_threads || data.subscription?.vcpu || 8} vCPU • ${data.hardware?.ram_total_gb || 8} GB RAM`} />
        <SummaryStat icon={Layers} value={`${cgs.length} / ${(data.entitlements?.cg_categories || ALL_KEYS).length}`} label="ACTIVE CG LAYERS" sub="Live composited graphics" accent="blue" />
        <SummaryStat icon={Wifi} value={(data.outputs || []).filter(o => o.enabled).length + '/' + maxOut} label="ENABLED OUTPUTS" sub={(data.subscription?.protocol_labels || ['RTMP']).slice(0, 4).join(' · ')} accent="green" />
      </div>

      <div className="grid-main">
        <Card title="Programme output (Live Monitor)" desc="Real-time video & CG overlay composition + encoded HLS stream">
          <LiveMonitor data={data} />
          <div className="control-strip">
            <div className="control-status-left">
              <Pill color={data.engine?.state === 'on_air' ? 'green' : 'muted'} dot>{(data.engine?.state || 'idle').toUpperCase()}</Pill>
              <span className="subtle">{data.engine?.media_title || 'Waiting for media'}</span>
            </div>
            <div className="button-row">
              <B small icon={Play} variant="primary" onClick={() => control('start')}>Start</B>
              <B small icon={SkipForward} onClick={() => control('next')}>Next</B>
              <B small icon={Square} variant="danger" onClick={() => control('stop')}>Stop</B>
            </div>
          </div>
        </Card>

        <div className="column-gap">
          <Card title="Allotted VPS / Host Hardware" desc="Actual live host CPU, RAM, storage & GPU telemetry">
            <div className="detail-list">
              {[
                ['Host / Node', data.hardware?.hostname || '—'],
                ['OS / Platform', data.hardware?.os || '—'],
                ['CPU Model', data.hardware?.cpu_model || '—'],
                ['CPU Allocation & Load', `${data.hardware?.cpu_cores ?? '—'} Cores / ${data.hardware?.cpu_threads ?? '—'} Threads (${data.hardware?.cpu_pct ?? 0}% used${data.hardware?.cpu_mhz ? ` • ${data.hardware.cpu_mhz} MHz` : ''}${data.hardware?.load_avg ? ` • Load: ${data.hardware.load_avg}` : ''})`],
                ['Memory (RAM)', `${data.hardware?.ram_used_gb ?? 0} GB used / ${data.hardware?.ram_total_gb ?? 0} GB total (${data.hardware?.ram_free_gb ?? 0} GB free • ${data.hardware?.ram_pct ?? 0}%)`],
                ['Storage (Disk)', `${data.hardware?.disk_used_gb ?? 0} GB used / ${data.hardware?.disk_total_gb ?? 0} GB total (${data.hardware?.disk_free_gb ?? 0} GB free • ${data.hardware?.disk_pct ?? 0}%)`],
                ['GPU / Display Adapter', data.hardware?.gpu || '—']
              ].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
            </div>
          </Card>

          <Card title="Now playing" desc="Active source, real-time position & timecode">
            <div className="now-playing">
              <div className="now-image">
                {currentMedia ? (
                  <MediaThumbnail id={currentMedia.id} mime={currentMedia.mime} alt={currentMedia.title} />
                ) : (
                  <Film size={28} />
                )}
              </div>
              <div className="now-meta-row">
                <Pill color="magenta">CURRENT SOURCE</Pill>
                {currentMedia?.category === 'music' && <Pill color="purple">MUSIC CG</Pill>}
              </div>
              <h3 title={data.engine?.media_title}>{data.engine?.media_title || 'No media scheduled'}</h3>
              <p>Source · {(data.engine?.source || 'Automation').toUpperCase()}</p>
              <div className="progress"><i style={{ width: `${progressPct.toFixed(1)}%` }} /></div>
              <div className="progress-details">
                <span>{fmt(posSec)} {durSec > 0 ? `/ ${fmt(durSec)} (${Math.round(progressPct)}%)` : ''}</span>
                <span>{data.settings?.resolution || '1080p'} / {data.settings?.fps || 25} fps</span>
              </div>
            </div>
            <B small onClick={() => navigate('playout')} icon={ArrowRight}>Open Playout Console</B>
          </Card>

          <Card
            title="Quick play / stop graphic layers"
            desc="Play (TAKE) or Stop (CUT) CG overlays directly"
            extra={
              <div className="button-row">
                <B small icon={ArrowRight} onClick={() => navigate('cg_editor')}>CG Editor</B>
                <B small icon={ArrowRight} onClick={() => navigate('cg_controller')}>CG Switcher</B>
              </div>
            }
          >
            <div className="layer-list compact-scroll">
              {(data.cg || []).map(c => {
                const isLive = Boolean(c.effective_active);
                const entitled = c.entitled !== false;
                return (
                  <div className="layer-mini" key={c.id}>
                    <span className="layer-icon" style={{ borderLeft: `3px solid ${c.color || '#e11d72'}` }}>
                      <Layers size={14} />
                    </span>
                    <div>
                      <b>{c.name}</b>
                      <small>{ALL_LABELS[c.category]} {c.text ? `• ${c.text}` : ''}</small>
                    </div>
                    <Pill color={!entitled ? 'muted' : isLive ? 'green' : 'muted'} dot={isLive}>
                      {!entitled ? 'LOCKED' : isLive ? 'LIVE' : 'OFF'}
                    </Pill>
                    <B
                      small
                      variant={!entitled ? 'outline' : isLive ? 'danger' : 'success'}
                      icon={!entitled ? Lock : isLive ? Square : Play}
                      onClick={(e) => toggleCgLayer(c, e)}
                    >
                      {!entitled ? 'Unlock' : isLive ? 'Stop' : 'Play'}
                    </B>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid-two">
        <Card title="Upcoming queue" desc="Fallback playlist and timed programmes" extra={<B small onClick={() => navigate('scheduler')}>Open Scheduler</B>}>
          <div className="data-table">
            <div className="table-head"><span>POS</span><span>MEDIA / PROGRAMME</span><span>DURATION</span><span>STATUS</span></div>
            {next.length ? next.map((r, i) => (
              <div className="table-row" key={r.id}>
                <span className="subtle">{String(i + 1).padStart(2, '0')}</span>
                <span className="table-primary">{r.title}</span>
                <span>{fmt(r.duration)}</span>
                <Pill color={r.media_id === data.engine?.media_id ? 'green' : i ? 'muted' : 'purple'}>
                  {r.media_id === data.engine?.media_id ? 'ON AIR' : i ? 'Queued' : 'Next'}
                </Pill>
              </div>
            )) : <Empty text="Upload media and add it to a playlist to create the running order." />}
          </div>
        </Card>

        <Card title="Output health" desc="Independent destination workers" extra={<B small onClick={() => navigate('streaming')}>Manage Outputs</B>}>
          <div className="output-list">
            {(data.outputs || []).length ? data.outputs.map(o => (
              <div className="output-line" key={o.id}>
                <span className={'protocol-icon ' + o.protocol}><Radio size={15} /></span>
                <div><b>{o.name}</b><small>{o.protocol.toUpperCase()}</small></div>
                <Pill color={o.enabled ? 'green' : 'muted'} dot>{ru(data.engine?.outputs?.[o.id] || (o.enabled ? 'ready' : 'disabled'))}</Pill>
              </div>
            )) : <Empty text="No streaming destinations added yet." />}
          </div>
        </Card>
      </div>
    </>
  );
}

export function Playout(props) {
  return <PlayoutConsole {...props} />;
}

export function Playlists({ data, submit, remove, mutate, openUpload }) {
  const [chosen, setChosen] = useState('');
  const [name, setName] = useState('');
  const [media, setMedia] = useState('');
  const active = Number(chosen) || data.playlists?.[0]?.id;
  const list = (data.playlist_items || []).filter(x => x.playlist_id === active);

  const move = (index, delta) => {
    const ids = list.map(x => x.id);
    const other = index + delta;
    if (other < 0 || other >= ids.length) return;
    [ids[index], ids[other]] = [ids[other], ids[index]];
    mutate('/playlist-items/reorder', 'POST', { playlist_id: active, ids });
  };

  return (
    <div className="grid-main">
      <Card
        title="Playlist rundown"
        desc="Reorder videos; the engine runs this list continuously"
        extra={
          <div className="button-row">
            <B small icon={CloudUpload} onClick={openUpload}>Upload Media</B>
            <Pill color="purple">{list.length} ITEMS</Pill>
          </div>
        }
      >
        <div className="inline-form">
          <select value={active || ''} onChange={e => setChosen(e.target.value)}>
            {(data.playlists || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <B icon={Save} small onClick={() => mutate('/settings', 'POST', { values: { base_playlist: String(active) } })}>
            Set as Fallback
          </B>
        </div>

        <div className="playlist-items">
          {list.length ? list.map((item, i) => {
            const mediaRow = (data.media || []).find(m => m.id === item.media_id);
            const mm = item.music_metadata || mediaRow?.music_metadata;
            return (
              <div className="playlist-item" key={item.id}>
                <div className="queue-count">{String(i + 1).padStart(2, '0')}</div>
                <div className="media-cover"><MediaThumbnail id={item.media_id} mime={mediaRow?.mime} alt={item.title} /></div>
                <div className="queue-info">
                  <strong>{item.title}</strong>
                  <small>
                    {fmt(item.duration)} • {(item.category || mediaRow?.category) === 'music' ? 'Music Video' : 'Playout item'}
                    {mm?.artist ? ` • Artist: ${mm.artist}` : ''}
                    {mm?.album ? ` • Album: ${mm.album}` : ''}
                  </small>
                </div>
                {(item.category || mediaRow?.category) === 'music' && <Pill color="magenta">MUSIC CG</Pill>}
                <Pill color={data.engine?.media_id === item.media_id ? 'green' : 'muted'} dot={data.engine?.media_id === item.media_id}>
                  {data.engine?.media_id === item.media_id ? 'ON AIR' : 'READY'}
                </Pill>
                <div className="queue-actions">
                  <button type="button" disabled={!i} title="Move up" onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                  <button type="button" disabled={i === list.length - 1} title="Move down" onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                  <button type="button" title="Remove" onClick={() => remove('playlist_items', item.id)}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          }) : <Empty text="No media in this playlist. Add or upload a media asset using the panel at right." />}
        </div>
      </Card>

      <div className="column-gap">
        <Card title="Add to rundown" desc="Select from uploaded video or audio media" extra={<B small icon={Upload} onClick={openUpload}>Upload New</B>}>
          <Field label="Media file">
            <select value={media} onChange={e => setMedia(e.target.value)}>
              <option value="">Choose a media asset</option>
              {(data.media || []).filter(m => (m.duration || 0) > 0).map(m => (
                <option value={m.id} key={m.id}>{m.title} ({fmt(m.duration)})</option>
              ))}
            </select>
          </Field>
          <B icon={Plus} variant="primary" disabled={!media || !active} onClick={async () => {
            await submit('playlist_items', { playlist_id: active, media_id: Number(media), position: list.length });
            setMedia('');
          }}>
            Add Media to Playlist
          </B>
        </Card>

        <Card title="Create playlist" desc="Build news, music or overnight rotations">
          <Field label="Playlist name"><input value={name} placeholder="e.g. Evening Music Hitlist" onChange={e => setName(e.target.value)} /></Field>
          <B icon={Plus} disabled={!name.trim()} onClick={async () => { await submit('playlists', { name, loop: 1 }); setName(''); }}>
            Create Playlist
          </B>
        </Card>

        <Card title="Rotation policy" desc="Scheduled broadcast events always take priority">
          <p className="muted-paragraph">
            The default playlist fills empty airtime. A timed programme in the Broadcast Scheduler automatically overrides it, and the playlist resumes after the scheduled block ends.
          </p>
        </Card>
      </div>
    </div>
  );
}

export function Scheduler({ data, submit, remove, mutate, openUpload, onUpgrade }) {
  const stationTz = data.settings?.timezone || 'Asia/Kathmandu';
  const defaultPlaylistId = String(data.settings?.base_playlist || data.playlists?.[0]?.id || '');
  const [kind, setKind] = useState('playlist');
  const [target, setTarget] = useState(defaultPlaylistId);
  const [name, setName] = useState('');
  const [start, setStart] = useState(() => localForInput(stationTz));
  const [durationVal, setDurationVal] = useState('30');
  const [durationUnit, setDurationUnit] = useState('minutes');
  const [repeat, setRepeat] = useState('daily');
  const [priority, setPriority] = useState('50');
  const [switchMode, setSwitchMode] = useState('hard_cut');
  const [programmeCategory, setProgrammeCategory] = useState('news');
  const [enableProgrammeCg, setEnableProgrammeCg] = useState(1);
  const [uploadingSchedMedia, setUploadingSchedMedia] = useState(false);

  const applyDurationFromTarget = (k, tid) => {
    if (!tid) return;
    let totalSec = 0;
    if (k === 'playlist') {
      totalSec = (data.playlist_items || [])
        .filter(i => Number(i.playlist_id) === Number(tid))
        .reduce((sum, i) => sum + Number(i.duration || 0), 0);
    } else if (k === 'media') {
      const m = (data.media || []).find(x => Number(x.id) === Number(tid));
      totalSec = Number(m?.duration || 0);
    }
    if (totalSec > 0) {
      if (totalSec >= 60 && totalSec % 60 === 0) {
        setDurationUnit('minutes');
        setDurationVal(String(Math.round(totalSec / 60)));
      } else {
        setDurationUnit('seconds');
        setDurationVal(String(Math.round(totalSec)));
      }
    }
  };

  useEffect(() => {
    if (kind === 'playlist' && !target && defaultPlaylistId) {
      setTarget(defaultPlaylistId);
      applyDurationFromTarget('playlist', defaultPlaylistId);
    }
  }, [defaultPlaylistId]);

  useEffect(() => {
    if (kind === 'playlist' || kind === 'media') {
      applyDurationFromTarget(kind, target);
    }
  }, [kind, target]);

  const handleSchedulerUpload = async (file) => {
    if (!file) return;
    setUploadingSchedMedia(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'Scheduled');
      fd.append('category', programmeCategory || 'video');
      const r = await api('/media/upload', { method: 'POST', body: fd });
      const res = await r.json().catch(() => ({}));
      if (r.ok && res.id) {
        setKind('media');
        setTarget(String(res.id));
        if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
        if (res.duration && Number(res.duration) > 0) {
          const d = Math.round(Number(res.duration));
          if (d >= 60 && d % 60 === 0) {
            setDurationUnit('minutes');
            setDurationVal(String(d / 60));
          } else {
            setDurationUnit('seconds');
            setDurationVal(String(d));
          }
        }
        await mutate('/control', 'POST', { action: 'refresh' }, 'Media uploaded & selected for schedule').catch(() => {});
      }
    } finally {
      setUploadingSchedMedia(false);
    }
  };

  const cgSchedulingAllowed = data.entitlements?.cg_scheduling !== false;
  const allowedCgCategories = data.entitlements?.cg_categories || ALL_KEYS;

  const opts = kind === 'media'
    ? (data.media || []).filter(m => (m.duration || 0) > 0)
    : kind === 'playlist'
      ? (data.playlists || [])
      : kind === 'cg_content'
        ? (data.cg_content || []).filter(c => allowedCgCategories.includes(c.category))
        : (data.cg || []).filter(c => allowedCgCategories.includes(c.category));

  const typeName = id => {
    const e = (data.schedules || []).find(x => x.id === id);
    const arr = e?.kind === 'media' ? data.media : e?.kind === 'playlist' ? data.playlists : e?.kind === 'cg_content' ? data.cg_content : data.cg;
    return arr?.find(v => v.id === e?.target_id)?.title || arr?.find(v => v.id === e?.target_id)?.name || 'Unlinked';
  };

  const handleKindChange = (newKind) => {
    if ((newKind === 'cg' || newKind === 'cg_content') && !cgSchedulingAllowed) {
      onUpgrade({
        title: 'CG Event Scheduling Requires Growth Plan',
        message: 'The Essential plan includes video and playlist scheduling only. Upgrade to Growth or higher to schedule automatic CG overlays.',
        recommendedPlan: 'growth',
        recommendedName: 'Growth (NPR 20,000/mo)'
      });
      return;
    }
    setKind(newKind);
    if (newKind === 'playlist') {
      setTarget(defaultPlaylistId);
      applyDurationFromTarget('playlist', defaultPlaylistId);
    } else {
      setTarget('');
      if (newKind === 'cg' || newKind === 'cg_content') {
        setDurationUnit('seconds');
        setDurationVal('60');
      } else {
        setDurationUnit('minutes');
        setDurationVal('30');
      }
    }
  };

  return (
    <div className="grid-main">
      <Card
        title="Automated broadcast timeline"
        desc={`Persistent cloud schedules for playlists, video & non-interrupting CG overlays (${stationTz})`}
        extra={<B small icon={CloudUpload} onClick={openUpload}>Upload Media</B>}
      >
        <div className="schedule-timeline">
          <div className="timeline-label"><CalendarClock size={14} /> SCHEDULED EVENTS <span>{stationTz.toUpperCase()}</span></div>
          {(data.schedules || []).length ? data.schedules.slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map(e => (
            <div className="schedule-event" key={e.id}>
              <div className="event-time">
                <strong>{nptTime(e.starts_at, stationTz)}</strong>
                <span>{fmt(e.duration_sec)}</span>
              </div>
              <span className={'event-bar ' + e.kind} />
              <div className="event-text">
                <b>{e.name}</b>
                <small>
                  {typeName(e.id)} • {e.repeat === 'daily' ? 'Every day' : e.repeat === 'weekly' ? 'Weekly' : 'One-time'}
                  {(e.kind === 'media' || e.kind === 'playlist') ? ` • ${e.switch_mode === 'after_current' ? 'Wait for running media' : 'Hard Cut at start'}` : ''}
                  {(e.kind === 'media' || e.kind === 'playlist') && e.programme_category ? ` • Cat: ${e.programme_category.toUpperCase()}` : ''}
                </small>
              </div>
              {(e.kind === 'media' || e.kind === 'playlist') && Boolean(e.enable_programme_cg) && (
                <Pill color="magenta">NOW/NEXT CG</Pill>
              )}
              <Pill color={e.status === 'active' || e.enabled ? (e.status === 'active' ? 'green' : 'purple') : 'muted'} dot={e.status === 'active'}>
                {(e.status || (e.enabled ? 'scheduled' : 'paused')).toUpperCase()}
              </Pill>
              <Pill color={e.kind === 'cg' || e.kind === 'cg_content' ? 'pink' : e.kind === 'media' ? 'purple' : 'blue'}>
                {e.kind.toUpperCase()}
              </Pill>
              <div className="queue-actions">
                <B
                  small
                  variant={e.enabled ? 'primary' : 'ghost'}
                  onClick={() => mutate(`/schedules/${e.id}/${e.enabled ? 'pause' : 'resume'}`, 'POST', {}, e.enabled ? 'Schedule disabled' : 'Schedule enabled')}
                  title={e.enabled ? 'Click to Disable schedule' : 'Click to Enable schedule'}
                >
                  {e.enabled ? 'Enabled' : 'Disabled'}
                </B>
                <button type="button" title="Delete schedule" onClick={() => remove('schedules', e.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          )) : <Empty text="No timed events yet. The default playlist runs continuously until you schedule a programme or CG overlay." />}
        </div>
      </Card>

      <Card title="Schedule an event" desc={`Automated Broadcast Scheduler triggers start & stop automatically in ${stationTz}`}>
        <div className="form-stack">
          <Field label="Event title"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. साँझ समाचार / 12 PM Playlist" /></Field>
          <Field label="Content type">
            <select value={kind} onChange={e => handleKindChange(e.target.value)}>
              <option value="playlist">Playlist block (TV Playout)</option>
              <option value="media">Individual video / audio</option>
              <option value="cg">CG graphic overlay {!cgSchedulingAllowed ? '(Locked — Growth+)' : ''}</option>
              <option value="cg_content">CMS content take {!cgSchedulingAllowed ? '(Locked — Growth+)' : ''}</option>
            </select>
          </Field>
          <Field label="Target item">
            <select value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">Select target</option>
              {opts.map(o => <option value={o.id} key={o.id}>{o.title || o.name}{o.duration ? ` (${fmt(o.duration)})` : ''}</option>)}
            </select>
          </Field>
          {(kind === 'media' || kind === 'playlist') && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(15, 23, 42, 0.55)', border: '1px solid rgba(148, 163, 184, 0.16)' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                {uploadingSchedMedia ? 'Uploading media & probing duration...' : 'Upload new media for this schedule (auto-fills duration):'}
              </span>
              <label style={{ cursor: 'pointer', padding: '5px 10px', borderRadius: 6, background: 'rgba(225, 29, 114, 0.2)', border: '1px solid rgba(225, 29, 114, 0.45)', color: '#f8fafc', fontSize: 12, fontWeight: 600 }}>
                <Upload size={12} style={{ marginRight: 5, verticalAlign: '-1px' }} />
                {uploadingSchedMedia ? 'Uploading...' : 'Upload Media'}
                <input
                  type="file"
                  accept="video/*,audio/*"
                  style={{ display: 'none' }}
                  disabled={uploadingSchedMedia}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleSchedulerUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          )}
          {(kind === 'media' || kind === 'playlist') && (
            <div className="form-grid">
              <Field label="Programme category">
                <select value={programmeCategory} onChange={e => setProgrammeCategory(e.target.value)}>
                  {['news', 'talk', 'music', 'documentary', 'special', 'sports', 'live'].map(c => (
                    <option key={c} value={c}>{c.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </Field>
              <Field label="Auto Programme Now/Next CG">
                <select value={enableProgrammeCg} onChange={e => setEnableProgrammeCg(Number(e.target.value))}>
                  <option value={1}>Enabled (when channel allowed)</option>
                  <option value={0}>Disabled for this programme</option>
                </select>
              </Field>
            </div>
          )}
          {(kind === 'media' || kind === 'playlist') && (
            <Field label="Playout Transition at Scheduled Time">
              <select value={switchMode} onChange={e => setSwitchMode(e.target.value)}>
                <option value="hard_cut">Force Stop Current & Start Immediately (Hard Cut)</option>
                <option value="after_current">Wait for Running Media to Complete, Then Start</option>
              </select>
            </Field>
          )}
          <Field label={`Starts at (${stationTz} local time)`}>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
          </Field>
          <div className="form-grid">
            <Field label={`Duration (${durationUnit})`}>
              <input type="number" min="1" value={durationVal} onChange={e => setDurationVal(e.target.value)} />
            </Field>
            <Field label="Duration unit">
              <select value={durationUnit} onChange={e => setDurationUnit(e.target.value)}>
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
              </select>
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Repeat">
              <select value={repeat} onChange={e => setRepeat(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="none">One-time</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="30">Normal (30)</option>
                <option value="50">High (50)</option>
                <option value="80">Emergency (80)</option>
              </select>
            </Field>
          </div>
          <B
            variant="primary"
            icon={CalendarClock}
            disabled={!name || !target || !start}
            onClick={async () => {
              const sec = durationUnit === 'seconds' ? Number(durationVal) : Number(durationVal) * 60;
              const res = await submit('schedules', {
                name, kind, target_id: Number(target),
                starts_at: asKtmIso(start, stationTz),
                duration_sec: Math.max(1, sec),
                repeat, priority: Number(priority), enabled: 1,
                switch_mode: switchMode,
                programme_category: programmeCategory,
                enable_programme_cg: Number(enableProgrammeCg)
              });
              if (res) { setName(''); setTarget(''); }
            }}
          >
            Add to Broadcast Schedule
          </B>
        </div>
      </Card>
    </div>
  );
}

export function Graphics(props) {
  return <VisualCGStudio {...props} />;
}

function SearchableCategorySelect({ value, onChange, options, includeAll = false, placeholder = 'Search category...' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const allOpts = useMemo(() => {
    const base = options.map(k => ({ value: k, label: ALL_LABELS[k] || k }));
    return includeAll ? [{ value: 'all', label: 'All Entitled Categories' }, ...base] : base;
  }, [options, includeAll]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return allOpts;
    return allOpts.filter(o => o.label.toLowerCase().includes(term) || o.value.toLowerCase().includes(term));
  }, [allOpts, q]);

  const currentLabel = allOpts.find(o => o.value === value)?.label || value;

  return (
    <div ref={wrapRef} className="kx-search-select">
      <button type="button" className="kx-search-select-btn" onClick={() => setOpen(o => !o)}>
        <span>{currentLabel}</span>
        <span className="kx-search-select-caret">▾</span>
      </button>
      {open && (
        <div className="kx-search-select-menu">
          <input
            type="text"
            className="kx-search-select-input"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <div className="kx-search-select-list">
            {filtered.map(o => (
              <button
                type="button"
                key={o.value}
                className={`kx-search-select-opt ${value === o.value ? 'active' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQ('');
                }}
              >
                <span>{o.label}</span>
                <small>{o.value}</small>
              </button>
            ))}
            {!filtered.length && <div className="kx-search-select-empty">No matching category</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const makeNewsRow = (html = '', sepType = 'bullet', sepImage = '') => ({
  id: Math.random().toString(36).slice(2, 9),
  html,
  sepType,
  sepImage
});

const resizeImageFileToDataUrl = (file, maxH = 64) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new window.Image();
    img.onload = () => {
      const scale = img.height > maxH ? maxH / img.height : 1;
      const w = Math.max(16, Math.round(img.width * scale));
      const h = Math.max(16, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

export function CMS({ data, submit, mutate, remove, navigate }) {
  const allowedCategories = data.entitlements?.cg_categories || ALL_KEYS;
  const cmsAllowed = data.entitlements?.cms_enabled !== false;
  const [cat, setCat] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [draft, setDraft] = useState({ title: '', category: allowedCategories[0] || 'ticker', text: '', subtext: '', status: 'draft', template_id: '' });
  const [editing, setEditing] = useState(null);
  const [newsRows, setNewsRows] = useState([makeNewsRow()]);

  if (!cmsAllowed) {
    return (
      <Card title="Newsroom editorial CMS (Locked on Essential Plan)" desc="Upgrade your demo plan to unlock realtime newsroom copy & approval workflows">
        <div className="locked-banner">
          <Lock size={30} />
          <h3>Editorial CG CMS requires Growth or News Pro</h3>
          <p className="muted-paragraph">
            The Essential plan (NPR 15,000/mo) includes basic main logo and ticker text editing from CG Studio.
            Switch to Growth, News Pro, Digital 360, Broadcast Plus, or Graphics Automation Pro in Demo Mode to unlock the Editorial CMS!
          </p>
          <B variant="primary" icon={CreditCard} onClick={() => navigate('subscriptions')}>Switch Demo Plan Now</B>
        </div>
      </Card>
    );
  }

  const items = (data.cg_content || []).filter(c => {
    if (cat !== 'all' && c.category !== cat) return false;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      return (c.title || '').toLowerCase().includes(q) || (c.text || '').toLowerCase().includes(q) || (c.subtext || '').toLowerCase().includes(q);
    }
    return true;
  });

  const mediaImages = (data.media || []).filter(m =>
    (m.mime || '').startsWith('image/') || ['image', 'logo'].includes(m.category)
  );

  const rowSeparatorHtml = (row) => {
    if (row.sepType === 'none') return ' ';
    if (row.sepType === 'diamond') return ' &nbsp;◆&nbsp; ';
    if (row.sepType === 'pipe') return ' &nbsp;|&nbsp; ';
    if ((row.sepType === 'upload' || row.sepType === 'media' || row.sepType === 'custom_url') && row.sepImage) {
      return ` <img src="${String(row.sepImage).replace(/"/g, '&quot;')}" alt="sep" style="height:1.25em;max-height:28px;width:auto;vertical-align:middle;object-fit:contain;margin:0 8px;display:inline-block;" /> `;
    }
    return ' &nbsp;•&nbsp; ';
  };

  const buildMultiNewsHtml = (rows) => {
    const valid = rows.filter(r => String(r.html || '').replace(/<[^>]+>/g, '').trim() || /<img/i.test(r.html || ''));
    if (!valid.length) return '';
    return valid.map((r, i) => (i < valid.length - 1 ? `${r.html}${rowSeparatorHtml(r)}` : r.html)).join('');
  };

  const applyMultiNews = (nextRows = newsRows) => {
    const html = buildMultiNewsHtml(nextRows);
    setDraft(prev => ({ ...prev, text: html }));
    return html;
  };

  const save = async (status = draft.status) => {
    const builtFromRows = buildMultiNewsHtml(newsRows);
    const finalText = builtFromRows || draft.text;
    const payload = {
      ...draft,
      text: finalText,
      status,
      template_id: draft.template_id ? Number(draft.template_id) : null
    };
    const r = await submit('cg_content', payload, editing);
    if (r) {
      if (editing) {
        const linkedLayers = (data.cg || []).filter(l => Number(l.content_id) === Number(editing));
        for (const l of linkedLayers) {
          await submit('cg', { ...l, text: payload.text, subtext: payload.subtext }, l.id);
        }
      }
      setDraft({ title: '', category: allowedCategories[0] || 'ticker', text: '', subtext: '', status: 'draft', template_id: '' });
      setNewsRows([makeNewsRow()]);
      setEditing(null);
    }
  };

  const edit = c => {
    setEditing(c.id);
    setDraft({
      title: c.title,
      category: c.category,
      text: c.text || '',
      subtext: c.subtext || '',
      status: c.status || 'draft',
      template_id: c.template_id || ''
    });
    const raw = String(c.text || '');
    const parts = raw.split(/(?:<img[^>]*>|◆|•|\|)/i).map(s => s.trim()).filter(Boolean);
    setNewsRows(parts.length ? parts.map(p => makeNewsRow(p)) : [makeNewsRow(raw)]);
  };

  const pushToLayer = async item => {
    const layer = (data.cg || []).find(l => (item.template_id && Number(l.template_id) === Number(item.template_id)) || l.category === item.category);
    if (layer) {
      await submit('cg', { ...layer, content_id: item.id, text: item.text, subtext: item.subtext, active: 1 }, layer.id, `Published & taken live on ${layer.name}`);
    }
  };

  return (
    <div className="kx-cms-layout">
      <Card
        title="Newsroom editorial CMS"
        desc="Independent content items with rich formatting, inline logos, draft/approval workflows & live CG sync"
        right={
          <B small variant="outline" icon={Plus} onClick={() => mutate?.('/cms/seed-demo', 'POST', {}, 'Loaded demo CMS newsroom content')}>
            Load Demo CMS Pack
          </B>
        }
      >
        <div className="kx-cms-filter-bar">
          <div className="kx-cms-filter-select">
            <SearchableCategorySelect
              value={cat}
              onChange={setCat}
              options={allowedCategories}
              includeAll={true}
              placeholder="Search CG category..."
            />
          </div>
          <input
            type="text"
            className="kx-cms-search-input"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search newsroom items..."
          />
        </div>
        <div className="cms-list">
          {items.map(c => {
            const linkedTpl = (data.cg_templates || []).find(t => Number(t.id) === Number(c.template_id));
            return (
              <div key={c.id} className="cms-entry">
                <div className="cms-top">
                  <div>
                    <Pill color="purple">{ALL_LABELS[c.category] || c.category}</Pill>
                    {linkedTpl && <Pill color="blue">Template: {linkedTpl.name}</Pill>}
                    <h4>{c.title}</h4>
                  </div>
                  <Pill color={c.status === 'published' || c.status === 'live' ? 'green' : 'muted'}>{(c.status || 'draft').toUpperCase()}</Pill>
                </div>
                {isRichHtml(c.text) ? (
                  <div className="kx-cms-rich-preview" dangerouslySetInnerHTML={{ __html: sanitizeBroadcastHtml(c.text) }} />
                ) : (
                  <p>{c.text}</p>
                )}
                {c.subtext && <small className="subtle">{c.subtext}</small>}
                <div className="button-row" style={{ marginTop: 10 }}>
                  <B small onClick={() => edit(c)}>Edit</B>
                  <B small icon={Check} onClick={() => submit('cg_content', { ...c, status: 'approved' }, c.id)}>Approve</B>
                  <B small icon={Zap} variant="primary" onClick={async () => {
                    await submit('cg_content', { ...c, status: 'published' }, c.id);
                    await pushToLayer({ ...c, status: 'published' });
                  }}>
                    Publish & TAKE
                  </B>
                  {remove && (
                    <B small icon={Trash2} variant="danger" onClick={() => remove('cg_content', c.id)}>Delete</B>
                  )}
                </div>
              </div>
            );
          })}
          {!items.length && <Empty text="No editorial items in this category. Click 'Load Demo CMS Pack' or create a new item." />}
        </div>
      </Card>

      <div className="column-gap">
        <Card title={editing ? 'Edit newsroom item' : 'Create newsroom item'} desc="Large broadcast editor, multi-news repeater (+ / -) with separator image, & CG template binding">
          <div className="form-stack">
            <Field label="Item title"><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. AP1-Style Ticker / Breaking News" /></Field>
            <div className="form-grid">
              <Field label="CG category (Searchable)">
                <SearchableCategorySelect
                  value={draft.category}
                  onChange={v => setDraft({ ...draft, category: v })}
                  options={allowedCategories}
                  includeAll={false}
                  placeholder="Search CG category..."
                />
              </Field>
              <Field label="Linked CG Template (Optional)">
                <select value={draft.template_id || ''} onChange={e => setDraft({ ...draft, template_id: e.target.value })}>
                  <option value="">Auto-match by category</option>
                  {(data.cg_templates || []).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({ALL_LABELS[t.category] || t.category})</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="kx-multi-news-box">
              <div className="kx-multi-news-head">
                <strong>Multi-News / Flash / Ticker Rich Editors (+ / -)</strong>
                <B small variant="outline" onClick={() => applyMultiNews()}>Sync All Lines to Output</B>
              </div>
              <div className="kx-multi-news-rows">
                {newsRows.map((row, idx) => (
                  <div key={row.id} className="kx-multi-news-card">
                    <div className="kx-multi-news-card-head">
                      <span className="kx-multi-row-num">#{idx + 1}</span>
                      <div className="kx-multi-sep-controls">
                        <span className="subtle" style={{ fontSize: 11 }}>After #{idx + 1} Separator:</span>
                        <select
                          value={row.sepType}
                          onChange={e => {
                            const next = newsRows.map((r, i) => i === idx ? { ...r, sepType: e.target.value } : r);
                            setNewsRows(next);
                            applyMultiNews(next);
                          }}
                        >
                          <option value="bullet">Bullet (•)</option>
                          <option value="diamond">Diamond (◆)</option>
                          <option value="pipe">Pipe (|)</option>
                          <option value="none">Space Only</option>
                          <option value="media">Media Library Image</option>
                          <option value="upload">Upload Image (Auto-Resize)</option>
                          <option value="custom_url">Custom Image URL</option>
                        </select>
                        {row.sepType === 'media' && (
                          <select
                            value={row.sepImage}
                            onChange={e => {
                              const next = newsRows.map((r, i) => i === idx ? { ...r, sepImage: e.target.value } : r);
                              setNewsRows(next);
                              applyMultiNews(next);
                            }}
                          >
                            <option value="">Select media image...</option>
                            {mediaImages.map(m => (
                              <option key={m.id} value={`/api/media/thumb/${m.id}`}>{m.title}</option>
                            ))}
                          </select>
                        )}
                        {row.sepType === 'upload' && (
                          <label className="kx-xs-btn" style={{ cursor: 'pointer' }}>
                            {row.sepImage ? 'Change Img' : 'Upload Img'}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const dataUrl = await resizeImageFileToDataUrl(f, 64);
                                const next = newsRows.map((r, i) => i === idx ? { ...r, sepType: 'upload', sepImage: dataUrl } : r);
                                setNewsRows(next);
                                applyMultiNews(next);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                        {row.sepType === 'custom_url' && (
                          <input
                            type="text"
                            className="kx-multi-sep-url"
                            value={row.sepImage}
                            onChange={e => {
                              const next = newsRows.map((r, i) => i === idx ? { ...r, sepImage: e.target.value } : r);
                              setNewsRows(next);
                              applyMultiNews(next);
                            }}
                            placeholder="https://... or /media/..."
                          />
                        )}
                        {row.sepImage && ['media', 'upload', 'custom_url'].includes(row.sepType) && (
                          <img src={row.sepImage} alt="sep" style={{ height: 20, width: 'auto', objectFit: 'contain', borderRadius: 3 }} />
                        )}
                      </div>
                      <div className="kx-multi-row-actions">
                        <button
                          type="button"
                          className="kx-multi-row-btn add"
                          title="Add new news editor below"
                          onClick={() => {
                            const next = [...newsRows];
                            next.splice(idx + 1, 0, makeNewsRow('', row.sepType, row.sepImage));
                            setNewsRows(next);
                          }}
                        >
                          +
                        </button>
                        {newsRows.length > 1 && (
                          <button
                            type="button"
                            className="kx-multi-row-btn del"
                            title="Remove this news line"
                            onClick={() => {
                              const next = newsRows.filter((_, i) => i !== idx);
                              setNewsRows(next);
                              applyMultiNews(next);
                            }}
                          >
                            -
                          </button>
                        )}
                      </div>
                    </div>
                    <RichBroadcastEditor
                      value={row.html}
                      mediaList={data.media || []}
                      minHeight={72}
                      placeholder={`News / Flash / Ticker line #${idx + 1} (rich text, fonts, colors & images)...`}
                      onChange={(html) => {
                        const next = newsRows.map((r, i) => i === idx ? { ...r, html } : r);
                        setNewsRows(next);
                        applyMultiNews(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Field label="Combined Broadcast Output Preview / Direct Rich Editor">
              <RichBroadcastEditor
                value={draft.text}
                mediaList={data.media || []}
                minHeight={160}
                onChange={(html) => setDraft(prev => ({ ...prev, text: html }))}
              />
            </Field>
            <Field label="Subheading / Designation"><input value={draft.subtext} onChange={e => setDraft({ ...draft, subtext: e.target.value })} /></Field>
            <div className="button-row">
              <B variant="primary" icon={Save} disabled={!draft.title} onClick={() => save('draft')}>Save Draft</B>
              <B icon={Check} disabled={!draft.title} onClick={() => save('approved')}>Save Approved</B>
              {editing && (
                <B small onClick={() => { setEditing(null); setNewsRows([makeNewsRow()]); setDraft({ title: '', category: allowedCategories[0] || 'ticker', text: '', subtext: '', status: 'draft', template_id: '' }); }}>Cancel</B>
              )}
            </div>
          </div>
        </Card>

        <Card title="Publishing workflow" desc="Separation between editorial data and live CG template">
          <div className="steps">
            <div><b>01</b><strong>Draft</strong><span>Editor prepares newsroom copy</span></div>
            <div><b>02</b><strong>Approve</strong><span>Editorial review and authorization</span></div>
            <div><b>03</b><strong>Publish</strong><span>Live CG layer references approved content</span></div>
          </div>
          <B small icon={CalendarClock} onClick={() => navigate('scheduler')}>Schedule a CMS Content Item</B>
        </Card>
      </div>
    </div>
  );
}

export function MediaPage({ data, mutate, submit, remove, openUpload, onUpgrade }) {
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('all');
  const [previewItem, setPreviewItem] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameFolder, setRenameFolder] = useState('General');
  const [renameCategory, setRenameCategory] = useState('video');
  const [scheduleModalItem, setScheduleModalItem] = useState(null);
  const [schedStart, setSchedStart] = useState(localForInput());
  const [musicModalItem, setMusicModalItem] = useState(null);
  const [bulkMusicOpen, setBulkMusicOpen] = useState(false);

  const musicAllowed = Boolean(data.entitlements?.music_metadata_cms);

  const folders = useMemo(() => {
    const set = new Set(['All', 'General', 'Music', 'News', 'Promos', 'Commercials', 'Graphics', 'Audio']);
    (data.media || []).forEach(m => { if (m.folder) set.add(m.folder); });
    return Array.from(set);
  }, [data.media]);

  const filtered = useMemo(() => {
    return (data.media || []).filter(m => {
      if (folderFilter !== 'All' && (m.folder || 'General') !== folderFilter) return false;
      if (catFilter !== 'all') {
        const isImg = m.mime?.includes('image') || m.category === 'image' || m.category === 'logo';
        const isAud = m.mime?.includes('audio') || m.category === 'audio';
        const isMus = m.category === 'music';
        if (catFilter === 'music' && !isMus) return false;
        if (catFilter === 'image' && !isImg) return false;
        if (catFilter === 'audio' && !isAud) return false;
        if (catFilter === 'video' && (isImg || isAud)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const mm = m.music_metadata || {};
        const match = m.title.toLowerCase().includes(q)
          || (mm.song_title || '').toLowerCase().includes(q)
          || (mm.artist || '').toLowerCase().includes(q)
          || (mm.album || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [data.media, folderFilter, catFilter, search]);

  const usedMb = data.usage?.storage_used_mb || 0;
  const quotaGb = data.entitlements?.storage_quota_gb || data.tenant?.storage_quota_gb || 150;
  const activePlaylistId = data.playlists?.[0]?.id;

  const openMusicEditor = (item) => {
    if (!musicAllowed) {
      onUpgrade({
        title: 'Music Metadata CMS Requires Graphics Automation Pro',
        message: 'Music video metadata CMS and Automatic Music Now Playing graphics are exclusive to the Graphics Automation Pro plan (NPR 60,000/month). Switch in Demo Mode to unlock.',
        recommendedPlan: 'music_graphics_pro',
        recommendedName: 'Graphics Automation Pro (NPR 60,000/mo)'
      });
      return;
    }
    setMusicModalItem(item);
  };

  return (
    <>
      <div className="stats-grid">
        <SummaryStat icon={FolderOpen} value={(data.media || []).length} label="TOTAL MEDIA ASSETS" sub="Validated by Media Stream Inspector" />
        <SummaryStat icon={HardDrive} value={`${usedMb} MB`} label="STORAGE USED" sub={`Plan quota: ${quotaGb} GB (${data.subscription?.plan_name})`} accent="pink" />
        <SummaryStat icon={Music} value={(data.media || []).filter(m => m.category === 'music').length} label="MUSIC VIDEOS" sub={musicAllowed ? 'Auto Now Playing Enabled' : 'Upgrade for Music CG'} accent="blue" />
        <SummaryStat icon={Film} value={(data.media || []).filter(m => (m.duration || 0) > 0 && !m.mime?.includes('audio')).length} label="VIDEO CLIPS" sub="MP4 / MOV / MKV / TS" accent="green" />
      </div>

      <Card
        title="Media asset library & Music Metadata CMS"
        desc="Search, organize into folders, edit Music Now Playing metadata, preview, rename, add to playlist, or schedule"
        extra={
          <div className="button-row">
            <B small variant="outline" icon={musicAllowed ? Music : Lock} onClick={() => {
              if (!musicAllowed) openMusicEditor(null);
              else setBulkMusicOpen(true);
            }}>
              Bulk Music Metadata
            </B>
            <B small variant="primary" icon={CloudUpload} onClick={openUpload}>Upload Media</B>
          </div>
        }
      >
        <div className="media-toolbar">
          <div className="search-box">
            <Search size={15} />
            <input placeholder="Search media by title, song, artist, or album…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="category-chips" style={{ marginBottom: 0 }}>
            {[['all', 'All Types'], ['music', 'Music Videos'], ['video', 'Video'], ['audio', 'Audio'], ['image', 'Images & Logos']].map(([id, label]) => (
              <button type="button" key={id} className={catFilter === id ? 'on' : ''} onClick={() => setCatFilter(id)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="category-chips" style={{ marginTop: 10 }}>
          {folders.map(f => (
            <button type="button" key={f} className={folderFilter === f ? 'on' : ''} onClick={() => setFolderFilter(f)}>
              Folder: {f}
            </button>
          ))}
        </div>

        <div className="media-grid">
          {filtered.length ? filtered.map(m => {
            const mm = m.music_metadata;
            return (
              <div className="media-tile" key={m.id}>
                <div className="tile-picture" onClick={() => setPreviewItem(m)} style={{ cursor: 'pointer' }}>
                  <MediaThumbnail id={m.id} mime={m.mime} alt={m.title} />
                  <span>{(m.category || (m.mime?.includes('image') ? 'IMAGE' : m.mime?.includes('audio') ? 'AUDIO' : 'VIDEO')).toUpperCase()}</span>
                  <div className="tile-folder-badge">{m.folder || 'General'}</div>
                </div>
                <div className="tile-meta">
                  {renamingId === m.id ? (
                    <div className="rename-box">
                      <input value={renameTitle} onChange={e => setRenameTitle(e.target.value)} placeholder="Asset title" />
                      <select value={renameFolder} onChange={e => setRenameFolder(e.target.value)}>
                        {folders.filter(f => f !== 'All').map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <select value={renameCategory} onChange={e => setRenameCategory(e.target.value)}>
                        <option value="music">Music Video</option>
                        <option value="video">Programme Video</option>
                        <option value="promo">Promo Clip</option>
                        <option value="audio">Audio</option>
                        <option value="image">Image / Still</option>
                        <option value="logo">Logo</option>
                      </select>
                      <div className="button-row">
                        <B small variant="primary" icon={Check} onClick={async () => {
                          await submit('media', { title: renameTitle, folder: renameFolder, category: renameCategory }, m.id, 'Media updated');
                          setRenamingId(null);
                        }}>Save</B>
                        <B small onClick={() => setRenamingId(null)}>Cancel</B>
                      </div>
                    </div>
                  ) : (
                    <>
                      <b title={m.title}>{m.title}</b>
                      {mm && (mm.song_title || mm.artist || mm.album) && (
                        <small className="music-meta-line">
                          ♪ {mm.song_title || m.title} {mm.artist ? `— ${mm.artist}` : ''} {mm.album ? `(${mm.album})` : ''}
                        </small>
                      )}
                      <small>
                        {fmt(m.duration)} · {((m.size || 0) / 1024 / 1024).toFixed(1)} MB
                        {m.width ? ` · ${m.width}×${m.height}` : ''}
                        {m.codec ? ` · ${m.codec.toUpperCase()}` : ''}
                      </small>
                      <div className="tile-actions">
                        <B small icon={Eye} onClick={() => setPreviewItem(m)} title="Preview asset">Preview</B>
                        <B small icon={Edit3} onClick={() => { setRenamingId(m.id); setRenameTitle(m.title); setRenameFolder(m.folder || 'General'); setRenameCategory(m.category || 'video'); }} title="Rename / category">Edit</B>
                        {!m.mime?.includes('image') && (
                          <B small variant={m.category === 'music' ? 'primary' : 'outline'} icon={musicAllowed ? Music : Lock} onClick={() => openMusicEditor(m)} title="Edit Music Metadata & Now Playing CG">
                            Music Meta
                          </B>
                        )}
                        {(m.duration || 0) > 0 && activePlaylistId && (
                          <B small variant="outline" icon={Plus} onClick={() => submit('playlist_items', { playlist_id: activePlaylistId, media_id: m.id, position: (data.playlist_items || []).length }, null, `Added "${m.title}" to playlist`)}>
                            + Playlist
                          </B>
                        )}
                        {(m.duration || 0) > 0 && (
                          <B small variant="outline" icon={CalendarClock} onClick={() => { setScheduleModalItem(m); setSchedStart(localForInput()); }}>
                            Schedule
                          </B>
                        )}
                        <B small variant="danger" icon={Trash2} onClick={() => remove('media', m.id)} title="Delete media" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          }) : <Empty text="No media assets match your filter. Click 'Upload Media' to add videos, music videos, audio or graphics." />}
        </div>
      </Card>

      {musicModalItem && (
        <MusicMetadataModal
          open={Boolean(musicModalItem)}
          item={musicModalItem}
          onClose={() => setMusicModalItem(null)}
          mutate={mutate}
        />
      )}

      {bulkMusicOpen && (
        <BulkMusicMetadataModal
          open={bulkMusicOpen}
          onClose={() => setBulkMusicOpen(false)}
          mediaList={(data.media || []).filter(m => !m.mime?.includes('image'))}
          mutate={mutate}
        />
      )}

      {previewItem && (
        <div className="modal-backdrop" onClick={() => setPreviewItem(null)}>
          <div className="modal-card wide" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-badge"><Eye size={15} /><span>MEDIA ASSET PREVIEW</span></div>
              <button type="button" className="icon-close" onClick={() => setPreviewItem(null)}><X size={16} /></button>
            </div>
            <h3>{previewItem.title}</h3>
            <p className="muted-paragraph">
              Folder: {previewItem.folder || 'General'} • Size: {((previewItem.size || 0) / (1024 * 1024)).toFixed(2)} MB • Duration: {fmt(previewItem.duration)}
            </p>
            <div className="media-preview-stage">
              {previewItem.mime?.includes('image') ? (
                <img src={mediaStreamUrl(previewItem.id)} alt={previewItem.title} />
              ) : previewItem.mime?.includes('audio') ? (
                <audio src={mediaStreamUrl(previewItem.id)} controls autoPlay style={{ width: '100%' }} />
              ) : (
                <video src={mediaStreamUrl(previewItem.id)} controls autoPlay style={{ width: '100%', maxHeight: 380 }} />
              )}
            </div>
          </div>
        </div>
      )}

      {scheduleModalItem && (
        <div className="modal-backdrop" onClick={() => setScheduleModalItem(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-badge"><CalendarClock size={15} /><span>SCHEDULE BROADCAST MEDIA</span></div>
              <button type="button" className="icon-close" onClick={() => setScheduleModalItem(null)}><X size={16} /></button>
            </div>
            <h3>Schedule: {scheduleModalItem.title}</h3>
            <Field label="Start time (Asia/Kathmandu)">
              <input type="datetime-local" value={schedStart} onChange={e => setSchedStart(e.target.value)} />
            </Field>
            <div className="modal-actions">
              <B onClick={() => setScheduleModalItem(null)}>Cancel</B>
              <B variant="primary" icon={CalendarClock} onClick={async () => {
                await submit('schedules', {
                  name: scheduleModalItem.title,
                  kind: 'media',
                  target_id: scheduleModalItem.id,
                  starts_at: asKtmIso(schedStart),
                  duration_sec: Math.max(10, Math.round(scheduleModalItem.duration || 60)),
                  repeat: 'none',
                  priority: 50,
                  enabled: 1
                }, null, `Scheduled "${scheduleModalItem.title}"`);
                setScheduleModalItem(null);
              }}>
                Confirm Schedule
              </B>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Streaming({ data, submit, remove, mutate, onUpgrade, navigate }) {
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState('rtmp');
  const [url, setUrl] = useState('rtmp://ingest.kashtrix.tv:1935/live/channel1');
  const [streamKey, setStreamKey] = useState('');
  const [streamMode, setStreamMode] = useState('caller');
  const [latencyMs, setLatencyMs] = useState(120);
  const [passphrase, setPassphrase] = useState('');
  const [pktSize, setPktSize] = useState(1316);
  const [ttl, setTtl] = useState(64);
  const [hlsSegmentSec, setHlsSegmentSec] = useState(2);
  const [hlsWindowSize, setHlsWindowSize] = useState(6);
  const [customEncoding, setCustomEncoding] = useState(false);
  const [customBitrate, setCustomBitrate] = useState('4500k');
  const [customResolution, setCustomResolution] = useState('source');
  const [customFps, setCustomFps] = useState('source');
  const [customAudioBitrate, setCustomAudioBitrate] = useState('128k');
  const [customPreset, setCustomPreset] = useState('veryfast');
  const [editing, setEditing] = useState(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Master streaming encoder settings (sync with data.settings)
  const [encResolution, setEncResolution] = useState(data.settings?.resolution || '1080p');
  const [encBitrate, setEncBitrate] = useState(data.settings?.video_bitrate || '4500k');
  const [encFps, setEncFps] = useState(data.settings?.fps || '25');
  const [encPreset, setEncPreset] = useState(data.settings?.preset || 'veryfast');
  const [encAudioBitrate, setEncAudioBitrate] = useState(data.settings?.audio_bitrate || '128k');
  const [encKeyintSec, setEncKeyintSec] = useState(data.settings?.keyint_sec || '2');
  const [encRateControl, setEncRateControl] = useState(data.settings?.rate_control || 'cbr');

  useEffect(() => {
    setEncResolution(data.settings?.resolution || '1080p');
    setEncBitrate(data.settings?.video_bitrate || '4500k');
    setEncFps(data.settings?.fps || '25');
    setEncPreset(data.settings?.preset || 'veryfast');
    setEncAudioBitrate(data.settings?.audio_bitrate || '128k');
    setEncKeyintSec(data.settings?.keyint_sec || '2');
    setEncRateControl(data.settings?.rate_control || 'cbr');
  }, [
    data.settings?.resolution,
    data.settings?.video_bitrate,
    data.settings?.fps,
    data.settings?.preset,
    data.settings?.audio_bitrate,
    data.settings?.keyint_sec,
    data.settings?.rate_control
  ]);

  // Enterprise Live Input Streaming state
  const [inputName, setInputName] = useState('');
  const [inputType, setInputType] = useState('live_stream');
  const [inputProtocol, setInputProtocol] = useState('rtmp');
  const [inputUrl, setInputUrl] = useState('rtmp://ingest.kashtrix.cloud/live/studio_feed');
  const [inputStreamKey, setInputStreamKey] = useState('');
  const [inputLatency, setInputLatency] = useState(120);
  const [inputEditing, setInputEditing] = useState(null);

  const allowedProtocols = data.entitlements?.protocols || ['rtmp'];
  const allowedBitrates = data.entitlements?.allowed_bitrates || ['1500k', '2500k', '3500k', '4500k', '5500k', '6500k', '7500k'];
  const allowedResolutions = data.entitlements?.resolutions || ['360p', '480p', '720p', '1080p'];
  const maxBitrateKbps = data.entitlements?.max_bitrate_kbps || 8000;
  const customEncodingAllowed = Boolean(data.entitlements?.custom_output_encoding);
  const maxOutputs = data.entitlements?.max_outputs || data.tenant?.max_outputs || 8;
  const embedAllowed = Boolean(data.entitlements?.embed_player);
  const liveInputsAllowed = Boolean(data.entitlements?.live_input_streaming);
  const maxInputs = data.entitlements?.max_inputs || 0;
  const activeLiveInputId = data.engine?.live_input_id;
  const masterVol = Number(data.settings?.master_volume ?? 100);
  const [streamVol, setStreamVol] = useState(() => (
    data.settings?.stream_volume !== undefined && data.settings?.stream_volume !== ''
      ? Number(data.settings.stream_volume)
      : masterVol
  ));
  const [streamVolCustom, setStreamVolCustom] = useState(() => (
    data.settings?.stream_volume !== undefined && data.settings?.stream_volume !== ''
  ));

  useEffect(() => {
    const hasCustom = data.settings?.stream_volume !== undefined && data.settings?.stream_volume !== '';
    setStreamVolCustom(hasCustom);
    setStreamVol(hasCustom ? Number(data.settings.stream_volume) : masterVol);
  }, [data.settings?.stream_volume, masterVol]);

  const getProtocolDefaultUrl = (proto) => {
    if (proto === 'youtube') return 'rtmps://a.rtmps.youtube.com/live2/';
    if (proto === 'facebook') return 'rtmps://live-api-s.facebook.com:443/rtmp/';
    if (proto === 'srt') return `srt://headend.kashtrix.tv:9000?mode=${streamMode || 'caller'}&latency=${latencyMs || 120}`;
    if (proto === 'udp') return `udp://239.10.10.1:5000?pkt_size=${pktSize || 1316}&ttl=${ttl || 64}`;
    if (proto === 'hls') return location.origin + '/hls/channel1/index.m3u8';
    return 'rtmp://ingest.kashtrix.tv:1935/live/channel1';
  };

  const handleProtocolSelect = (proto) => {
    if (!allowedProtocols.includes(proto)) {
      const recPlan = ['youtube', 'facebook', 'hls'].includes(proto) ? 'digital_360' : 'news_pro';
      const recName = recPlan === 'digital_360' ? 'Digital 360 (NPR 30,000/mo)' : 'News Pro (NPR 25,000/mo)';
      onUpgrade({
        title: `${proto.toUpperCase()} Output Requires ${recName}`,
        message: `Your active ${data.subscription?.plan_name} plan supports ${(data.subscription?.protocol_labels || ['RTMP']).join(', ')}. Upgrade in Demo Mode to unlock ${proto.toUpperCase()} streaming.`,
        recommendedPlan: recPlan,
        recommendedName: recName
      });
      return;
    }
    setProtocol(proto);
    setUrl(getProtocolDefaultUrl(proto));
  };

  const save = async () => {
    const r = await submit('outputs', {
      name,
      protocol,
      url,
      stream_key: streamKey,
      stream_mode: streamMode,
      latency_ms: Number(latencyMs) || 120,
      passphrase,
      pkt_size: Number(pktSize) || 1316,
      ttl: Number(ttl) || 64,
      hls_segment_sec: Number(hlsSegmentSec) || 2,
      hls_window_size: Number(hlsWindowSize) || 6,
      config_json: JSON.stringify({
        custom_encoding: Boolean(customEncoding && customEncodingAllowed),
        video_bitrate: customBitrate,
        resolution: customResolution,
        fps: customFps,
        audio_bitrate: customAudioBitrate,
        preset: customPreset
      }),
      enabled: editing ? ((data.outputs || []).find(o => o.id === editing)?.enabled || 0) : 1
    }, editing);
    if (r) {
      setName('');
      setUrl('');
      setStreamKey('');
      setPassphrase('');
      setCustomEncoding(false);
      setEditing(null);
    }
  };

  const saveInput = async () => {
    if (!liveInputsAllowed) {
      onUpgrade({
        title: 'Enterprise Live Input Streaming Requires Broadcast Plus or Graphics Automation Pro',
        message: 'Live Studio Ingest (RTMP, SRT, UDP, HLS live camera & OB van feeds) is an Enterprise solution included in Broadcast Plus (NPR 45,000/mo) and Graphics Automation Pro (NPR 60,000/mo).',
        recommendedPlan: 'broadcast_plus',
        recommendedName: 'Broadcast Plus (NPR 45,000/mo)'
      });
      return;
    }
    const r = await submit('inputs', {
      name: inputName,
      source_type: inputType,
      input_type: inputType,
      protocol: inputProtocol,
      url: inputUrl,
      passphrase: inputStreamKey,
      latency_ms: Number(inputLatency) || 120,
      enabled: 1
    }, inputEditing);
    if (r) {
      setInputName('');
      setInputStreamKey('');
      setInputEditing(null);
    }
  };

  return (
    <>
      <div className="stats-grid">
        <SummaryStat icon={Radio} value={`${(data.outputs || []).filter(o => o.enabled).length} / ${maxOutputs}`} label="ACTIVE RELAYS" sub={`${Math.max(0, maxOutputs - (data.outputs || []).length)} destination slots left`} accent="pink" />
        <SummaryStat icon={Airplay} value={`${(data.outputs || []).length} / ${maxOutputs}`} label="CONFIGURED OUTPUTS" sub={`Plan: ${data.subscription?.plan_name}`} />
        <SummaryStat icon={Gauge} value={data.settings?.video_bitrate || '4500k'} label="ENCODER BITRATE" sub="Single encode, multi-destination relay" accent="blue" />
        <SummaryStat icon={Wifi} value={liveInputsAllowed ? `${(data.inputs || []).length} / ${maxInputs} Live Inputs` : (data.subscription?.protocol_labels || ['RTMP']).slice(0, 3).join(' / ')} label={liveInputsAllowed ? 'ENTERPRISE LIVE INGEST' : 'ENTITLED PROTOCOLS'} sub={liveInputsAllowed ? (activeLiveInputId ? 'LIVE INPUT ON AIR' : 'Studio & OB Van Ready') : 'Upgrade for Live Ingest'} accent="green" />
      </div>

      <div className="grid-main">
        <Card title="Streaming destinations" desc="One H.264 encode, independent multi-protocol output relays & automatic recovery">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', marginBottom: 12, borderRadius: 10, background: 'rgba(15, 23, 42, 0.55)', border: '1px solid rgba(148, 163, 184, 0.16)' }}>
            <div>
              <strong style={{ fontSize: 13 }}>Streaming Output Volume: {streamVolCustom ? `${streamVol}% (Custom)` : `${masterVol}% (Matches Playout Master)`}</strong>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Uses Playout Master volume by default, or adjust independently for streaming destinations</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min="0"
                max="200"
                value={streamVol}
                onChange={e => { setStreamVolCustom(true); setStreamVol(Number(e.target.value)); }}
                style={{ width: 130 }}
                title={`Streaming Output Volume: ${streamVol}%`}
              />
              <B small variant="primary" onClick={() => mutate('/settings', 'POST', { values: { stream_volume: String(streamVol) } }, `Streaming volume set to ${streamVol}%`)}>
                Apply ({streamVol}%)
              </B>
              {streamVolCustom && (
                <B small onClick={() => mutate('/settings', 'POST', { values: { stream_volume: '' } }, 'Streaming volume matched to Master')}>
                  Match Master
                </B>
              )}
            </div>
          </div>
          <div className="destinations">
            {(data.outputs || []).map(o => {
              const protoAllowed = allowedProtocols.includes(o.protocol);
              let outCfg = {};
              try {
                outCfg = o.config_json ? JSON.parse(o.config_json) : {};
              } catch {}
              const outErr = data.engine?.output_errors?.[String(o.id)] || data.engine?.output_errors?.[o.id];
              return (
                <div key={o.id} className="destination">
                  <div className={'destination-icon ' + o.protocol}><Radio size={16} /></div>
                  <div className="destination-details">
                    <strong>{o.name}</strong>
                    <small>{o.url}</small>
                    <div className="destination-meta">
                      <Pill color={protoAllowed ? 'purple' : 'red'}>{o.protocol.toUpperCase()}</Pill>
                      {outCfg.custom_encoding ? (
                        <Pill color="green">CUSTOM {outCfg.video_bitrate || '4500k'}{outCfg.resolution && outCfg.resolution !== 'source' ? ` • ${outCfg.resolution}` : ''}</Pill>
                      ) : (
                        <Pill color="muted">MASTER PASS-THROUGH ({data.settings?.video_bitrate || '4500k'})</Pill>
                      )}
                      {o.protocol === 'srt' && <Pill color="blue">SRT {o.stream_mode || 'caller'} • {o.latency_ms || 120}ms</Pill>}
                      {o.protocol === 'udp' && <Pill color="blue">PKT {o.pkt_size || 1316}B • TTL {o.ttl || 64}</Pill>}
                      {o.protocol === 'hls' && <Pill color="blue">SEG {o.hls_segment_sec || 2}s × {o.hls_window_size || 6}</Pill>}
                      <span>{ru(data.engine?.outputs?.[o.id])}</span>
                    </div>
                    {outErr && (
                      <small style={{ color: '#f87171', display: 'block', marginTop: 4 }}>
                        Relay error: {outErr}
                      </small>
                    )}
                  </div>
                  <div className="destination-ctrl">
                    <button
                      type="button"
                      className={'switch ' + (o.enabled ? 'checked' : '')}
                      onClick={() => submit('outputs', { ...o, enabled: o.enabled ? 0 : 1 }, o.id)}
                      title="Enable/disable relay"
                    ><i /></button>
                    <button type="button" title="Edit protocol & encoding settings" onClick={() => {
                      setEditing(o.id);
                      setName(o.name);
                      setProtocol(o.protocol);
                      setUrl(o.edit_url || (o.url && !o.url.includes('••••') ? o.url : getProtocolDefaultUrl(o.protocol)));
                      setStreamKey(o.stream_key || '');
                      setStreamMode(o.stream_mode || 'caller');
                      setLatencyMs(o.latency_ms || 120);
                      setPktSize(o.pkt_size || 1316);
                      setTtl(o.ttl || 64);
                      setHlsSegmentSec(o.hls_segment_sec || 2);
                      setHlsWindowSize(o.hls_window_size || 6);
                      setCustomEncoding(Boolean(outCfg.custom_encoding));
                      setCustomBitrate(outCfg.video_bitrate || data.settings?.video_bitrate || '4500k');
                      setCustomResolution(outCfg.resolution || 'source');
                      setCustomFps(outCfg.fps || 'source');
                      setCustomAudioBitrate(outCfg.audio_bitrate || '128k');
                      setCustomPreset(outCfg.preset || 'veryfast');
                    }}><SlidersHorizontal size={15} /></button>
                    <button type="button" onClick={() => remove('outputs', o.id)} title="Remove"><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
            {!(data.outputs || []).length && <Empty text="No destinations configured. Add RTMP, RTMPS, SRT, UDP or social outputs on the right." />}
          </div>
        </Card>

        <Card title={editing ? 'Edit destination & protocol parameters' : 'Add a destination'} desc={`Remaining slots on ${data.subscription?.plan_name}: ${Math.max(0, maxOutputs - (data.outputs || []).length)} of ${maxOutputs}`}>
          <div className="form-stack">
            <Field label="Destination name"><input value={name} onChange={e => setName(e.target.value)} placeholder="YouTube Live / Facebook / Cable Headend" /></Field>
            <Field label="Protocol">
              <select value={protocol} onChange={e => handleProtocolSelect(e.target.value)}>
                <option value="rtmp">RTMP / RTMPS</option>
                <option value="srt">SRT / MPEG-TS {!allowedProtocols.includes('srt') ? '(News Pro+)' : ''}</option>
                <option value="udp">UDP unicast / MPEG-TS {!allowedProtocols.includes('udp') ? '(News Pro+)' : ''}</option>
                <option value="youtube">YouTube Live Integration {!allowedProtocols.includes('youtube') ? '(Digital 360+)' : ''}</option>
                <option value="facebook">Facebook Live Integration {!allowedProtocols.includes('facebook') ? '(Digital 360+)' : ''}</option>
                <option value="hls">HLS Origin Slot {!allowedProtocols.includes('hls') ? '(Digital 360+)' : ''}</option>
              </select>
            </Field>
            <Field label="Destination URL / Server Endpoint">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder={
                  protocol === 'rtmp' || protocol === 'youtube' || protocol === 'facebook'
                    ? 'rtmps://a.rtmps.youtube.com/live2/'
                    : protocol === 'srt'
                      ? 'srt://headend.example.com:9000'
                      : protocol === 'udp'
                        ? 'udp://203.0.113.10:1234'
                        : location.origin + '/hls/channel1/index.m3u8'
                }
              />
            </Field>

            {/* Protocol-specific configuration fields */}
            {['rtmp', 'youtube', 'facebook'].includes(protocol) && (
              <Field label="Stream Key (Optional if included in URL)">
                <input
                  type="password"
                  value={streamKey}
                  onChange={e => setStreamKey(e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                />
              </Field>
            )}

            {protocol === 'srt' && (
              <div className="form-grid">
                <Field label="SRT Connection Mode">
                  <select value={streamMode} onChange={e => setStreamMode(e.target.value)}>
                    <option value="caller">Caller</option>
                    <option value="listener">Listener</option>
                    <option value="rendezvous">Rendezvous</option>
                  </select>
                </Field>
                <Field label="SRT Latency (ms)">
                  <input type="number" min="20" max="8000" value={latencyMs} onChange={e => setLatencyMs(e.target.value)} />
                </Field>
                <Field label="SRT Encryption Passphrase">
                  <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="Optional AES passphrase" />
                </Field>
              </div>
            )}

            {protocol === 'udp' && (
              <div className="form-grid">
                <Field label="MPEG-TS Packet Size (Bytes)">
                  <input type="number" value={pktSize} onChange={e => setPktSize(e.target.value)} />
                </Field>
                <Field label="Multicast / Unicast TTL">
                  <input type="number" min="1" max="255" value={ttl} onChange={e => setTtl(e.target.value)} />
                </Field>
              </div>
            )}

            {protocol === 'hls' && (
              <div className="form-grid">
                <Field label="HLS Segment Duration (sec)">
                  <input type="number" min="1" max="10" value={hlsSegmentSec} onChange={e => setHlsSegmentSec(e.target.value)} />
                </Field>
                <Field label="HLS Playlist Window (segments)">
                  <input type="number" min="3" max="30" value={hlsWindowSize} onChange={e => setHlsWindowSize(e.target.value)} />
                </Field>
              </div>
            )}

            {/* Subscription-based Custom Per-Destination Encoding */}
            <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(15,23,42,0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: customEncoding && customEncodingAllowed ? 10 : 0 }}>
                <div>
                  <strong style={{ fontSize: 12 }}>Custom Output Encoding</strong>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {customEncodingAllowed
                      ? `Override master bitrate & resolution (Max ${maxBitrateKbps}k on ${data.subscription?.plan_name})`
                      : `Requires News Pro+ (Current: ${data.subscription?.plan_name})`}
                  </div>
                </div>
                {customEncodingAllowed ? (
                  <button
                    type="button"
                    className={'switch ' + (customEncoding ? 'checked' : '')}
                    onClick={() => setCustomEncoding(!customEncoding)}
                    title="Toggle custom per-destination encoding"
                  ><i /></button>
                ) : (
                  <B small icon={Lock} onClick={() => onUpgrade({
                    title: 'Custom Per-Destination Encoding Requires News Pro+',
                    message: `Set custom bitrate, resolution, and audio encoding per streaming destination. Upgrade from ${data.subscription?.plan_name} to unlock.`,
                    recommendedPlan: 'news_pro',
                    recommendedName: 'News Pro (NPR 25,000/mo)'
                  })}>Unlock</B>
                )}
              </div>

              {customEncoding && customEncodingAllowed && (
                <div className="form-grid" style={{ marginTop: 8 }}>
                  <Field label={`Video Bitrate (Preset or Custom up to ${maxBitrateKbps}k)`}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        value={allowedBitrates.includes(customBitrate) ? customBitrate : 'custom'}
                        onChange={e => e.target.value !== 'custom' && setCustomBitrate(e.target.value)}
                      >
                        {allowedBitrates.map(v => <option key={v} value={v}>{v}</option>)}
                        <option value="custom">Custom</option>
                      </select>
                      <input
                        type="number"
                        min="500"
                        max={maxBitrateKbps}
                        step="100"
                        style={{ width: 92 }}
                        value={parseInt(String(customBitrate).replace(/[^0-9]/g, ''), 10) || 4500}
                        onChange={e => {
                          const v = Math.max(500, Math.min(maxBitrateKbps, Number(e.target.value) || 500));
                          setCustomBitrate(`${v}k`);
                        }}
                        title="Custom bitrate in kbps"
                      />
                    </div>
                  </Field>
                  <Field label="Resolution">
                    <select value={customResolution} onChange={e => setCustomResolution(e.target.value)}>
                      <option value="source">Same as Master ({data.settings?.resolution || '1080p'})</option>
                      {allowedResolutions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Audio Bitrate">
                    <select value={customAudioBitrate} onChange={e => setCustomAudioBitrate(e.target.value)}>
                      <option value="96k">96k AAC</option>
                      <option value="128k">128k AAC</option>
                      <option value="192k">192k AAC</option>
                      <option value="256k">256k AAC</option>
                    </select>
                  </Field>
                  <Field label="Frame Rate">
                    <select value={customFps} onChange={e => setCustomFps(e.target.value)}>
                      <option value="source">Same as Master ({data.settings?.fps || '25'} fps)</option>
                      <option value="24">24 fps</option>
                      <option value="25">25 fps</option>
                      <option value="30">30 fps</option>
                    </select>
                  </Field>
                  <Field label="Encoder Profile">
                    <select value={customPreset} onChange={e => setCustomPreset(e.target.value)}>
                      {['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
            </div>

            <B
              icon={Plus}
              variant="primary"
              disabled={!name || (!editing && !url) || ((data.outputs || []).length >= maxOutputs && !editing)}
              onClick={save}
            >
              {editing ? 'Save Output Settings' : 'Add Output Destination'}
            </B>
            {editing && <B small onClick={() => { setEditing(null); setName(''); setUrl(''); setStreamKey(''); }}>Cancel Edit</B>}

            <div className="embed-snippet">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>Website HTML iframe player (16:9 Live + CG)</b>
                <Pill color={embedAllowed ? 'green' : 'muted'}>{embedAllowed ? 'INCLUDED' : 'DIGITAL 360+ REQUIRED'}</Pill>
              </div>
              {embedAllowed ? (
                <>
                  <code style={{ userSelect: 'all', fontSize: '11px' }}>
                    {`<iframe src="${location.origin}/?embed=channel1" width="100%" height="540" style="aspect-ratio:16/9;border:0;" allow="autoplay; fullscreen" allowfullscreen></iframe>`}
                  </code>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <B
                      small
                      onClick={() => {
                        const snippet = `<iframe src="${location.origin}/?embed=channel1" width="100%" height="540" style="aspect-ratio:16/9;border:0;" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
                        navigator.clipboard?.writeText(snippet);
                        setCopiedEmbed(true);
                        setTimeout(() => setCopiedEmbed(false), 2200);
                      }}
                    >
                      {copiedEmbed ? '✓ Copied Iframe Embed Code' : 'Copy Iframe Embed Code'}
                    </B>
                    <B
                      small
                      variant="secondary"
                      onClick={() => window.open(`${location.origin}/?embed=channel1`, '_blank')}
                    >
                      Preview Web Embed Player
                    </B>
                  </div>
                </>
              ) : (
                <B small icon={Lock} onClick={() => navigate('subscriptions')}>Upgrade to Digital 360 to unlock website player</B>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* MASTER STREAMING ENCODING (SUBSCRIPTION-AWARE) */}
      <div style={{ marginTop: 18 }}>
        <Card
          title="Master H.264 Streaming Encoding"
          desc={`Plan: ${data.subscription?.plan_name} • Max Bitrate ${maxBitrateKbps}k • Resolutions: ${allowedResolutions.join(', ')}`}
          right={<Pill color="purple">{encResolution.toUpperCase()} • {encBitrate} • {encFps} FPS</Pill>}
        >
          <div className="form-grid">
            <Field label="Output Resolution">
              <select value={encResolution} onChange={e => setEncResolution(e.target.value)}>
                {allowedResolutions.map(r => (
                  <option key={r} value={r}>
                    {r === '360p' ? '640 × 360 (360p)' : r === '480p' ? '854 × 480 (480p)' : r === '720p' ? '1280 × 720 (HD 720p)' : '1920 × 1080 (Full HD 1080p)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`H.264 Video Bitrate (Max ${maxBitrateKbps}k)`}>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={allowedBitrates.includes(encBitrate) ? encBitrate : 'custom'}
                  onChange={e => e.target.value !== 'custom' && setEncBitrate(e.target.value)}
                >
                  {allowedBitrates.map(v => <option key={v} value={v}>{v}</option>)}
                  <option value="custom">Custom</option>
                </select>
                <input
                  type="number"
                  min="500"
                  max={maxBitrateKbps}
                  step="100"
                  style={{ width: 96 }}
                  value={parseInt(String(encBitrate).replace(/[^0-9]/g, ''), 10) || 4500}
                  onChange={e => {
                    const v = Math.max(500, Math.min(maxBitrateKbps, Number(e.target.value) || 500));
                    setEncBitrate(`${v}k`);
                  }}
                  title="Custom bitrate in kbps"
                />
              </div>
            </Field>
            <Field label="Frame Rate">
              <select value={encFps} onChange={e => setEncFps(e.target.value)}>
                <option value="24">24 fps</option>
                <option value="25">25 fps</option>
                <option value="30">30 fps</option>
              </select>
            </Field>
            <Field label="Encoder Profile">
              <select value={encPreset} onChange={e => setEncPreset(e.target.value)}>
                {['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Audio Bitrate (AAC 48kHz)">
              <select value={encAudioBitrate} onChange={e => setEncAudioBitrate(e.target.value)}>
                <option value="96k">96k AAC</option>
                <option value="128k">128k AAC</option>
                <option value="192k">192k AAC</option>
                <option value="256k">256k AAC</option>
              </select>
            </Field>
            <Field label="Keyframe Interval (GOP)">
              <select value={encKeyintSec} onChange={e => setEncKeyintSec(e.target.value)}>
                <option value="1">1 sec (Low Latency)</option>
                <option value="2">2 sec (YouTube / Broadcast)</option>
                <option value="3">3 sec</option>
                <option value="4">4 sec</option>
              </select>
            </Field>
            <Field label="Rate Control">
              <select value={encRateControl} onChange={e => setEncRateControl(e.target.value)}>
                <option value="cbr">CBR (Constant Bitrate)</option>
                <option value="vbr">VBR (Variable Bitrate)</option>
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <B
              variant="primary"
              icon={Save}
              onClick={() => mutate('/settings', 'POST', {
                values: {
                  resolution: encResolution,
                  video_bitrate: encBitrate,
                  fps: encFps,
                  preset: encPreset,
                  audio_bitrate: encAudioBitrate,
                  keyint_sec: encKeyintSec,
                  rate_control: encRateControl
                }
              })}
            >
              Apply Streaming Encoding
            </B>
            {maxBitrateKbps < 9000 && (
              <B small variant="outline" icon={Lock} onClick={() => navigate('subscriptions')}>
                Upgrade Plan for Higher Bitrate (up to 9000k)
              </B>
            )}
          </div>
        </Card>
      </div>

      {/* ENTERPRISE LIVE INPUT STREAMING SECTION */}
      <div className="grid-main" style={{ marginTop: 18 }}>
        <Card
          title="Enterprise Live Streaming Inputs (Studio & OB Van Ingest)"
          desc="Switch live camera, studio deck, or remote OB van feeds directly to programme air with full CG overlay compositing"
          extra={
            <Pill color={liveInputsAllowed ? 'magenta' : 'amber'} dot>
              {liveInputsAllowed ? `ENTERPRISE UNLOCKED (${(data.inputs || []).length}/${maxInputs})` : 'BROADCAST PLUS / MUSIC PRO ONLY'}
            </Pill>
          }
        >
          {!liveInputsAllowed ? (
            <div className="upgrade-callout">
              <div>
                <strong>Live Input Streaming is an Enterprise Solution</strong>
                <p className="muted-paragraph">
                  Ingest live RTMP, SRT, UDP, and HLS feeds from studio switchers or remote field units and cut directly to programme air with CG timelines. Available on Broadcast Plus (NPR 45,000/mo) and Graphics Automation Pro (NPR 60,000/mo).
                </p>
              </div>
              <B variant="primary" icon={Lock} onClick={() => navigate('subscriptions')}>Upgrade Plan in Demo Mode</B>
            </div>
          ) : (
            <div className="destinations">
              {(data.inputs || []).map(inp => {
                const isOnAir = Number(activeLiveInputId) === Number(inp.id);
                return (
                  <div key={inp.id} className={'destination ' + (isOnAir ? 'live-input-active' : '')}>
                    <div className={'destination-icon ' + inp.protocol}><Wifi size={16} /></div>
                    <div className="destination-details">
                      <strong>{inp.name}</strong>
                      <small>{inp.url}</small>
                      <div className="destination-meta">
                        <Pill color={isOnAir ? 'red' : 'purple'} dot={isOnAir}>
                          {isOnAir ? 'ON PROGRAMME AIR' : inp.protocol?.toUpperCase()}
                        </Pill>
                        <Pill color="blue">{(inp.source_type || inp.input_type || 'live_input').replace('_', ' ').toUpperCase()}</Pill>
                        <span>Latency: {inp.latency_ms || 120}ms</span>
                      </div>
                    </div>
                    <div className="destination-ctrl">
                      {isOnAir ? (
                        <B small variant="danger" onClick={() => mutate(`/inputs/${inp.id}/stop`, 'POST', {}, 'Returned to automated playlist')}>
                          Return to Playlist
                        </B>
                      ) : (
                        <B small variant="primary" onClick={() => mutate(`/inputs/${inp.id}/take`, 'POST', {}, `LIVE INPUT ON AIR: ${inp.name}`)}>
                          TAKE LIVE TO AIR
                        </B>
                      )}
                      <button type="button" title="Edit input" onClick={() => {
                        setInputEditing(inp.id);
                        setInputName(inp.name);
                        setInputType(inp.source_type || inp.input_type || 'live_input');
                        setInputProtocol(inp.protocol || 'rtmp');
                        setInputUrl(inp.url || '');
                        setInputLatency(inp.latency_ms || 120);
                      }}><SlidersHorizontal size={15} /></button>
                      <button type="button" onClick={() => remove('inputs', inp.id)} title="Remove input"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
              {!(data.inputs || []).length && <Empty text="No live streaming inputs configured yet. Add a studio or OB van ingest feed on the right." />}
            </div>
          )}
        </Card>

        <Card
          title={inputEditing ? 'Edit Live Input Source' : 'Add Live Streaming Input'}
          desc={liveInputsAllowed ? `Configure RTMP, SRT, UDP or HLS live ingest (${(data.inputs || []).length} / ${maxInputs} slots)` : 'Requires Enterprise Plan (Broadcast Plus / Graphics Automation Pro)'}
        >
          <div className="form-stack">
            <Field label="Input Source Name">
              <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="Studio A Camera / Remote OB Van 1" disabled={!liveInputsAllowed} />
            </Field>
            <div className="form-grid">
              <Field label="Source Type">
                <select value={inputType} onChange={e => setInputType(e.target.value)} disabled={!liveInputsAllowed}>
                  <option value="studio">Studio Camera / Switcher</option>
                  <option value="live_stream">Remote OB Van / Field Link</option>
                  <option value="satellite">Satellite / IRD Downlink</option>
                </select>
              </Field>
              <Field label="Ingest Protocol">
                <select
                  value={inputProtocol}
                  onChange={e => {
                    const p = e.target.value;
                    setInputProtocol(p);
                    if (p === 'rtmp') setInputUrl('rtmp://ingest.kashtrix.cloud/live/studio_feed');
                    else if (p === 'srt') setInputUrl('srt://ingest.kashtrix.cloud:9000?mode=listener&latency=120');
                    else if (p === 'udp') setInputUrl('udp://0.0.0.0:5000?pkt_size=1316');
                    else if (p === 'hls') setInputUrl('https://ingest.kashtrix.cloud/live/remote_feed/index.m3u8');
                  }}
                  disabled={!liveInputsAllowed}
                >
                  <option value="rtmp">RTMP / RTMPS Ingest</option>
                  <option value="srt">SRT Caller / Listener</option>
                  <option value="udp">UDP MPEG-TS Unicast</option>
                  <option value="hls">HLS Pull Stream</option>
                </select>
              </Field>
            </div>
            <Field label="Ingest Stream URL">
              <input value={inputUrl} onChange={e => setInputUrl(e.target.value)} placeholder="rtmp://ingest.kashtrix.cloud/live/studio_a" disabled={!liveInputsAllowed} />
            </Field>
            <div className="form-grid">
              <Field label="Stream Key / Passphrase (Optional)">
                <input type="password" value={inputStreamKey} onChange={e => setInputStreamKey(e.target.value)} placeholder="Optional ingest key" disabled={!liveInputsAllowed} />
              </Field>
              <Field label="Buffer Latency (ms)">
                <input type="number" min="20" max="5000" value={inputLatency} onChange={e => setInputLatency(e.target.value)} disabled={!liveInputsAllowed} />
              </Field>
            </div>
            <B
              icon={Plus}
              variant="primary"
              disabled={liveInputsAllowed && (!inputName || !inputUrl)}
              onClick={saveInput}
            >
              {!liveInputsAllowed ? 'Unlock Enterprise Live Inputs' : inputEditing ? 'Update Live Input' : 'Add Live Input Feed'}
            </B>
            {inputEditing && <B small onClick={() => { setInputEditing(null); setInputName(''); }}>Cancel Edit</B>}
          </div>
        </Card>
      </div>
    </>
  );
}

export function LiveInputsPage({ data, submit, remove, mutate, onUpgrade, navigate }) {
  const [inputName, setInputName] = useState('');
  const [inputType, setInputType] = useState('studio_input');
  const [inputProtocol, setInputProtocol] = useState('rtmp');
  const [inputUrl, setInputUrl] = useState('rtmp://ingest.kashtrix.local:1935/live/studio_a');
  const [backupUrl, setBackupUrl] = useState('');
  const [streamMode, setStreamMode] = useState('listener');
  const [passphrase, setPassphrase] = useState('');
  const [inputLatency, setInputLatency] = useState(250);
  const [bufferMs, setBufferMs] = useState(1000);
  const [autoFallback, setAutoFallback] = useState(1);
  const [inputEditing, setInputEditing] = useState(null);

  const liveInputsAllowed = Boolean(data.entitlements?.live_input_streaming);
  const maxInputs = data.entitlements?.max_inputs || 0;
  const activeLiveInputId = data.engine?.live_input_id;
  const activeInputObj = (data.inputs || []).find(i => Number(i.id) === Number(activeLiveInputId));

  const saveInput = async () => {
    if (!liveInputsAllowed) {
      onUpgrade({
        title: 'Enterprise Live Input Streaming Requires Broadcast Plus or Graphics Automation Pro',
        message: 'Live Studio Ingest (RTMP, SRT, UDP, HLS live camera & OB van feeds) is an Enterprise solution included in Broadcast Plus (NPR 45,000/mo) and Graphics Automation Pro (NPR 60,000/mo).',
        recommendedPlan: 'broadcast_plus',
        recommendedName: 'Broadcast Plus (NPR 45,000/mo)'
      });
      return;
    }
    const r = await submit('inputs', {
      name: inputName,
      source_type: inputType,
      protocol: inputProtocol,
      url: inputUrl,
      backup_url: backupUrl,
      stream_mode: streamMode,
      passphrase,
      latency_ms: Number(inputLatency) || 250,
      buffer_ms: Number(bufferMs) || 1000,
      auto_fallback: Boolean(autoFallback),
      enabled: 1
    }, inputEditing);
    if (r) {
      setInputName('');
      setBackupUrl('');
      setPassphrase('');
      setInputEditing(null);
    }
  };

  return (
    <>
      <div className="stats-grid">
        <SummaryStat
          icon={Wifi}
          value={liveInputsAllowed ? `${(data.inputs || []).length} / ${maxInputs}` : 'LOCKED'}
          label="CONFIGURED LIVE INPUTS"
          sub={liveInputsAllowed ? `Plan: ${data.subscription?.plan_name}` : 'Requires Enterprise Plan'}
          accent="pink"
        />
        <SummaryStat
          icon={Radio}
          value={activeInputObj ? 'LIVE ON AIR' : 'PLAYLIST AUTO'}
          label="ACTIVE INGEST SOURCE"
          sub={activeInputObj ? activeInputObj.name : '24/7 Automated Playout Active'}
          accent={activeInputObj ? 'green' : 'purple'}
        />
        <SummaryStat
          icon={Layers}
          value={`${(data.cg || []).filter(c => c.effective_active).length} Active`}
          label="CG OVERLAY COMPOSITING"
          sub="Real-time graphics over live camera ingest"
          accent="blue"
        />
        <SummaryStat
          icon={Shield}
          value="AUTO-FALLBACK"
          label="SIGNAL RECOVERY"
          sub="Returns to playlist if live link drops"
          accent="green"
        />
      </div>

      <div className="grid-main">
        <Card
          title="Live Ingest & Programme Air Switcher"
          desc="Monitor live programme output and cut between Studio Camera, OB Van, Satellite IRD, and 24/7 Automated Playlist"
          extra={
            <div className="button-row">
              <B small icon={ArrowRight} onClick={() => navigate('cg_controller')}>Open CG Live Controller</B>
              <B small icon={ArrowRight} onClick={() => navigate('playout')}>Playout Console</B>
            </div>
          }
        >
          <LiveMonitor data={data} />

          <div style={{ marginTop: 16 }}>
            {!liveInputsAllowed ? (
              <div className="upgrade-callout">
                <div>
                  <strong>Enterprise Live Input Streaming Locked on {data.subscription?.plan_name}</strong>
                  <p className="muted-paragraph">
                    Ingest live RTMP, SRT, UDP, and HLS feeds from studio switchers, field reporters, or OB vans and switch them directly to programme air with full CG timelines and overlays. Switch to Broadcast Plus (NPR 45,000/mo) or Graphics Automation Pro (NPR 60,000/mo) in Demo Mode to unlock immediately.
                  </p>
                </div>
                <B variant="primary" icon={Lock} onClick={() => navigate('subscriptions')}>Activate Enterprise Plan</B>
              </div>
            ) : (
              <div className="destinations">
                {(data.inputs || []).map(inp => {
                  const isOnAir = Number(activeLiveInputId) === Number(inp.id) || Boolean(inp.is_live);
                  return (
                    <div key={inp.id} className={'destination ' + (isOnAir ? 'live-input-active' : '')}>
                      <div className={'destination-icon ' + inp.protocol}><Wifi size={16} /></div>
                      <div className="destination-details">
                        <strong>{inp.name}</strong>
                        <small>{inp.url}</small>
                        <div className="destination-meta">
                          <Pill color={isOnAir ? 'red' : 'purple'} dot={isOnAir}>
                            {isOnAir ? 'LIVE ON PROGRAMME AIR' : (inp.protocol || 'rtmp').toUpperCase()}
                          </Pill>
                          <Pill color="blue">{(inp.source_type || 'live_input').replace('_', ' ').toUpperCase()}</Pill>
                          <span>Latency: {inp.latency_ms || 250}ms • Buffer: {inp.buffer_ms || 1000}ms</span>
                        </div>
                      </div>
                      <div className="destination-ctrl">
                        {isOnAir ? (
                          <B small variant="danger" onClick={() => mutate(`/inputs/${inp.id}/stop`, 'POST', {}, 'Returned to automated playlist')}>
                            Return to Playlist
                          </B>
                        ) : (
                          <B small variant="primary" icon={Zap} onClick={() => mutate(`/inputs/${inp.id}/take`, 'POST', {}, `LIVE INPUT ON AIR: ${inp.name}`)}>
                            TAKE LIVE TO AIR
                          </B>
                        )}
                        <button type="button" title="Edit input parameters" onClick={() => {
                          setInputEditing(inp.id);
                          setInputName(inp.name);
                          setInputType(inp.source_type || 'live_input');
                          setInputProtocol(inp.protocol || 'rtmp');
                          setInputUrl(inp.url || '');
                          setBackupUrl(inp.backup_url || '');
                          setStreamMode(inp.stream_mode || 'listener');
                          setInputLatency(inp.latency_ms || 250);
                          setBufferMs(inp.buffer_ms || 1000);
                          setAutoFallback(inp.auto_fallback ? 1 : 0);
                        }}><SlidersHorizontal size={15} /></button>
                        <button type="button" onClick={() => remove('inputs', inp.id)} title="Delete input"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })}
                {!(data.inputs || []).length && <Empty text="No live input feeds configured yet. Add a studio camera or OB van ingest stream on the right." />}
              </div>
            )}
          </div>
        </Card>

        <Card
          title={inputEditing ? 'Edit Live Ingest Feed' : 'Configure New Live Ingest Feed'}
          desc={liveInputsAllowed ? `Enterprise Ingest Capacity: ${(data.inputs || []).length} / ${maxInputs} Feeds` : 'Enterprise Feature (Broadcast Plus / Graphics Automation Pro)'}
        >
          <div className="form-stack">
            <Field label="Live Source Name">
              <input
                value={inputName}
                onChange={e => setInputName(e.target.value)}
                placeholder="e.g. Studio A Primary Camera / OB Van Pokhara"
                disabled={!liveInputsAllowed}
              />
            </Field>
            <div className="form-grid">
              <Field label="Source Classification">
                <select value={inputType} onChange={e => setInputType(e.target.value)} disabled={!liveInputsAllowed}>
                  <option value="studio_input">Studio Camera / Production Switcher</option>
                  <option value="live_input">Remote OB Van / Field Reporter</option>
                  <option value="satellite_ird">Satellite IRD / Fiber Downlink</option>
                </select>
              </Field>
              <Field label="Ingest Protocol">
                <select
                  value={inputProtocol}
                  onChange={e => {
                    const p = e.target.value;
                    setInputProtocol(p);
                    if (p === 'rtmp') setInputUrl('rtmp://ingest.kashtrix.local:1935/live/studio_a');
                    else if (p === 'srt') setInputUrl('srt://ingest.kashtrix.local:9000?mode=listener&latency=250');
                    else if (p === 'udp') setInputUrl('udp://0.0.0.0:5000?pkt_size=1316');
                    else if (p === 'hls') setInputUrl('https://ingest.kashtrix.local/live/remote_feed/index.m3u8');
                  }}
                  disabled={!liveInputsAllowed}
                >
                  <option value="rtmp">RTMP / RTMPS Ingest</option>
                  <option value="srt">SRT Low-Latency Contribution</option>
                  <option value="udp">UDP MPEG-TS Unicast / Multicast</option>
                  <option value="hls">HLS Pull Contribution</option>
                </select>
              </Field>
            </div>
            <Field label="Primary Ingest Endpoint URL">
              <input value={inputUrl} onChange={e => setInputUrl(e.target.value)} disabled={!liveInputsAllowed} />
            </Field>
            <Field label="Failover / Backup Ingest URL (Optional)">
              <input
                value={backupUrl}
                onChange={e => setBackupUrl(e.target.value)}
                placeholder="Optional secondary contribution stream URL"
                disabled={!liveInputsAllowed}
              />
            </Field>
            {inputProtocol === 'srt' && (
              <div className="form-grid">
                <Field label="SRT Mode">
                  <select value={streamMode} onChange={e => setStreamMode(e.target.value)} disabled={!liveInputsAllowed}>
                    <option value="listener">Listener</option>
                    <option value="caller">Caller</option>
                    <option value="rendezvous">Rendezvous</option>
                  </select>
                </Field>
                <Field label="SRT Passphrase (Optional)">
                  <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="AES-128/256 passphrase" disabled={!liveInputsAllowed} />
                </Field>
              </div>
            )}
            <div className="form-grid">
              <Field label="Contribution Latency (ms)">
                <input type="number" min="20" max="5000" value={inputLatency} onChange={e => setInputLatency(e.target.value)} disabled={!liveInputsAllowed} />
              </Field>
              <Field label="Jitter Buffer (ms)">
                <input type="number" min="100" max="8000" value={bufferMs} onChange={e => setBufferMs(e.target.value)} disabled={!liveInputsAllowed} />
              </Field>
            </div>
            <Field label="Automatic Playlist Recovery on Signal Loss">
              <select value={autoFallback} onChange={e => setAutoFallback(Number(e.target.value))} disabled={!liveInputsAllowed}>
                <option value={1}>Enabled — seamlessly return to 24/7 playlist if live signal drops</option>
                <option value={0}>Disabled — hold last frame on signal loss</option>
              </select>
            </Field>
            <B
              icon={Plus}
              variant="primary"
              disabled={liveInputsAllowed && (!inputName || !inputUrl)}
              onClick={saveInput}
            >
              {!liveInputsAllowed ? 'Unlock Enterprise Live Inputs' : inputEditing ? 'Save Live Input Changes' : 'Add Live Ingest Feed'}
            </B>
            {inputEditing && <B small onClick={() => { setInputEditing(null); setInputName(''); }}>Cancel Edit</B>}
          </div>
        </Card>
      </div>
    </>
  );
}

export function SubscriptionsPage({ data, onActivatePlan, busy }) {
  const plans = data.plans || [];
  const currentPlanId = data.subscription?.plan_id || data.tenant?.plan || 'music_graphics_pro';
  const usage = data.usage || {};
  const isAdmin = ['admin', 'superadmin'].includes(data.account?.role);
  const totalCgCount = ALL_KEYS.length;
  const totalTplCount = (data.cg_templates || []).length || ALL_KEYS.length;

  const comparisonRows = [
    ['Monthly Price (NPR)', p => fmtNpr(p.price_npr) + '/mo'],
    ['VPS Specification', p => `${p.vcpu} vCPU • ${p.ram_gb} GB RAM • ${p.storage_gb} GB NVMe`],
    ['Programme Encoder', () => '16:9 Multi-Resolution (360p, 480p, 720p, 1080p)'],
    ['Simultaneous Outputs', p => `${p.max_outputs} destinations`],
    ['RTMP / RTMPS Streaming', () => 'Included'],
    ['SRT & UDP Unicast', p => p.entitlements?.srt_allowed ? 'Included' : '—'],
    ['YouTube & Facebook Live', p => p.entitlements?.youtube_integration ? 'Included' : '—'],
    ['HLS Origin & Website Iframe Player', p => p.entitlements?.embed_player ? 'Included' : '—'],
    ['Enterprise Live Input Streaming (Ingest)', p => p.entitlements?.live_input_streaming ? `Up to ${p.entitlements?.max_inputs || 2} Live Inputs` : '—'],
    ['CG Overlay Layers', p => `${(p.entitlements?.cg_categories || []).length} / ${totalCgCount} layers`],
    ['Multi-Track CG Timeline & Dual-Bus Switcher', p => p.entitlements?.cg_timeline ? 'Included (Enterprise)' : '—'],
    ['Sponsor Logo Overlays', p => p.entitlements?.sponsor_overlay ? 'Included' : '—'],
    ['Breaking / Flash / News Updates', p => (p.entitlements?.cg_categories || []).includes('breaking') ? 'Included' : '—'],
    ['Editorial CG CMS', p => p.entitlements?.cms_level === 'none' ? '—' : p.entitlements?.cms_level?.toUpperCase()],
    ['Custom CG Templates', p => p.entitlements?.custom_templates ? 'Included' : '—'],
    ['Automatic Music Now Playing CG', p => p.entitlements?.music_now_playing ? 'Included (Start 20s / End -30s)' : '—'],
    ['Music Metadata CMS & Bulk Import', p => p.entitlements?.music_metadata_cms ? 'Included' : '—'],
    ['Automatic Programme Now / Next CG', p => p.entitlements?.program_now_next_auto ? 'Included (Automated)' : '—'],
    ['16:9 Drag-and-Drop Visual CG Editor', p => p.entitlements?.visual_cg_designer ? 'Included' : '—'],
    ['Separate Preview & On-Air TAKE Workflow', p => p.entitlements?.cg_preview_workflow ? 'Included' : '—'],
    ['Built-In Animated Broadcast Templates', p => p.entitlements?.animated_template_library ? `${totalTplCount} Templates` : '—'],
    ['CG Layout Presets & Custom Fonts/Styles', p => p.entitlements?.cg_layout_presets ? 'Included' : '—'],
    ['Video & Playlist Scheduling', () => 'Automated Broadcast Scheduler'],
    ['CG Event Scheduling', p => p.entitlements?.cg_scheduling ? 'Automated Broadcast Scheduler' : '—'],
    ['Support Level', p => p.support_tier]
  ];

  return (
    <>
      <div className="stats-grid">
        <SummaryStat icon={Award} value={data.subscription?.plan_name || 'Graphics Automation Pro'} label="ACTIVE SUBSCRIPTION" sub="DEMO MODE • Free instant switching" accent="pink" />
        <SummaryStat icon={Cpu} value={`${data.subscription?.vcpu || 8} vCPU / ${data.subscription?.ram_gb || 32} GB`} label="VPS ALLOCATION" sub={`${data.subscription?.storage_gb || 600} GB NVMe quota`} />
        <SummaryStat icon={Radio} value={`${usage.total_outputs || 0} / ${data.subscription?.max_outputs || 8}`} label="DESTINATION SLOTS" sub={`${usage.remaining_outputs ?? 8} remaining capacity`} accent="blue" />
        <SummaryStat icon={Layers} value={`${(data.entitlements?.cg_categories || []).length} / ${totalCgCount}`} label="ENTITLED CG ZONES" sub={data.entitlements?.visual_cg_designer ? 'Visual CG + Timeline Active' : data.entitlements?.cms_enabled ? 'Editorial CMS Active' : 'Basic CG Only'} accent="green" />
      </div>

      <div className="plans-grid">
        {plans.map(plan => {
          const isCurrent = plan.id === currentPlanId;
          const isMusicPro = plan.id === 'music_graphics_pro';
          const isFlagship = plan.id === 'broadcast_plus' || isMusicPro;
          const isPopular = plan.id === 'news_pro' || plan.id === 'digital_360';
          return (
            <div key={plan.id} className={'plan-card ' + (isCurrent ? 'current ' : '') + (isFlagship ? 'flagship' : '')}>
              <div className="plan-card-top">
                <div className="plan-badges">
                  {isCurrent && <Pill color="green" dot>ACTIVE PLAN</Pill>}
                  {!isCurrent && isMusicPro && <Pill color="magenta">MUSIC & VISUAL CG PRO</Pill>}
                  {!isCurrent && plan.id === 'broadcast_plus' && <Pill color="magenta">ENTERPRISE 24/7</Pill>}
                  {!isCurrent && isPopular && <Pill color="purple">POPULAR</Pill>}
                </div>
                <h3>{plan.name}</h3>
                <div className="plan-price">
                  <strong>{fmtNpr(plan.price_npr)}</strong>
                  <span>/ month</span>
                </div>
                <p className="plan-desc">{plan.description}</p>
              </div>

              <div className="plan-specs">
                <div><Cpu size={13} /><span>{plan.vcpu} vCPU • {plan.ram_gb} GB RAM • {plan.storage_gb} GB NVMe</span></div>
                <div><Radio size={13} /><span><strong>{plan.max_outputs}</strong> simultaneous outputs ({plan.protocol_labels?.join(', ')})</span></div>
                <div><Layers size={13} /><span><strong>{(plan.entitlements?.cg_categories || []).length}</strong> CG layers • CMS: {(plan.entitlements?.cms_level || 'none').toUpperCase()}</span></div>
                <div><Shield size={13} /><span>{plan.support_tier}</span></div>
              </div>

              <div className="plan-features">
                <small>INCLUDED CAPABILITIES</small>
                <ul>
                  {(plan.entitlements?.features_list || []).map((f, idx) => (
                    <li key={idx}><Check size={13} className="feat-ok" /><span>{f}</span></li>
                  ))}
                  {(plan.entitlements?.restricted_list || []).map((f, idx) => (
                    <li key={'r-' + idx} className="restricted"><X size={13} className="feat-no" /><span>{f}</span></li>
                  ))}
                </ul>
              </div>

              <div className="plan-card-foot">
                <B
                  variant={isCurrent ? 'success' : 'primary'}
                  icon={isCurrent ? CheckCircle2 : Zap}
                  disabled={isCurrent || busy || !isAdmin}
                  onClick={() => onActivatePlan(plan.id)}
                >
                  {isCurrent ? 'Current Active Plan' : 'Activate Demo Plan'}
                </B>
              </div>
            </div>
          );
        })}
      </div>

      <Card title="Complete 6-plan feature & specification comparison" desc="Real-time cloud entitlement enforcement across playout, Visual CG Studio, CG Timeline, Live Input Streaming, Music Now Playing, and outputs">
        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Feature / Specification</th>
                {plans.map(p => (
                  <th key={p.id} className={p.id === currentPlanId ? 'active-col' : ''}>
                    {p.name}
                    {p.id === currentPlanId && <span className="col-tag">ACTIVE</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([label, fn]) => (
                <tr key={label}>
                  <td><strong>{label}</strong></td>
                  {plans.map(p => (
                    <td key={p.id} className={p.id === currentPlanId ? 'active-col' : ''}>{fn(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function UsersPage({ data, mutate }) {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('editor');

  useEffect(() => {
    api('/users').then(setRows).catch(() => setRows([]));
  }, [data.account?.id]);

  const create = async () => {
    const r = await mutate('/users', 'POST', { username: name, password, role });
    if (r) {
      setName('');
      setPassword('');
      api('/users').then(setRows).catch(() => {});
    }
  };

  return (
    <div className="grid-main">
      <Card title="Tenant team" desc={`Role-based users • ${data.subscription?.plan_name || 'Plan'} • ${data.entitlements?.max_outputs || 8} outputs`}>
        <div className="detail-list">
          {rows.map(u => <div key={u.id}><span>{u.username}</span><Pill color="purple">{u.role}</Pill></div>)}
        </div>
        {!rows.length && <p className="muted-paragraph">Account management requires admin permission.</p>}
      </Card>

      <Card title="Invite new operator" desc="Create a local tenant account with a strong password">
        <div className="form-stack">
          <Field label="Username"><input value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Temporary password (12+ characters)"><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
          <Field label="Role">
            <select value={role} onChange={e => setRole(e.target.value)}>
              {['viewer', 'editor', 'operator', 'admin'].map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <B icon={Plus} variant="primary" disabled={!name || password.length < 12} onClick={create}>Create User</B>
        </div>
        <p className="muted-paragraph" style={{ marginTop: 10 }}>
          Roles: viewer (read), editor (CMS/CG/media), operator (playout/schedule), admin (all settings/outputs/subscriptions).
        </p>
      </Card>
    </div>
  );
}

export function SettingsPage({ data, mutate, onUpgrade }) {
  const [resolution, setResolution] = useState(data.settings?.resolution || '1080p');
  const [bitrate, setBitrate] = useState(data.settings?.video_bitrate || '4500k');
  const [fps, setFps] = useState(data.settings?.fps || '25');
  const [preset, setPreset] = useState(data.settings?.preset || 'veryfast');
  const [playlist, setPlaylist] = useState(data.settings?.base_playlist || '1');
  const [timezone, setTimezone] = useState(data.settings?.timezone || 'Asia/Kathmandu');
  const [scanMode, setScanMode] = useState(data.settings?.scan_mode || 'progressive');

  useEffect(() => {
    setResolution(data.settings?.resolution || '1080p');
    setBitrate(data.settings?.video_bitrate || '4500k');
    setFps(data.settings?.fps || '25');
    setPreset(data.settings?.preset || 'veryfast');
    setPlaylist(data.settings?.base_playlist || '1');
    setTimezone(data.settings?.timezone || 'Asia/Kathmandu');
    setScanMode(data.settings?.scan_mode || 'progressive');
  }, [data.settings?.resolution, data.settings?.video_bitrate, data.settings?.fps, data.settings?.preset, data.settings?.base_playlist, data.settings?.timezone, data.settings?.scan_mode]);

  return (
    <>
      <div className="grid-main">
        <Card title="Programme encoding" desc="All 6 plans support selectable 360p, 480p, 720p and 1080p Full HD presets">
          <div className="form-stack">
            <div className="form-grid">
              <Field label="Resolution">
                <select value={resolution} onChange={e => setResolution(e.target.value)}>
                  <option value="360p">640 × 360 (360p)</option>
                  <option value="480p">854 × 480 (480p)</option>
                  <option value="720p">1280 × 720 (HD 720p)</option>
                  <option value="1080p">1920 × 1080 (Full HD 1080p)</option>
                </select>
              </Field>
              <Field label="Frame rate">
                <select value={fps} onChange={e => setFps(e.target.value)}>
                  <option value="24">24 fps</option>
                  <option value="25">25 fps</option>
                  <option value="30">30 fps</option>
                </select>
              </Field>
            </div>
            <Field label={`H.264 video bitrate (Plan max: ${data.entitlements?.max_bitrate_kbps || 8000}k)`}>
              <select value={bitrate} onChange={e => setBitrate(e.target.value)}>
                {(data.entitlements?.allowed_bitrates || ['1500k', '2500k', '3500k', '4500k', '5500k', '6500k', '7500k']).map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Encoding performance profile">
              <select value={preset} onChange={e => setPreset(e.target.value)}>
                {['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'].map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Scan mode (Progressive p / Interlaced i)">
              <select value={scanMode} onChange={e => setScanMode(e.target.value)}>
                <option value="progressive">Progressive (e.g. 1080p / 720p)</option>
                <option value="interlaced">Interlaced TFF (e.g. 1080i Broadcast)</option>
              </select>
            </Field>
            <Field label="24/7 default playlist">
              <select value={playlist} onChange={e => setPlaylist(e.target.value)}>
                {(data.playlists || []).map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Station Timezone (Scheduler & Broadcast Clock)">
              <select value={timezone} onChange={e => setTimezone(e.target.value)}>
                {TIMEZONE_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
            <B variant="primary" icon={Save} onClick={() => mutate('/settings', 'POST', { values: { resolution, video_bitrate: bitrate, fps, preset, scan_mode: scanMode, base_playlist: playlist, timezone } })}>
              Save & Restart Encoder
            </B>
          </div>
        </Card>

        <div className="column-gap">
          <Card title="Server diagnostics" desc="Live broadcast engine, hardware & scheduler telemetry">
            <div className="detail-list">
              {[
                ['Broadcast Playout Mode', data.engine?.dry_run ? 'STANDBY / PREVIEW' : 'LIVE STREAMING'],
                ['Programme Engine State', data.engine?.state || 'idle'],
                ['Continuous Uptime', fmt(data.engine?.uptime_sec)],
                ['Engine Process ID', data.engine?.encoder_pid || '—'],
                ['Active Outputs', `${(data.outputs || []).filter(o => o.enabled).length} / ${data.entitlements?.max_outputs || 8}`],
                ['Host / OS', `${data.hardware?.hostname || '—'} (${data.hardware?.os || '—'})`],
                ['Processor (CPU)', `${data.hardware?.cpu_model || '—'} • ${data.hardware?.cpu_cores ?? '—'}C/${data.hardware?.cpu_threads ?? '—'}T (${data.hardware?.cpu_pct ?? 0}%)`],
                ['Memory (RAM)', `${data.hardware?.ram_used_gb ?? 0} / ${data.hardware?.ram_total_gb ?? 0} GB (${data.hardware?.ram_pct ?? 0}%)`],
                ['Storage (Disk)', `${data.hardware?.disk_used_gb ?? 0} / ${data.hardware?.disk_total_gb ?? 0} GB (${data.hardware?.disk_pct ?? 0}%)`],
                ['GPU Adapter', data.hardware?.gpu || '—'],
                ['Cloud Database Cluster', 'Connected • High Availability'],
                ['Automation Scheduler', `${data.settings?.timezone || 'Asia/Kathmandu'} (Active)`],
                ['Broadcast Format', 'H.264 / AAC Stereo']
              ].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
            </div>
            {data.engine?.error && <div className="alert error"><AlertCircle size={15} />{data.engine.error}</div>}
          </Card>

          <Card title="Fonts & Usable Font Folders" desc="Installed system fonts & project-usable font directories for CG and CMS">
            <div className="detail-list">
              {[
                ['System Fonts Folder', data.system_fonts?.system_folder || '—'],
                ['Installed System Fonts', `${(data.system_fonts?.system_fonts || []).length} fonts detected`],
                ['Project Font Folders', (data.system_fonts?.project_folders || []).join('  |  ') || '—'],
                ['Project Custom Fonts', `${(data.system_fonts?.project_fonts || []).length} font files loaded`]
              ].map(([k, v]) => <div key={k}><span>{k}</span><b style={{ wordBreak: 'break-all' }}>{v}</b></div>)}
            </div>
          </Card>

          <Card title="Recent operator activity" desc="Cloud broadcast audit trail">
            <div className="audit-list">
              {(data.audit || []).map(a => <div key={a.id}><span>{a.action} ({a.detail})</span><small>{a.created_at}</small></div>)}
            </div>
          </Card>
        </div>
      </div>

      <MusicAndProgrammeSettingsPanel data={data} mutate={mutate} onUpgrade={onUpgrade} />
    </>
  );
}

