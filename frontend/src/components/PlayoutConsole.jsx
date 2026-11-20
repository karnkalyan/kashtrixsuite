import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDown, ArrowUp, CheckCircle2, Eye, EyeOff, Film, FolderOpen,
  Layers, Lock, Maximize2, Music, Pause, Play, Plus, Radio, Redo2, RefreshCw, Repeat, RotateCcw,
  RotateCw, Search, Shield, SkipBack, SkipForward, Sliders, Square, Trash2,
  Tv, Undo2, Upload, Video, Volume2, VolumeX, Zap
} from 'lucide-react';
import {
  ALL_LABELS, api, B, MediaThumbnail, Pill, clock, fmt, mediaStreamUrl, nptTime
} from './shared';
import { OverlayStage } from './MonitorStage';

export function PlayoutConsole({
  data,
  can,
  entitlements,
  control,
  save,
  del,
  reorderItem,
  addPlaylistItem,
  onCreatePlaylist,
  selectedPlaylistId,
  setSelectedPlaylistId,
  setModal,
  setUploadOpen,
  setTab,
  setCgStudioMode,
  takeLiveInput,
  stopLiveInput,
  notifyToast
}) {
  const [liveClock, setLiveClock] = useState(() => new Date());
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cuedMediaId, setCuedMediaId] = useState(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewPos, setPreviewPos] = useState(0);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [bottomDockTab, setBottomDockTab] = useState('quick_controls');
  const [faderLevel, setFaderLevel] = useState(() => Number(data.settings?.master_volume ?? 100));
  const [meterTick, setMeterTick] = useState(0);
  const previewVideoRef = useRef(null);

  useEffect(() => {
    if (data.settings?.master_volume !== undefined) {
      setFaderLevel(Number(data.settings.master_volume));
    }
  }, [data.settings?.master_volume]);

  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.volume = Math.max(0, Math.min(1, faderLevel / 100));
    }
  }, [faderLevel, previewMuted]);

  const volTimerRef = useRef(null);
  const commitMasterVolume = async (val) => {
    const clamped = Math.max(0, Math.min(200, Math.round(Number(val) || 0)));
    setFaderLevel(clamped);
    try {
      const r = await api('/settings', {
        method: 'POST',
        body: JSON.stringify({ values: { master_volume: String(clamped) } })
      });
      if (r.ok && notifyToast) notifyToast(`Master volume set to ${clamped}%`);
    } catch {}
  };
  const handleFaderInput = (val) => {
    const clamped = Math.max(0, Math.min(200, Math.round(Number(val) || 0)));
    setFaderLevel(clamped);
    if (volTimerRef.current) clearTimeout(volTimerRef.current);
    volTimerRef.current = setTimeout(() => commitMasterVolume(clamped), 260);
  };

  // Undo / Redo history stack for Playout Console (rundown reorder, cue, take, next/prev, add)
  const [playoutUndo, setPlayoutUndo] = useState([]);
  const [playoutRedo, setPlayoutRedo] = useState([]);

  const pushPlayoutUndo = (action) => {
    setPlayoutUndo(prev => [...prev.slice(-39), action]);
    setPlayoutRedo([]);
  };

  const handlePlayoutReorder = async (item, dir) => {
    pushPlayoutUndo({ type: 'reorder', item: { id: item.id, playlist_id: item.playlist_id }, dir, label: 'Reorder Clip' });
    await reorderItem(item, dir);
  };

  const handlePlayoutAddItem = async (mediaId) => {
    const numId = Number(mediaId);
    const existingIds = (data.playlist_items || []).map(i => i.id);
    pushPlayoutUndo({ type: 'add_item', mediaId: numId, playlistId: selectedPlaylistId || data.playlists?.[0]?.id, existingIds, label: 'Add Clip' });
    await addPlaylistItem(mediaId);
  };

  const handlePlayoutCue = (nextId) => {
    if (nextId === cuedMediaId) return;
    pushPlayoutUndo({ type: 'cue', prevId: cuedMediaId, nextId, label: 'Cue Preview' });
    setCuedMediaId(nextId);
    setPreviewPlaying(false);
    setPreviewPos(0);
  };

  const handlePlayoutTake = async (nextMediaId) => {
    const prevMediaId = data.engine?.current_media_id || null;
    pushPlayoutUndo({ type: 'take', prevMediaId, nextMediaId, label: 'Take to Air' });
    await control('take', nextMediaId);
  };

  const handlePlayoutStep = async (dir) => {
    pushPlayoutUndo({ type: 'step', dir, label: dir === 'next' ? 'Next Clip' : 'Previous Clip' });
    await control(dir);
  };

  const handlePlayoutUndo = async () => {
    if (playoutUndo.length === 0) return;
    const act = playoutUndo[playoutUndo.length - 1];
    setPlayoutUndo(prev => prev.slice(0, -1));
    setPlayoutRedo(prev => [...prev.slice(-39), act]);

    if (act.type === 'reorder') {
      await reorderItem(act.item, -act.dir);
    } else if (act.type === 'cue') {
      setCuedMediaId(act.prevId);
      setPreviewPlaying(false);
      setPreviewPos(0);
    } else if (act.type === 'take') {
      if (act.prevMediaId) await control('take', act.prevMediaId);
    } else if (act.type === 'step') {
      await control(act.dir === 'next' ? 'prev' : 'next');
    } else if (act.type === 'add_item') {
      const added = (data.playlist_items || []).find(
        i => i.playlist_id === act.playlistId && i.media_id === act.mediaId && !act.existingIds.includes(i.id)
      );
      if (added) await del('playlist_items', added.id);
    }
    notifyToast?.(`Undo: ${act.label}`);
  };

  const handlePlayoutRedo = async () => {
    if (playoutRedo.length === 0) return;
    const act = playoutRedo[playoutRedo.length - 1];
    setPlayoutRedo(prev => prev.slice(0, -1));
    setPlayoutUndo(prev => [...prev.slice(-39), act]);

    if (act.type === 'reorder') {
      await reorderItem(act.item, act.dir);
    } else if (act.type === 'cue') {
      setCuedMediaId(act.nextId);
      setPreviewPlaying(false);
      setPreviewPos(0);
    } else if (act.type === 'take') {
      if (act.nextMediaId) await control('take', act.nextMediaId);
    } else if (act.type === 'step') {
      await control(act.dir);
    } else if (act.type === 'add_item') {
      await addPlaylistItem(act.mediaId);
    }
    notifyToast?.(`Redo: ${act.label}`);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      const key = (e.key || '').toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handlePlayoutUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handlePlayoutRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playoutUndo, playoutRedo, cuedMediaId, data.engine?.current_media_id, data.playlist_items]);

  // Live 1-second station clock & meter animation
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(new Date());
      setMeterTick(t => (t + 1) % 100);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const activePlaylist = useMemo(
    () => (data.playlists || []).find(p => p.id === selectedPlaylistId) || (data.playlists || [])[0] || null,
    [data.playlists, selectedPlaylistId]
  );

  const playlistItems = useMemo(
    () => (data.playlist_items || []).filter(i => !activePlaylist || i.playlist_id === activePlaylist.id),
    [data.playlist_items, activePlaylist]
  );

  const filteredItems = useMemo(() => {
    return playlistItems.filter(item => {
      if (categoryFilter !== 'all' && (item.category || 'video').toLowerCase() !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const artistMatch = (item.music_metadata?.artist || '').toLowerCase().includes(q);
        return titleMatch || artistMatch;
      }
      return true;
    });
  }, [playlistItems, categoryFilter, searchQuery]);

  // Default cued media to first playlist item or first media
  useEffect(() => {
    if (!cuedMediaId) {
      const firstId = playlistItems[0]?.media_id || data.engine?.media_id || data.media?.[0]?.id || null;
      if (firstId) setCuedMediaId(firstId);
    }
  }, [cuedMediaId, playlistItems, data.engine?.media_id, data.media]);

  const cuedMedia = useMemo(
    () => (data.media || []).find(m => m.id === Number(cuedMediaId)) || null,
    [data.media, cuedMediaId]
  );

  const onAirMedia = useMemo(
    () => (data.media || []).find(m => m.id === Number(data.engine?.media_id)) || null,
    [data.media, data.engine?.media_id]
  );

  const isRunning = data.engine?.state === 'on_air' || data.engine?.state === 'preview' || data.engine?.state === 'starting';
  const isPaused = data.engine?.state === 'paused';
  const posSec = Number(data.engine?.position_sec || 0);
  const durSec = Number(onAirMedia?.duration || data.engine?.media_duration || 0);
  const remSec = durSec > 0 ? Math.max(0, durSec - posSec) : 0;

  // Compute dynamic playlist played, playlist remaining, and per-row wall-clock start times
  const playlistMetrics = useMemo(() => {
    let totalDur = 0;
    let playedBeforeCurrent = 0;
    let foundCurrent = false;
    const currentMediaId = data.engine?.media_id;

    for (const item of playlistItems) {
      const d = Number(item.duration || 0);
      totalDur += d;
      if (!foundCurrent) {
        if (item.media_id === currentMediaId) {
          foundCurrent = true;
        } else {
          playedBeforeCurrent += d;
        }
      }
    }
    const played = foundCurrent ? Math.min(totalDur, playedBeforeCurrent + posSec) : 0;
    const remaining = Math.max(0, totalDur - played);

    // Compute wall-clock start time for each item in rundown
    let cursorMs = liveClock.getTime() - posSec * 1000;
    const rowStartMap = {};
    for (const item of playlistItems) {
      rowStartMap[item.id] = new Date(cursorMs).toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kathmandu',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      cursorMs += Number(item.duration || 0) * 1000;
    }

    return { totalDur, played, remaining, rowStartMap };
  }, [playlistItems, data.engine?.media_id, posSec, liveClock]);

  // Compute Next Scheduled Event countdown dynamically
  const nextScheduleCountdown = useMemo(() => {
    const nowMs = liveClock.getTime();
    const upcoming = (data.schedules || [])
      .filter(s => s.enabled && s.status !== 'paused')
      .map(s => {
        const t = Date.parse(s.starts_at);
        return Number.isFinite(t) ? { ...s, startMs: t } : null;
      })
      .filter(Boolean)
      .filter(s => s.startMs > nowMs)
      .sort((a, b) => a.startMs - b.startMs);

    if (!upcoming.length) return null;
    const diffSec = Math.max(0, Math.round((upcoming[0].startMs - nowMs) / 1000));
    return { schedule: upcoming[0], diffSec };
  }, [data.schedules, liveClock]);

  // Compute NEXT and UP NEXT items in playlist strictly following rundown order after currently playing item
  const { nextClip, upNextClip } = useMemo(() => {
    if (!playlistItems.length) return { nextClip: null, upNextClip: null };
    if (isRunning || isPaused) {
      const idx = playlistItems.findIndex(i => i.media_id === data.engine?.media_id);
      if (idx >= 0) {
        return {
          nextClip: playlistItems[idx + 1] || null,
          upNextClip: playlistItems[idx + 2] || null
        };
      }
    }
    return {
      nextClip: playlistItems[0] || null,
      upNextClip: playlistItems[1] || null
    };
  }, [playlistItems, data.engine?.media_id, isRunning, isPaused]);

  // Audio meter dynamic bar heights
  const meterLevels = useMemo(() => {
    if (!isRunning) return { l: 4, r: 4, m: 4 };
    const scale = faderLevel / 100;
    const waveL = 68 + ((meterTick * 17) % 24);
    const waveR = 64 + ((meterTick * 23) % 26);
    const waveM = Math.round((waveL + waveR) / 2);
    return {
      l: Math.min(96, Math.round(waveL * scale)),
      r: Math.min(96, Math.round(waveR * scale)),
      m: Math.min(96, Math.round(waveM * scale))
    };
  }, [isRunning, faderLevel, meterTick]);

  // Toggle Preview video playback
  const togglePreviewPlay = () => {
    const el = previewVideoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setPreviewPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setPreviewPlaying(false);
    }
  };

  const stopPreviewCue = () => {
    const el = previewVideoRef.current;
    if (el) {
      el.pause();
      try { el.currentTime = 0; } catch {}
    }
    setPreviewPlaying(false);
    setPreviewPos(0);
  };

  // Quick CG actions
  const toggleLogoOverlay = async (turnOn) => {
    const logoLayer = (data.cg || []).find(c => c.category === 'logo');
    if (!logoLayer) return;
    await save('cg', { ...logoLayer, active: turnOn ? 1 : 0 }, logoLayer.id);
    notifyToast?.(turnOn ? 'Channel Logo ON AIR' : 'Channel Logo OFF AIR');
  };

  const toggleAllEntitledCg = async (turnOn) => {
    const allowed = new Set(entitlements?.cg_categories || []);
    const primaryCats = ['logo', 'ticker', 'lower_third', 'clock'];
    for (const layer of (data.cg || [])) {
      if (!allowed.has(layer.category)) continue;
      if (turnOn && primaryCats.includes(layer.category) && !layer.active) {
        await save('cg', { ...layer, active: 1 }, layer.id);
      } else if (!turnOn && layer.active) {
        await save('cg', { ...layer, active: 0 }, layer.id);
      }
    }
    notifyToast?.(turnOn ? 'Primary Broadcast CG Layers Activated' : 'All CG Layers Cut Off Air');
  };

  const programViewportRef = useRef(null);

  const toggleProgramFullscreen = () => {
    const stageEl = programViewportRef.current?.querySelector('.stage') || programViewportRef.current;
    if (!stageEl) return;
    if (!document.fullscreenElement) {
      stageEl.requestFullscreen?.().catch(() => {});
      notifyToast?.('Program Output switched to 16:9 Fullscreen Broadcast Mode');
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleCmsSync = async () => {
    const published = (data.cg_content || []).filter(c => ['published', 'approved', 'live'].includes(c.status));
    if (!published.length) {
      notifyToast?.('No published CMS stories found in Editorial CMS');
      return;
    }
    let updatedCount = 0;
    for (const story of published) {
      const matchingLayers = (data.cg || []).filter(l =>
        l.category === story.category ||
        (story.category === 'flash' && l.category === 'flash_premium') ||
        (story.category === 'breaking' && l.category.startsWith('breaking'))
      );
      for (const layer of matchingLayers) {
        await save('cg', { ...layer, content_id: story.id, text: story.text || story.title }, layer.id);
        updatedCount++;
      }
    }
    notifyToast?.(`Synced ${published.length} CMS newsroom stories to ${updatedCount} graphics layers`);
  };

  const handleQuickLiveInput = async (sourceType) => {
    if (!entitlements?.live_input_streaming) {
      notifyToast?.('Enterprise Live Input Streaming requires Broadcast Plus or Graphics Automation Pro');
      setBottomDockTab('input_sources');
      return;
    }
    const matching = (data.inputs || []).find(i => i.source_type === sourceType && i.enabled) || (data.inputs || [])[0];
    if (matching) {
      await takeLiveInput(matching.id);
    } else {
      setBottomDockTab('input_sources');
    }
  };

  const stationDateStr = liveClock.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    weekday: 'long'
  }).toUpperCase();

  const telemetry = data.system_telemetry || {
    status: 'OK',
    cpu_pct: 12,
    ram_mb: 480,
    disk_pct: data.usage?.storage_percent || 0,
    db_status: 'CLOUD DB READY'
  };

  return (
    <div className="kx-playout-console">
      <div className="kx-standalone-studio-bar">
        <div className="kx-studio-bar-left">
          <button type="button" className="kx-studio-nav-btn back" onClick={() => setTab?.('dashboard')}>
            ← Overview
          </button>
          <span className="kx-studio-bar-title">KASHTRIX PLAYOUT CONSOLE</span>
        </div>
        <div className="kx-studio-bar-actions">
          <button
            type="button"
            className="kx-studio-nav-btn"
            onClick={handlePlayoutUndo}
            disabled={playoutUndo.length === 0}
            title={`Undo (Ctrl+Z)${playoutUndo.length ? ` — ${playoutUndo[playoutUndo.length - 1].label}` : ''}`}
          >
            <Undo2 size={12} /> Undo
          </button>
          <button
            type="button"
            className="kx-studio-nav-btn"
            onClick={handlePlayoutRedo}
            disabled={playoutRedo.length === 0}
            title={`Redo (Ctrl+Y)${playoutRedo.length ? ` — ${playoutRedo[playoutRedo.length - 1].label}` : ''}`}
          >
            <Redo2 size={12} /> Redo
          </button>
          <button type="button" className="kx-studio-nav-btn" onClick={() => setTab?.('cg_editor')}>CG Editor</button>
          <button type="button" className="kx-studio-nav-btn" onClick={() => setTab?.('cg_controller')}>CG Controller</button>
          <button type="button" className="kx-studio-nav-btn" onClick={() => setTab?.('playlist')}>Playlists</button>
          <button type="button" className="kx-studio-nav-btn" onClick={() => setTab?.('scheduler')}>Scheduler</button>
          <button type="button" className="kx-studio-nav-btn" onClick={() => setTab?.('media')}>Media Library</button>
        </div>
      </div>
      {/* TOP 3-COLUMN MASTER BRIDGE: PREVIEW | TIMECODE & TRANSPORT | AUDIO METERS | PROGRAM */}
      <div className="kx-top-bridge">
        {/* LEFT: PREVIEW MONITOR */}
        <div className="kx-monitor-deck preview-deck">
          <div className="kx-monitor-viewport">
            <span className="kx-monitor-badge preview">PREVIEW</span>
            {cuedMedia && !cuedMedia.mime?.startsWith('audio/') ? (
              <video
                key={cuedMedia.id}
                ref={previewVideoRef}
                src={mediaStreamUrl(cuedMedia.id)}
                muted={previewMuted}
                playsInline
                onTimeUpdate={(e) => setPreviewPos(e.currentTarget.currentTime || 0)}
                onEnded={() => setPreviewPlaying(false)}
              />
            ) : cuedMedia ? (
              <div className="kx-audio-slate">
                <Music size={28} />
                <strong>{cuedMedia.title}</strong>
                <small>Audio Track Cued</small>
                <audio
                  key={cuedMedia.id}
                  ref={previewVideoRef}
                  src={mediaStreamUrl(cuedMedia.id)}
                  muted={previewMuted}
                  onTimeUpdate={(e) => setPreviewPos(e.currentTarget.currentTime || 0)}
                />
              </div>
            ) : (
              <div className="kx-empty-slate">
                <Film size={28} />
                <span>Select any clip in rundown to cue preview</span>
              </div>
            )}
            <button
              type="button"
              className="kx-preview-mute"
              onClick={() => setPreviewMuted(m => !m)}
              title={previewMuted ? 'Unmute Preview' : 'Mute Preview'}
            >
              {previewMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
          </div>

          <div className="kx-monitor-meta-row">
            <span className="kx-clip-label" title={cuedMedia?.title || 'None'}>
              PREVIEW - <strong>{cuedMedia?.title || 'No Clip Cued'}</strong>
            </span>
            <span className="kx-clip-tc">
              {fmt(previewPos)} / {cuedMedia?.duration ? fmt(cuedMedia.duration) : '--:--:--'}
            </span>
          </div>

          <div className="kx-monitor-scrub-row">
            <button type="button" className="kx-mini-btn" onClick={stopPreviewCue}>CUE</button>
            <input
              type="range"
              className="kx-scrub-slider"
              min="0"
              max={Math.max(1, Math.round(cuedMedia?.duration || 100))}
              value={Math.round(previewPos)}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPreviewPos(v);
                if (previewVideoRef.current) {
                  try { previewVideoRef.current.currentTime = v; } catch {}
                }
              }}
            />
            <button type="button" className="kx-mini-btn icon" onClick={togglePreviewPlay}>
              {previewPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>
          </div>
        </div>

        {/* CENTER: DIGITAL TIMECODE & MASTER TRANSPORT DECK */}
        <div className="kx-center-transport">
          {/* Dual Digital Timecode Readout */}
          <div className="kx-dual-timecode">
            <div className="kx-tc-box played">
              <small>Current Played Time</small>
              <div className="kx-led-digits cyan">{fmt(posSec)}</div>
            </div>
            <div className="kx-tc-box remaining">
              <small>Current Remaining Time</small>
              <div className="kx-led-digits coral">
                {durSec > 0 ? fmt(remSec) : (data.engine?.live_input_id ? 'LIVE INGEST' : '--:--:--')}
              </div>
            </div>
          </div>

          {/* 8 Broadcast Transport Buttons */}
          <div className="kx-transport-grid">
            <button
              type="button"
              className="kx-trans-btn"
              disabled={!can('operator')}
              onClick={() => control('seek', null, 0)}
              title="Cue / Restart current clip from 00:00:00"
            >
              <SkipBack size={14} />
              <span>IN / CUE</span>
            </button>
            <button
              type="button"
              className="kx-trans-btn danger"
              disabled={!can('operator')}
              onClick={() => control('stop')}
              title="Stop broadcast output"
            >
              <Square size={14} />
              <span>STOP</span>
            </button>
            <button
              type="button"
              className={`kx-trans-btn ${isPaused ? 'active' : ''}`}
              disabled={!can('operator')}
              onClick={() => control(isPaused ? 'resume' : 'pause')}
              title={isPaused ? 'Resume Playout from current position' : 'Pause Playout at current position'}
            >
              <Pause size={14} />
              <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
            </button>
            <button
              type="button"
              className="kx-trans-btn"
              disabled={!can('operator')}
              onClick={() => handlePlayoutStep('next')}
              title="Skip to next item in playlist"
            >
              <SkipForward size={14} />
              <span>NEXT</span>
            </button>
            <button
              type="button"
              className="kx-trans-btn"
              disabled={!can('operator')}
              onClick={() => control('seek_delta', null, -5)}
              title="Jump back 5 seconds"
            >
              <RotateCcw size={14} />
              <span>-5 SEC</span>
            </button>
            <button
              type="button"
              className={`kx-trans-btn play ${isRunning ? 'active' : ''}`}
              disabled={!can('operator')}
              onClick={() => control('start')}
              title="Start / Resume Playout"
            >
              <Play size={14} />
              <span>PLAY</span>
            </button>
            <button
              type="button"
              className="kx-trans-btn"
              disabled={!can('operator')}
              onClick={() => control('seek_delta', null, 5)}
              title="Jump forward 5 seconds"
            >
              <RotateCw size={14} />
              <span>+5 SEC</span>
            </button>
            <button
              type="button"
              className="kx-trans-btn take"
              disabled={!can('operator') || !cuedMedia}
              onClick={() => cuedMedia && handlePlayoutTake(cuedMedia.id)}
              title="Take Cued Preview Clip Immediately to Program Air"
            >
              <Zap size={14} />
              <span>TAKE</span>
            </button>
          </div>

          {/* 5 Dynamic Telemetry Readout Boxes */}
          <div className="kx-telemetry-strip">
            <div className="kx-tele-cell">
              <small>Station Time</small>
              <strong className="amber">{clock(liveClock)}</strong>
              <span>{stationDateStr}</span>
            </div>
            <div className="kx-tele-cell">
              <small>Playlist Played</small>
              <strong className="green">{fmt(playlistMetrics.played)}</strong>
              <span>{playlistItems.length} clips in list</span>
            </div>
            <div className="kx-tele-cell">
              <small>Playlist Remaining</small>
              <strong className="orange">{fmt(playlistMetrics.remaining)}</strong>
              <span>Total {fmt(playlistMetrics.totalDur)}</span>
            </div>
            <div className="kx-tele-cell">
              <small>Next Event</small>
              <strong className="purple">
                {nextScheduleCountdown ? fmt(nextScheduleCountdown.diffSec) : '--:--:--'}
              </strong>
              <span>{nextScheduleCountdown ? nextScheduleCountdown.schedule.name : 'No event armed'}</span>
            </div>
            <div className="kx-tele-cell">
              <small>Selected Remaining</small>
              <strong className="coral">
                {cuedMedia?.duration ? fmt(Math.max(0, cuedMedia.duration - previewPos)) : '00:00:00'}
              </strong>
              <span>{cuedMedia ? cuedMedia.category?.toUpperCase() : 'NO CLIP'}</span>
            </div>
          </div>
        </div>

        {/* AUDIO LEVEL METERS: F / L / R / M */}
        <div className="kx-audio-meters">
          <div className="kx-meter-head">
            <span>F</span>
            <span>L</span>
            <span>R</span>
            <span>M</span>
          </div>
          <div className="kx-meter-body">
            <div className="kx-fader-col">
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={faderLevel}
                onChange={(e) => handleFaderInput(e.target.value)}
                onPointerUp={(e) => {
                  if (volTimerRef.current) clearTimeout(volTimerRef.current);
                  commitMasterVolume(e.target.value);
                }}
                className="kx-vertical-fader"
                title={`Master Playout Volume: ${faderLevel}%`}
              />
            </div>
            <div className="kx-bar-col">
              <i style={{ height: `${meterLevels.l}%` }} />
            </div>
            <div className="kx-bar-col">
              <i style={{ height: `${meterLevels.r}%` }} />
            </div>
            <div className="kx-bar-col">
              <i style={{ height: `${meterLevels.m}%` }} />
            </div>
            <div className="kx-db-scale">
              <span>0</span>
              <span>-6</span>
              <span>-12</span>
              <span>-18</span>
              <span>-24</span>
              <span>-30</span>
              <span>-40</span>
            </div>
          </div>
          <div className="kx-vol-step-row" title="Master Playout Volume">
            <button type="button" className="kx-vol-step-btn" onClick={() => commitMasterVolume(faderLevel - 10)} title="Decrease volume (-10%)">-</button>
            <span className="kx-meter-foot" style={{ marginTop: 0 }}>{faderLevel}%</span>
            <button type="button" className="kx-vol-step-btn" onClick={() => commitMasterVolume(faderLevel + 10)} title="Increase volume (+10%)">+</button>
          </div>
        </div>

        {/* RIGHT: PROGRAM (ON-AIR) MONITOR */}
        <div className="kx-monitor-deck program-deck">
          <div ref={programViewportRef} className="kx-monitor-viewport program">
            <OverlayStage data={data} showFullscreenBtn={false} />
          </div>

          <div className="kx-monitor-meta-row">
            <span className="kx-clip-label">
              PROGRAM - <strong>{data.engine?.media_title || 'STANDBY'}</strong>
            </span>
            <span className="kx-clip-tc">
              {fmt(posSec)} / {durSec > 0 ? fmt(durSec) : '--:--:--'}
            </span>
          </div>

          <div className="kx-program-format-row">
            <button
              type="button"
              className="kx-take-pill-btn"
              disabled={!can('operator') || !cuedMedia}
              onClick={() => cuedMedia && control('take', cuedMedia.id)}
            >
              TAKE
            </button>
            <div className="kx-format-spec">
              <strong>PROGRAM • 16:9 ({data.settings?.scan_mode === 'interlaced' ? (data.settings?.resolution || '1080p').replace(/p$/i, 'i') : (data.settings?.resolution || '1080p')} @ {data.settings?.fps || 25}fps)</strong>
              <span>
                16:9 Widescreen ({data.settings?.width || 1920}×{data.settings?.height || 1080}) • {data.settings?.fps || 25} frames/s • {data.settings?.video_bitrate || '4500k'}
              </span>
            </div>
            <button
              type="button"
              className="kx-mini-btn icon"
              onClick={toggleProgramFullscreen}
              title="Full Screen Program Broadcast Output (16:9)"
            >
              <Maximize2 size={12} />
            </button>
            <button
              type="button"
              className="kx-mini-btn icon"
              disabled={!can('operator')}
              onClick={() => control(isRunning ? 'pause' : 'start')}
              title={isRunning ? 'Pause Program' : 'Play / Resume Program'}
            >
              {isRunning ? <Pause size={12} /> : <Play size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* MIDDLE 3-COLUMN RUNDOWN & STATUS DECK */}
      <div className="kx-middle-deck">
        {/* LEFT: BLOCKS / CATEGORIES SIDEBAR */}
        <div className="kx-blocks-sidebar">
          <div className="kx-pane-header">
            <span>BLOCKS / CATEGORIES</span>
            <div className="kx-pane-actions">
              <button
                type="button"
                className="kx-xs-btn"
                onClick={() => onCreatePlaylist ? onCreatePlaylist() : setTab('playlist')}
                title="Create New Playlist"
              >
                <Plus size={12} />
              </button>
              <button
                type="button"
                className={`kx-xs-btn ${categoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('all')}
              >
                ALL
              </button>
            </div>
          </div>

          <div className="kx-playlist-selector-box">
            <small>ACTIVE PLAYLIST</small>
            <select
              value={activePlaylist?.id || ''}
              onChange={(e) => setSelectedPlaylistId(Number(e.target.value))}
            >
              {(data.playlists || []).map(pl => (
                <option key={pl.id} value={pl.id}>{pl.name}</option>
              ))}
            </select>
          </div>

          <div className="kx-category-list">
            {[
              ['all', 'All Broadcast Media', playlistItems.length],
              ['video', 'Programme Video', playlistItems.filter(i => (i.category || 'video') === 'video').length],
              ['music', 'Music Videos (Auto-CG)', playlistItems.filter(i => i.category === 'music').length],
              ['news', 'News Packages', playlistItems.filter(i => i.category === 'news').length],
              ['promo', 'Promos & Commercials', playlistItems.filter(i => i.category === 'promo').length]
            ].map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`kx-cat-item ${categoryFilter === key ? 'active' : ''}`}
                onClick={() => setCategoryFilter(key)}
              >
                <span>{label}</span>
                <b>{count}</b>
              </button>
            ))}
          </div>

          <div className="kx-quick-add-box">
            <small>ADD CLIP TO RUNDOWN</small>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handlePlayoutAddItem(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="" disabled>+ Select clip from library...</option>
              {(data.media || []).filter(m => !m.mime?.startsWith('image/')).map(m => (
                <option key={m.id} value={m.id}>
                  {m.title} ({fmt(m.duration)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CENTER: CURRENT PLAYLIST RUNDOWN TABLE */}
        <div className="kx-rundown-center">
          <div className="kx-rundown-toolbar">
            <div className="kx-rundown-title">
              <span>CURRENT PLAYLIST:</span>
              <strong>{activePlaylist?.name?.toUpperCase() || '24/7 MASTER ROTATION'}</strong>
            </div>
            <div className="kx-rundown-search">
              <Search size={13} />
              <input
                placeholder="Filter rundown clips, songs, artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="kx-rundown-tools">
              <button type="button" className="kx-tool-btn" onClick={() => setUploadOpen(true)}>
                <Plus size={12} /> ADD CLIP
              </button>
              <button type="button" className="kx-tool-btn" onClick={() => { setCgStudioMode?.('editor'); setTab('cg_editor'); }}>
                <Sliders size={12} /> CG TIMELINE
              </button>
              <button type="button" className="kx-tool-btn" onClick={() => { setCgStudioMode?.('controller'); setTab('cg_controller'); }}>
                <Tv size={12} /> CG SWITCHER
              </button>
              <button type="button" className="kx-tool-btn" onClick={() => setTab('scheduler')}>
                SCHEDULE
              </button>
            </div>
          </div>

          <div className="kx-rundown-table-wrap">
            <table className="kx-rundown-table">
              <thead>
                <tr>
                  <th style={{ width: '38px' }}>#</th>
                  <th style={{ width: '84px' }}>START</th>
                  <th style={{ width: '78px' }}>DURATION</th>
                  <th style={{ width: '68px' }}>TYPE</th>
                  <th style={{ width: '90px' }}>CATEGORY</th>
                  <th>TITLE / DESCRIPTION</th>
                  <th style={{ width: '86px' }}>STATUS</th>
                  <th style={{ width: '64px' }}>IN</th>
                  <th style={{ width: '64px' }}>OUT</th>
                  <th style={{ width: '148px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const isOnAir = data.engine?.media_id === item.media_id && isRunning;
                  const isCued = Number(cuedMediaId) === Number(item.media_id);
                  const meta = item.music_metadata;
                  return (
                    <tr
                      key={item.id}
                      className={`${isOnAir ? 'row-on-air' : ''} ${isCued ? 'row-cued' : ''}`}
                      onClick={() => handlePlayoutCue(item.media_id)}
                      onDoubleClick={() => can('operator') && handlePlayoutTake(item.media_id)}
                    >
                      <td className="mono">{idx + 1}</td>
                      <td className="mono">{playlistMetrics.rowStartMap[item.id] || '--:--:--'}</td>
                      <td className="mono">{fmt(item.duration)}</td>
                      <td>
                        <span className="kx-type-badge">{(item.category || 'VIDEO').toUpperCase()}</span>
                      </td>
                      <td>{item.category === 'music' ? '♫ Music' : (item.category || 'Program')}</td>
                      <td>
                        <div className="kx-row-title">
                          <strong>{item.title}</strong>
                          {meta && (meta.artist || meta.album) && (
                            <small>♫ {meta.song_title || item.title} — {meta.artist} {meta.album ? `(${meta.album})` : ''}</small>
                          )}
                        </div>
                      </td>
                      <td>
                        {isOnAir ? (
                          <span className="kx-status-pill on-air">● ON AIR</span>
                        ) : isCued ? (
                          <span className="kx-status-pill cued">◆ CUED</span>
                        ) : (
                          <span className="kx-status-pill ready">READY</span>
                        )}
                      </td>
                      <td className="mono">00:00:00</td>
                      <td className="mono">{fmt(item.duration)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="kx-row-actions">
                          <button
                            type="button"
                            className="kx-act-btn"
                            onClick={() => handlePlayoutCue(item.media_id)}
                            title="Cue in Preview Monitor"
                          >
                            CUE
                          </button>
                          <button
                            type="button"
                            className="kx-act-btn take"
                            disabled={!can('operator')}
                            onClick={() => handlePlayoutTake(item.media_id)}
                            title="Take Immediately to Air"
                          >
                            TAKE
                          </button>
                          <button
                            type="button"
                            className="kx-act-btn icon-only"
                            disabled={!can('operator')}
                            onClick={() => handlePlayoutReorder(item, -1)}
                            title="Move Up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            className="kx-act-btn icon-only"
                            disabled={!can('operator')}
                            onClick={() => handlePlayoutReorder(item, 1)}
                            title="Move Down"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            className="kx-act-btn danger icon-only"
                            disabled={!can('operator')}
                            onClick={() => del('playlist_items', item.id)}
                            title="Remove from Playlist"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredItems.length && (
                  <tr>
                    <td colSpan={10} className="kx-empty-row">
                      No media items in this playlist filter. Use "+ ADD CLIP" or select from the left sidebar to populate the rundown.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: NOW PLAYING / NEXT / UP NEXT / EVENT LOG / CLIP INFO */}
        <div className="kx-right-status-dock">
          <div className="kx-status-card now-playing">
            <div className="kx-pane-header">
              <span>■ NOW PLAYING</span>
              <span className={`kx-live-dot ${isRunning ? 'on' : ''}`}>
                {isRunning ? 'ON AIR' : 'OFF AIR'}
              </span>
            </div>
            <div className="kx-np-body">
              <strong>{isRunning ? (data.engine?.media_title || 'LIVE BROADCAST') : 'OFF AIR'}</strong>
              <small>
                Source: {(data.engine?.source || 'rotation').toUpperCase()} • {data.cg?.filter(c => c.effective_active).length || 0} CG Active
              </small>
              <div className="kx-auto-cg-badge">
                AUTO CG ARMED • {entitlements?.music_now_playing ? 'MUSIC + PROGRAMME + NEWS' : 'NEWS + BRANDING'}
              </div>
            </div>
          </div>

          <div className="kx-status-card next-item">
            <div className="kx-pane-header"><span>NEXT</span></div>
            <div className="kx-next-card">
              <div className="kx-next-thumb">
                {nextClip ? <MediaThumbnail id={nextClip.media_id} alt={nextClip.title} /> : <Film size={18} />}
                <span>NEXT</span>
              </div>
              <div className="kx-next-copy">
                <strong>{nextClip ? nextClip.title : 'No next item'}</strong>
                <small>{nextClip ? `${fmt(nextClip.duration)} • ${(nextClip.category || 'video').toUpperCase()}` : 'End of playlist'}</small>
              </div>
            </div>
          </div>

          <div className="kx-status-card next-item">
            <div className="kx-pane-header"><span>UP NEXT</span></div>
            <div className="kx-next-card">
              <div className="kx-next-thumb up-next">
                {upNextClip ? <MediaThumbnail id={upNextClip.media_id} alt={upNextClip.title} /> : <Film size={18} />}
                <span>UP NEXT</span>
              </div>
              <div className="kx-next-copy">
                <strong>{upNextClip ? upNextClip.title : 'No upcoming item'}</strong>
                <small>{upNextClip ? `${fmt(upNextClip.duration)} • ${(upNextClip.category || 'video').toUpperCase()}` : 'End of rundown'}</small>
              </div>
            </div>
          </div>

          <div className="kx-status-card event-log">
            <div className="kx-pane-header">
              <span>EVENT LOG</span>
              <span className="kx-xs-tag">LIVE</span>
            </div>
            <div className="kx-event-log-list">
              {(data.audit || []).slice(0, 8).map(ev => (
                <div key={ev.id} className="kx-log-line">
                  <span className="kx-log-time">● {nptTime(ev.created_at)}</span>
                  <span className="kx-log-msg">{ev.action?.toUpperCase()} — {ev.detail || 'OK'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="kx-status-card clip-info">
            <div className="kx-pane-header"><span>CLIP INFO</span></div>
            {cuedMedia ? (
              <div className="kx-clip-specs">
                <div><span>Title:</span> <strong>{cuedMedia.title}</strong></div>
                <div><span>Format:</span> <strong>{cuedMedia.width || 1920}×{cuedMedia.height || 1080} • {(cuedMedia.codec || 'H.264').toUpperCase()}</strong></div>
                <div><span>Duration:</span> <strong>{fmt(cuedMedia.duration)} ({cuedMedia.category})</strong></div>
              </div>
            ) : (
              <div className="kx-clip-specs"><small>Select a clip to inspect metadata</small></div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM DOCK: QUICK CONTROLS (ONLY REAL FEATURES) & INPUT SOURCES */}
      <div className="kx-bottom-dock">
        <div className="kx-dock-tabs">
          <button
            type="button"
            className={bottomDockTab === 'quick_controls' ? 'active' : ''}
            onClick={() => setBottomDockTab('quick_controls')}
          >
            QUICK CONTROLS
          </button>
          <button
            type="button"
            className={bottomDockTab === 'input_sources' ? 'active' : ''}
            onClick={() => setBottomDockTab('input_sources')}
          >
            INPUT SOURCES ({data.inputs?.length || 0})
            {!entitlements?.live_input_streaming && <Lock size={11} style={{ marginLeft: 5 }} />}
          </button>
        </div>

        {bottomDockTab === 'quick_controls' ? (
          <div className="kx-quick-controls-grid">
            <button
              type="button"
              className="kx-qc-btn"
              disabled={!can('operator')}
              onClick={() => control('prev')}
            >
              <strong>PREV</strong>
              <span>CLIP</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn"
              disabled={!can('operator')}
              onClick={() => control('next')}
            >
              <strong>NEXT</strong>
              <span>CLIP</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn"
              disabled={!can('operator') || !cuedMediaId}
              onClick={() => {
                const target = playlistItems.find(i => Number(i.media_id) === Number(cuedMediaId));
                if (target) del('playlist_items', target.id);
              }}
            >
              <strong>REMOVE</strong>
              <span>FROM LIST</span>
            </button>
            <button
              type="button"
              className={`kx-qc-btn ${activePlaylist?.loop ? 'armed' : ''}`}
              disabled={!can('operator') || !activePlaylist}
              onClick={() => activePlaylist && save('playlists', { ...activePlaylist, loop: activePlaylist.loop ? 0 : 1 }, activePlaylist.id)}
            >
              <strong>LOOP</strong>
              <span>{activePlaylist?.loop ? 'ON (24/7)' : 'OFF'}</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn danger"
              disabled={!can('operator')}
              onClick={() => control('stop')}
            >
              <strong>STOP</strong>
              <span>ON AIR</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn"
              onClick={stopPreviewCue}
            >
              <strong>STOP CUE</strong>
              <span>PREVIEW</span>
            </button>
            <button
              type="button"
              className={`kx-qc-btn live-input ${data.engine?.live_input_id ? 'armed' : ''}`}
              onClick={() => handleQuickLiveInput('live_input')}
            >
              <strong>LIVE</strong>
              <span>INPUT</span>
            </button>
            <button
              type="button"
              className={`kx-qc-btn studio-input ${data.engine?.source?.includes('studio_input') ? 'armed' : ''}`}
              onClick={() => handleQuickLiveInput('studio_input')}
            >
              <strong>STUDIO</strong>
              <span>INPUT</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn cg-on"
              disabled={!can('editor')}
              onClick={() => toggleAllEntitledCg(true)}
            >
              <strong>SHOW</strong>
              <span>ALL CG</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn cg-off"
              disabled={!can('editor')}
              onClick={() => toggleAllEntitledCg(false)}
            >
              <strong>HIDE</strong>
              <span>ALL CG</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn"
              disabled={!can('editor')}
              onClick={() => toggleLogoOverlay(true)}
            >
              <strong>LOGO</strong>
              <span>ON</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn"
              disabled={!can('editor')}
              onClick={() => toggleLogoOverlay(false)}
            >
              <strong>LOGO</strong>
              <span>OFF</span>
            </button>
            {[
              ['flash_premium', 'FLASH PRO', '3D FLIP'],
              ['breaking', 'BREAKING', 'BAR'],
              ['breaking_full', 'FULL BRK', 'STAGE'],
              ['breaking_split', '2-WIN BRK', 'SPLIT'],
              ['breaking_3win', '3-WIN BRK', 'TRIPLE'],
              ['weather_map', 'WEATHER', 'NEPAL'],
              ['crawl', 'CRAWL', 'SCROLL']
            ].map(([catKey, topLbl, subLbl]) => {
              const cgLayer = (data.cg || []).find(c => c.category === catKey);
              const isLive = Boolean(cgLayer?.effective_active);
              return (
                <button
                  key={catKey}
                  type="button"
                  className={`kx-qc-btn ${isLive ? 'armed' : ''}`}
                  disabled={!can('operator') || !cgLayer || !cgLayer.entitled}
                  onClick={() => cgLayer && save('cg', { ...cgLayer, active: isLive ? 0 : 1 }, cgLayer.id)}
                  title={`${isLive ? 'Stop (CUT)' : 'Play (TAKE)'} ${cgLayer?.name || topLbl}`}
                >
                  <strong>{topLbl}</strong>
                  <span>{isLive ? '● ON AIR' : subLbl}</span>
                </button>
              );
            })}
            <button
              type="button"
              className="kx-qc-btn"
              onClick={toggleProgramFullscreen}
              title="Launch Program Output in 16:9 Fullscreen Broadcast Mode"
            >
              <strong>FULLSCREEN</strong>
              <span>16:9 OUT</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn accent"
              disabled={!can('editor')}
              onClick={handleCmsSync}
              title="Sync published Editorial CMS stories directly to On-Air CG Layers"
            >
              <strong>CMS SYNC</strong>
              <span>API LIVE</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn accent"
              onClick={() => {
                setCgStudioMode?.('editor');
                setTab('cg_editor');
              }}
            >
              <strong>CG DESIGN</strong>
              <span>EDITOR</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn accent"
              onClick={() => {
                setCgStudioMode?.('controller');
                setTab('cg_controller');
              }}
            >
              <strong>CG LIVE</strong>
              <span>CONTROLLER</span>
            </button>
            <button
              type="button"
              className="kx-qc-btn"
              onClick={() => setUploadOpen(true)}
            >
              <strong>UPLOAD</strong>
              <span>MEDIA</span>
            </button>
          </div>
        ) : (
          <div className="kx-input-sources-panel">
            {!entitlements?.live_input_streaming ? (
              <div className="kx-enterprise-gate">
                <div>
                  <Lock size={16} />
                  <strong>Enterprise Live Input Streaming (RTMP / SRT / UDP / HLS Live Ingest)</strong>
                  <span>Available on Broadcast Plus (NPR 45,000) and Graphics Automation Pro (NPR 60,000).</span>
                </div>
                <button type="button" className="btn sm primary" onClick={() => setTab('subscriptions')}>
                  Upgrade Plan
                </button>
              </div>
            ) : (
              <div className="kx-inputs-row">
                {(data.inputs || []).map(inp => {
                  const isLive = data.engine?.live_input_id === inp.id || inp.is_live;
                  return (
                    <div key={inp.id} className={`kx-input-card ${isLive ? 'live' : ''}`}>
                      <div className="kx-input-card-head">
                        <span className="kx-proto-tag">{(inp.protocol || 'rtmp').toUpperCase()}</span>
                        <strong>{inp.name}</strong>
                        <span className={`kx-status-pill ${isLive ? 'on-air' : 'ready'}`}>
                          {isLive ? '● ON AIR' : 'STANDBY'}
                        </span>
                      </div>
                      <div className="kx-input-card-meta">
                        <span>{inp.url}</span>
                        <small>Latency: {inp.latency_ms || 250}ms • Auto-Fallback: {inp.auto_fallback ? 'ON' : 'OFF'}</small>
                      </div>
                      <div className="kx-input-card-actions">
                        {isLive ? (
                          <button type="button" className="kx-act-btn danger" onClick={() => stopLiveInput(inp.id)}>
                            RETURN TO PLAYLIST
                          </button>
                        ) : (
                          <button type="button" className="kx-act-btn take" onClick={() => takeLiveInput(inp.id)}>
                            TAKE LIVE TO AIR
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="kx-add-input-btn"
                  onClick={() => setTab('live_inputs')}
                >
                  <Plus size={15} />
                  <span>Configure Live Inputs</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM SYSTEM STATUS BAR (ZERO TECH STACK EXPOSURE) */}
      <footer className="kx-system-statusbar">
        <div className="kx-sys-left">
          <span className="kx-sys-item ok">
            SYSTEM STATUS <i>●</i> <strong>{telemetry.status || 'OK'}</strong>
          </span>
          <span className="kx-sys-item">
            CPU <strong>{telemetry.cpu_pct}%</strong>
            <span className="kx-mini-bar"><i style={{ width: `${telemetry.cpu_pct}%` }} /></span>
          </span>
          <span className="kx-sys-item">
            RAM <strong>{telemetry.ram_mb} MB</strong>
            <span className="kx-mini-bar"><i style={{ width: `${Math.min(100, Math.round((telemetry.ram_mb / ((telemetry.ram_gb_total || 8) * 1024)) * 100))}%` }} /></span>
          </span>
          <span className="kx-sys-item">
            STORAGE <strong>{telemetry.disk_pct}%</strong>
            <span className="kx-mini-bar"><i style={{ width: `${Math.min(100, telemetry.disk_pct)}%` }} /></span>
          </span>
          <span className="kx-sys-item">
            OUTPUT <i>●</i> <strong>{data.settings?.scan_mode === 'interlaced' ? (data.settings?.resolution || '1080p').replace(/p$/i, 'i') : (data.settings?.resolution || '1080p')}/{data.settings?.fps || 25} ({data.usage?.active_outputs || 0}/{entitlements?.max_outputs || 8} STREAMS)</strong>
          </span>
          <span className="kx-sys-item">
            USER <strong>{data.account?.username || 'admin'}</strong>
          </span>
          <span className="kx-sys-item ok">
            CLOUD DB <i>●</i> <strong>{telemetry.db_status || 'READY'}</strong>
          </span>
        </div>
        <div className="kx-sys-right">
          <span>TIME <strong>{clock(liveClock)}</strong> NPT • {stationDateStr}</span>
        </div>
      </footer>
    </div>
  );
}

