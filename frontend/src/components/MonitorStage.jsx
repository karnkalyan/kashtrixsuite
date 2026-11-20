import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Volume2, VolumeX, Radio, Film, Music, Play, Pause, Square,
  RotateCw, Maximize2, Minimize2, ExternalLink, Activity
} from 'lucide-react';
import { clock, fmt, mediaStreamUrl, mediaThumbUrl, FONT_FAMILIES } from './shared';
import {
  AnimatedBroadcastText,
  extractHeadlines,
  renderSpecializedCgDemoComponent
} from './CgDemoOverlays';
import { isRichHtml, sanitizeBroadcastHtml } from './RichBroadcastEditor';

/**
 * Renders the actual currently running video/audio asset from the playout engine
 * synced to `data.engine.position_sec`. Never shows a hardcoded stock photo when media exists.
 */
export function LiveVideoSurface({ data, allowFallbackMedia = true, showAudioToggle = true }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const masterVolNorm = Math.max(0, Math.min(1, Number(data?.settings?.master_volume ?? 100) / 100));
  const [videoReady, setVideoReady] = useState(false);

  const activeMedia = useMemo(() => {
    const engineId = data.engine?.media_id;
    if (engineId) {
      const found = (data.media || []).find(m => m.id === engineId);
      if (found) return found;
    }
    if (allowFallbackMedia) {
      const firstPl = (data.playlist_items || [])[0];
      if (firstPl) {
        const found = (data.media || []).find(m => m.id === firstPl.media_id);
        if (found) return found;
      }
      const firstVid = (data.media || []).find(m => (m.duration || 0) > 0);
      if (firstVid) return firstVid;
    }
    return null;
  }, [data.engine?.media_id, data.media, data.playlist_items, allowFallbackMedia]);

  const isRunning = data.engine?.state === 'on_air' || data.engine?.state === 'preview';
  const isPausedOrStopped = data.engine?.state === 'paused' || data.engine?.state === 'stopped';
  const isAudioOnly = Boolean(activeMedia?.mime?.startsWith('audio/'));
  const streamSrc = activeMedia ? mediaStreamUrl(activeMedia.id) : '';
  const prevEnginePosRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = masterVolNorm;
    }
  }, [masterVolNorm, muted, activeMedia?.id]);

  useEffect(() => {
    setVideoReady(false);
    prevEnginePosRef.current = null;
  }, [activeMedia?.id]);

  // Keep HTML5 <video>/<audio> synced with engine position_sec and play/pause state
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeMedia) return;
    const targetPos = Number(data.engine?.position_sec ?? 0);
    const prevPos = prevEnginePosRef.current;
    prevEnginePosRef.current = targetPos;

    if (Number.isFinite(targetPos) && targetPos >= 0 && (!el.duration || targetPos < el.duration)) {
      // Only snap to 0 if the engine explicitly jumped from >2s back to 0 (e.g. IN / CUE button)
      if (targetPos === 0) {
        if (prevPos !== null && prevPos > 2 && el.currentTime > 2) {
          try { el.currentTime = 0; } catch {}
        }
      } else if (Math.abs(el.currentTime - targetPos) > 2.2) {
        try { el.currentTime = targetPos; } catch {}
      }
    }

    if (isPausedOrStopped) {
      el.pause();
    } else if (isRunning && el.paused) {
      el.play().catch(() => {});
    }
  }, [activeMedia?.id, data.engine?.position_sec, isRunning, isPausedOrStopped]);

  return (
    <div className="stage-media-layer">
      {activeMedia && !isAudioOnly ? (
        <video
          ref={videoRef}
          className="stage-video-el"
          src={streamSrc}
          autoPlay
          loop={(data.playlist_items || []).length <= 1}
          muted={muted}
          playsInline
          onLoadedMetadata={(e) => {
            setVideoReady(true);
            const pos = Number(data.engine?.position_sec || 0);
            if (pos > 0 && e.currentTarget.duration && pos < e.currentTarget.duration) {
              try { e.currentTarget.currentTime = pos; } catch {}
            }
            e.currentTarget.play().catch(() => {});
          }}
        />
      ) : activeMedia && isAudioOnly ? (
        <div className="stage-audio-visualizer">
          <audio key={activeMedia.id} ref={videoRef} src={streamSrc} autoPlay loop muted={muted} />
          <div className="audio-pulse-ring"><Music size={34} /></div>
          <strong>{activeMedia.title}</strong>
          <span>AUDIO BROADCAST STREAM • {fmt(data.engine?.position_sec || 0)}</span>
        </div>
      ) : (
        <div className="stage-idle-slate">
          <Film size={32} />
          <strong>NO MEDIA LOADED ON AIR</strong>
          <span>Upload a video in Media Library or press Start in Playout</span>
        </div>
      )}

      {activeMedia && showAudioToggle && (
        <button
          type="button"
          className="stage-mute-btn"
          onClick={(e) => {
            e.stopPropagation();
            setMuted(m => !m);
          }}
          title={muted ? 'Unmute monitor audio' : 'Mute monitor audio'}
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          <span>{muted ? 'Muted' : 'Audio On'}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Renders a single CG layer box or specialized CG Demo / Flash News Premium component
 * using responsive 16:9 aspect-ratio coordinates, colors, gradients, and animations.
 */
export function renderCgOverlayBox(layer, serverTime, extraProps = {}) {
  const specialized = renderSpecializedCgDemoComponent(layer, serverTime, extraProps);
  if (specialized) {
    return specialized;
  }

  const rx = Number(layer.position_x ?? layer.ref_x ?? 48);
  const ry = Number(layer.position_y ?? layer.ref_y ?? 800);
  const rw = Number(layer.width ?? layer.ref_w ?? 680);
  const rh = Number(layer.height ?? layer.ref_h ?? 110);

  const leftPct = Math.max(0, Math.min(98, (rx / 1920) * 100));
  const topPct = Math.max(0, Math.min(96, (ry / 1080) * 100));
  const widthPct = Math.max(6, Math.min(100 - leftPct, (rw / 1920) * 100));
  const heightPct = Math.max(4, Math.min(100 - topPct, (rh / 1080) * 100));

  const isScroll = layer.category === 'ticker' || layer.category === 'crawl' || layer.animation === 'scroll-left' || layer.animation === 'scroll';
  const accentColor = layer.border_color || layer.color || '#e11d72';
  const bgStyle = layer.gradient
    ? layer.gradient
    : (layer.bg_color || (['breaking', 'flash'].includes(layer.category) ? '#991b1b' : '#130d26'));

  // Resolve text from CMS API (`/api/cg_content`) if bound or published
  const resolvedHeadlines = extractHeadlines(layer, [layer.text || layer.name || ''], extraProps.cgContent);
  const primaryText = layer.category === 'clock'
    ? `${clock(serverTime)} NPT`
    : (resolvedHeadlines[0] || layer.text || layer.name);

  const hasImageBug = ['logo', 'sponsor'].includes(layer.category) && layer.image_media_id;

  return (
    <div
      key={layer.id || layer.category}
      className={`cg-live-layer cat-${layer.category} anim-${layer.animation || 'slide'}${extraProps.className ? ' ' + extraProps.className : ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        zIndex: Number(layer.z_index || 15) + (extraProps.zBoost || 0),
        background: bgStyle,
        color: layer.text_color || '#ffffff',
        opacity: layer.opacity ?? 0.94,
        fontFamily: layer.font_family || FONT_FAMILIES[0],
        textAlign: layer.text_align || 'left',
        borderRadius: `${Math.round((layer.border_radius ?? 8) * 0.45)}px`,
        borderLeft: `3.5px solid ${accentColor}`,
        borderTop: `1px solid ${accentColor}55`,
        borderRight: `1px solid ${accentColor}44`,
        borderBottom: `1px solid ${accentColor}44`,
        boxShadow: layer.shadow || '0 8px 24px rgba(0,0,0,0.55)',
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      {hasImageBug ? (
        <div className="cg-layer-img-wrap">
          <img src={mediaThumbUrl(layer.image_media_id)} alt={layer.name} />
          {layer.text && <span>{layer.text}</span>}
        </div>
      ) : isScroll ? (
        <div className="cg-layer-marquee">
          <span className="cg-tag-pill" style={{ background: accentColor, fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {layer.category === 'crawl' ? 'NEWS CRAWL' : 'HEADLINES'}
          </span>
          <div className="marquee" style={{ fontFamily: layer.font_family || 'Inter, DM Sans, sans-serif' }}>
            <em>{primaryText} 　◆　 {primaryText} 　◆　 </em>
          </div>
        </div>
      ) : (
        <div className="cg-layer-inner">
          {['breaking', 'flash', 'music_now', 'music_credits', 'program_info', 'now_next', 'promo'].includes(layer.category) && (
            <small className="cg-kicker" style={{ color: '#ff8ec6', fontFamily: 'Inter, DM Sans, sans-serif' }}>
              {layer.category === 'breaking' ? 'BREAKING NEWS' :
               layer.category === 'flash' ? 'FLASH NEWS' :
               layer.category === 'music_now' ? '♫ NOW PLAYING' :
               layer.category === 'music_credits' ? '♫ TRACK CREDITS' :
               layer.category === 'program_info' ? 'NOW SHOWING' :
               layer.category === 'promo' ? 'COMING UP' : 'COMING UP NEXT'}
            </small>
          )}
          <strong
            style={{
              fontSize: `clamp(9px, ${Math.max(0.65, ((layer.font_size || 30) / 1080) * 42)}vw, 18px)`,
              fontWeight: layer.font_weight || '700',
              fontFamily: layer.font_family || 'Inter, DM Sans, sans-serif'
            }}
          >
            {isRichHtml(primaryText) ? (
              <span
                className="kx-rich-cg-html"
                dangerouslySetInnerHTML={{ __html: sanitizeBroadcastHtml(primaryText) }}
              />
            ) : (
              <AnimatedBroadcastText
                text={primaryText}
                animation={layer.animation || 'none'}
                speed={layer.speed ? layer.speed / 50 : 1}
                cursor={layer.animation === 'typewriter'}
              />
            )}
          </strong>
          {layer.subtext && (
            <span className="cg-subline" style={{ fontFamily: layer.font_family || 'Inter, DM Sans, sans-serif' }}>{layer.subtext}</span>
          )}
        </div>
      )}
      {extraProps.resizeHandle}
    </div>
  );
}

/**
 * Main Composited Output Stage — plays real video + renders active CG layers at their real coordinates
 * with native 16:9 Broadcast Fullscreen support.
 */
export function OverlayStage({ data, large = false, showFullscreenBtn = true }) {
  const stageRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeLayers = useMemo(
    () => (data.cg || []).filter(c => c.effective_active && !c.hidden),
    [data.cg]
  );
  const isRunning = data.engine?.state === 'on_air' || data.engine?.state === 'preview';

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === stageRef.current));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = (e) => {
    if (e) e.stopPropagation();
    const el = stageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {
          setIsFullscreen(prev => !prev);
        });
      } else {
        setIsFullscreen(prev => !prev);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div
      ref={stageRef}
      className={'stage ' + (large ? 'large ' : '') + (isFullscreen ? 'fullscreen-mode' : '')}
    >
      <LiveVideoSurface data={data} allowFallbackMedia={true} showAudioToggle={true} />

      {/* Render only active CG layers at their real 1920x1080 positions */}
      <div className="stage-cg-overlay-plane">
        {activeLayers.map(layer =>
          renderCgOverlayBox(layer, data.server_time, { cgContent: data.cg_content })
        )}
      </div>

      <div className="stage-status-chip">
        <i className={isRunning ? 'dot-live' : 'dot-idle'} />
        <span>
          {isRunning ? 'ON AIR' : 'STANDBY'} • {data.engine?.media_title || 'No active clip'} • 16:9 ({data.settings?.width || 1920}×{data.settings?.height || 1080})
        </span>
      </div>

      {showFullscreenBtn && (
        <button
          type="button"
          className="stage-fullscreen-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Full Screen Output (Esc)' : 'Full Screen Broadcast Output (16:9)'}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Custom Broadcast HLS Video Player — replaces default browser HTML5 controls
 * with a broadcast control room HUD (Play/Pause, Stop, Live Sync, Volume, Buffer Health, PiP, Fullscreen).
 */
export function CustomBroadcastHlsPlayer({ data, onSwitchDirect }) {
  const playerWrapRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const masterVolNorm = Math.max(0, Math.min(1, Number(data?.settings?.master_volume ?? 100) / 100));
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = masterVolNorm;
    }
  }, [masterVolNorm, muted]);
  const [volume, setVolume] = useState(0.8);
  const [bufferSec, setBufferSec] = useState(0);
  const [videoRes, setVideoRes] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const url = '/hls/channel1/index.m3u8';
  const isOnAir = data.engine?.state === 'on_air' || data.engine?.state === 'preview';
  const activeLayers = useMemo(
    () => (data.cg || []).filter(c => c.effective_active && !c.hidden),
    [data.cg]
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let hls;
    let errorGraceTimer = null;
    setStreamError('');

    if (Hls.isSupported()) {
      hls = new Hls({
        liveSyncDurationCount: 2,
        maxBufferLength: 10,
        enableWorker: true
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStreamError('');
        el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      });
      hls.on(Hls.Events.FRAG_LOADED, () => {
        setStreamError('');
      });
      hls.on(Hls.Events.ERROR, (ev, d) => {
        if (d.fatal) {
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => { try { hls.startLoad(); } catch {} }, 500);
          } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
            try { hls.recoverMediaError(); } catch {}
          }
          clearTimeout(errorGraceTimer);
          errorGraceTimer = setTimeout(() => {
            if (!isOnAir) {
              setStreamError('Broadcast HLS origin stream is initializing or waiting for active programme output.');
            }
          }, 8000);
        }
      });
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = url;
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      setStreamError('HLS playback is not supported in this browser.');
    }

    const timer = setInterval(() => {
      if (!el) return;
      if (el.videoWidth && el.videoHeight) {
        setVideoRes(`${el.videoWidth}×${el.videoHeight}`);
      }
      if (el.buffered && el.buffered.length > 0) {
        const end = el.buffered.end(el.buffered.length - 1);
        setBufferSec(Math.max(0, end - el.currentTime));
      }
    }, 1000);

    return () => {
      clearTimeout(errorGraceTimer);
      clearInterval(timer);
      if (hls) hls.destroy();
      hlsRef.current = null;
      el.pause();
      el.removeAttribute('src');
      el.load();
    };
  }, [reloadKey]);

  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === playerWrapRef.current));
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const stopPlayback = () => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    setPlaying(false);
  };

  const syncToLiveEdge = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.buffered && el.buffered.length > 0) {
      el.currentTime = Math.max(0, el.buffered.end(el.buffered.length - 1) - 0.5);
    }
    setReloadKey(k => k + 1);
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
    setMuted(v === 0);
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    const nextMuted = !muted;
    el.muted = nextMuted;
    setMuted(nextMuted);
  };

  const togglePip = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (el.requestPictureInPicture) {
        await el.requestPictureInPicture();
      }
    } catch {}
  };

  const toggleFullscreen = () => {
    const wrap = playerWrapRef.current;
    if (!wrap) return;
    if (!document.fullscreenElement) {
      wrap.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const bufferPct = Math.min(100, Math.max(8, (bufferSec / 6) * 100));

  return (
    <div ref={playerWrapRef} className="kx-custom-hls-player">
      {/* Top Broadcast HUD */}
      <div className="kx-hls-top-bar">
        <div className="kx-hls-meta-left">
          <span className={`kx-hls-live-tag ${isOnAir && !streamError ? '' : 'idle'}`}>
            <i className="kx-hls-live-dot" />
            {isOnAir && !streamError ? 'LIVE HLS ORIGIN' : 'ORIGIN STANDBY'}
          </span>
          <span className="kx-hls-title">
            {data.engine?.media_title || 'Kashtrix Channel 1 Master Output'}
          </span>
        </div>
        <div className="kx-hls-meta-right">
          <span className="kx-hls-badge green">
            <Activity size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Buffer: {bufferSec.toFixed(1)}s
          </span>
          <span className="kx-hls-badge">
            {videoRes || `${data.settings?.width || 1920}×${data.settings?.height || 1080}`} • {data.settings?.fps || 25}fps
          </span>
        </div>
      </div>

      {/* Video Surface (No Browser Default Controls) */}
      <video
        ref={videoRef}
        className="kx-custom-hls-video"
        autoPlay
        muted={muted}
        playsInline
        onClick={togglePlay}
      />

      {/* Real-time 16:9 Broadcast CG Graphics Overlay Plane synced with Live Output */}
      <div className="stage-cg-overlay-plane">
        {activeLayers.map(layer =>
          renderCgOverlayBox(layer, data.server_time, { cgContent: data.cg_content })
        )}
      </div>

      {/* Standby / Reconnect Slate */}
      {streamError && (
        <div className="kx-hls-slate">
          <Radio size={34} color="#e11d72" />
          <h4>Broadcast HLS Stream Initializing</h4>
          <p>{streamError}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn sm" onClick={syncToLiveEdge}>
              <RotateCw size={13} /> Reconnect Origin
            </button>
            {onSwitchDirect && (
              <button type="button" className="btn sm primary" onClick={onSwitchDirect}>
                Switch to Direct Composited Output
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Broadcast Transport Control Bar */}
      <div className="kx-hls-bottom-bar">
        <div className="kx-hls-progress-track" title={`Live Stream Buffer: ${bufferSec.toFixed(1)}s`}>
          <div className="kx-hls-progress-fill" style={{ width: `${bufferPct}%` }} />
        </div>

        <div className="kx-hls-controls-row">
          <div className="kx-hls-ctrl-group">
            <button
              type="button"
              className={`kx-hls-ctrl-btn ${playing ? 'active' : ''}`}
              onClick={togglePlay}
              title={playing ? 'Pause Stream' : 'Play Stream'}
            >
              {playing ? <Pause size={13} /> : <Play size={13} />}
              <span>{playing ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              type="button"
              className="kx-hls-ctrl-btn"
              onClick={stopPlayback}
              title="Stop Stream Playback"
            >
              <Square size={12} />
              <span>STOP</span>
            </button>

            <button
              type="button"
              className="kx-hls-ctrl-btn"
              onClick={syncToLiveEdge}
              title="Re-sync to Real-time Live Edge"
            >
              <RotateCw size={13} />
              <span>SYNC LIVE</span>
            </button>

            <div className="kx-hls-vol-wrap">
              <button
                type="button"
                className="kx-hls-ctrl-btn"
                onClick={toggleMute}
                title={muted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="kx-hls-vol-slider"
                title={`Audio Gain: ${Math.round((muted ? 0 : volume) * 100)}%`}
              />
            </div>
          </div>

          <div className="kx-hls-ctrl-group">
            <button
              type="button"
              className="kx-hls-ctrl-btn"
              onClick={togglePip}
              title="Picture-in-Picture Monitor"
            >
              <ExternalLink size={13} />
              <span>PiP</span>
            </button>

            <button
              type="button"
              className="kx-hls-ctrl-btn"
              onClick={toggleFullscreen}
              title="Full Screen Broadcast Monitor"
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Programme Monitor with tabs for Live Composited Output vs Custom Broadcast HLS Player + real-time progress bar.
 */
export function LiveMonitor({ data, large = false, compact = false }) {
  const [actual, setActual] = useState(false);
  const monitorWrapRef = useRef(null);

  const currentMedia = useMemo(() => {
    const id = data.engine?.media_id;
    return (data.media || []).find(m => m.id === id) || null;
  }, [data.engine?.media_id, data.media]);

  const posSec = Number(data.engine?.position_sec || 0);
  const durSec = Number(currentMedia?.duration || 0);
  const pct = durSec > 0 ? Math.min(100, Math.max(0, (posSec / durSec) * 100)) : (data.engine?.state === 'on_air' ? 100 : 0);

  const triggerMainFullscreen = () => {
    const target = monitorWrapRef.current?.querySelector('.stage, .kx-custom-hls-player') || monitorWrapRef.current;
    if (!target) return;
    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div ref={monitorWrapRef} className={'monitor-area' + (compact ? ' compact' : '')}>
      <div className="monitor-tabs">
        <button
          type="button"
          className={!actual ? 'on' : ''}
          onClick={() => setActual(false)}
        >
          Live Programme + CG Output
        </button>
        <button
          type="button"
          className={actual ? 'on' : ''}
          onClick={() => setActual(true)}
        >
          Custom HLS Broadcast Player
        </button>
        <span className="monitor-source-tag">
          <Radio size={11} /> {data.engine?.media_title || 'Standby'}
        </span>
        <button
          type="button"
          className="monitor-fullscreen-tab-btn"
          onClick={triggerMainFullscreen}
          title="Open Main Output in Fullscreen (16:9)"
        >
          <Maximize2 size={12} /> Full Screen
        </button>
      </div>

      {actual ? (
        <CustomBroadcastHlsPlayer data={data} onSwitchDirect={() => setActual(false)} />
      ) : (
        <OverlayStage data={data} large={large} />
      )}

      {/* Real-time playback progress bar */}
      <div className="monitor-progress-row">
        <div className="progress monitor-progress">
          <i style={{ width: `${pct.toFixed(1)}%` }} />
        </div>
        <div className="monitor-timecode">
          <span>{fmt(posSec)} {durSec > 0 ? `/ ${fmt(durSec)} (${Math.round(pct)}%)` : ''}</span>
          <span>{(data.cg || []).filter(c => c.effective_active).length} CG Active • 16:9 {data.settings?.scan_mode === 'interlaced' ? (data.settings?.resolution || '1080p').replace(/p$/i, 'i') : (data.settings?.resolution || '1080p')}@{data.settings?.fps || 25}fps</span>
        </div>
      </div>
    </div>
  );
}

