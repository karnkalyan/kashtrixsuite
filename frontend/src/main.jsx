import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertCircle, CheckCircle2, Clock, CloudUpload, Lock, LogOut, Menu, Sparkles, X
} from 'lucide-react';
import './style.css';
import {
  ALL_KEYS, ALL_LABELS, api, asset, B, clock, defaultData, fmtNpr, Pill, sections
} from './components/shared';
import { ConfirmDialogModal, Login, ToastStack, UpgradeModal, UploadMediaModal } from './components/Modals';
import { OverlayStage, renderCgOverlayBox } from './components/MonitorStage';
import {
  Overview, Playout, Playlists, Scheduler, Graphics, CMS,
  MediaPage, Streaming, LiveInputsPage, SubscriptionsPage, UsersPage, SettingsPage
} from './components/WorkspacePages';

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('kashtrix_token'));
  const [data, setData] = useState(defaultData);
  const [page, setPage] = useState('dashboard');
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [connected, setConnected] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [selectedCg, setSelectedCg] = useState(null);
  const [cgDraft, setCgDraft] = useState(null);
  const [cgStudioMode, setCgStudioMode] = useState('editor');
  const wsRef = useRef(null);

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const showToast = (type, text, duration = 3800, title = '') => {
    const id = Date.now() + Math.random();
    const time = clock(Date.now());
    setToasts(prev => [...prev.slice(-4), { id, type, text, duration, title, time }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const notifyToast = (text, type = 'ok') => showToast(type === 'error' ? 'error' : 'ok', text);

  const reload = async () => {
    try {
      const d = await api('/bootstrap');
      setData(d);
    } catch (e) {
      if (e.message.includes('401') || e.message.includes('Login') || e.message.includes('Session')) {
        sessionStorage.removeItem('kashtrix_token');
        setToken(null);
      }
    }
  };

  useEffect(() => {
    if (!token) return;
    reload();
    let ws;
    let retry;
    const connect = () => {
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?token=' + encodeURIComponent(token));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = e => {
        try {
          const v = JSON.parse(e.data);
          if (v.data) setData(v.data);
          if (v.type === 'subscription.changed' && v.payload?.subscription) {
            showToast('ok', `Subscription updated to ${v.payload.subscription.plan_name} (Demo Mode)`);
          } else if (v.type === 'schedule.triggered' && v.payload?.name) {
            showToast('ok', `Scheduled event triggered: ${v.payload.name}`);
          }
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        retry = setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      clearTimeout(retry);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [token]);

  const mutate = async (path, method, body, customSuccess = 'Changes saved successfully') => {
    try {
      setBusy(true);
      const obj = await api(path, {
        method,
        ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {})
      });
      await reload();
      if (customSuccess) showToast('ok', customSuccess);
      return obj;
    } catch (e) {
      showToast('error', e.message, 6000);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const submit = (r, d, id, msg) => mutate('/' + r + (id ? '/' + id : ''), id ? 'PUT' : 'POST', d, msg);

  const remove = (r, id) => {
    const labelMap = {
      playlist_items: 'playlist rundown item',
      playlists: 'broadcast playlist',
      media: 'media library asset',
      schedules: 'scheduled broadcast event',
      outputs: 'streaming output destination',
      inputs: 'live streaming input feed',
      cg: 'CG graphics layer',
      cg_templates: 'CG template'
    };
    const itemLabel = labelMap[r] || r;
    setConfirmDialog({
      variant: 'danger',
      badge: 'CONFIRM BROADCAST DELETION',
      title: `Remove ${itemLabel}?`,
      message: `Are you sure you want to permanently remove this ${itemLabel} (#${id}) from your active workspace?`,
      confirmLabel: 'Delete Item',
      cancelLabel: 'Keep Item',
      onConfirm: () => mutate('/' + r + '/' + id, 'DELETE', undefined, `Removed ${itemLabel}`)
    });
  };

  const control = (action, media_id = null, position_sec = null) =>
    mutate('/control', 'POST', { action, media_id, position_sec });

  const can = (minRole = 'viewer') => {
    const rank = { viewer: 1, editor: 2, operator: 3, admin: 4, superadmin: 5 };
    return (rank[data.account?.role] || 4) >= (rank[minRole] || 1);
  };

  useEffect(() => {
    if (!selectedPlaylistId && data.playlists?.length) {
      setSelectedPlaylistId(data.playlists[0].id);
    }
  }, [data.playlists, selectedPlaylistId]);

  useEffect(() => {
    if (data.cg?.length) {
      if (!selectedCg) {
        const first = data.cg[0];
        setSelectedCg(first);
        setCgDraft({ ...first });
      } else {
        const updated = data.cg.find(c => c.id === selectedCg.id);
        if (updated) {
          setSelectedCg(updated);
          setCgDraft(prev => prev && prev.id === updated.id ? { ...updated, ...prev, active: updated.active } : { ...updated });
        }
      }
    }
  }, [data.cg]);

  const reorderItem = async (itemOrId, direction) => {
    const itemId = typeof itemOrId === 'object' ? itemOrId?.id : Number(itemOrId);
    const plId = (typeof itemOrId === 'object' ? itemOrId?.playlist_id : null) || selectedPlaylistId || data.playlists?.[0]?.id;
    if (!plId || !itemId) return;
    const list = (data.playlist_items || []).filter(i => i.playlist_id === plId);
    const ids = list.map(i => i.id);
    const idx = ids.indexOf(itemId);
    const other = idx + Number(direction);
    if (idx < 0 || other < 0 || other >= ids.length) return;
    [ids[idx], ids[other]] = [ids[other], ids[idx]];
    await mutate('/playlist-items/reorder', 'POST', { playlist_id: plId, ids }, 'Playlist rundown order updated');
  };

  const addPlaylistItem = async (mediaId) => {
    const plId = selectedPlaylistId || data.playlists?.[0]?.id;
    if (!plId) return;
    await submit('playlist_items', {
      playlist_id: plId,
      media_id: Number(mediaId),
      position: (data.playlist_items || []).filter(i => i.playlist_id === plId).length
    }, null, 'Clip added to rundown');
  };

  const promptCreatePlaylist = () => {
    setConfirmDialog({
      isPrompt: true,
      badge: 'NEW BROADCAST PLAYLIST',
      title: 'Create New 24/7 Broadcast Playlist',
      message: 'Enter a name for the new broadcast rotation block. It will be configured for continuous 24/7 loop playback.',
      inputLabel: 'Playlist Name',
      placeholder: 'e.g. Prime Time News & Music Block',
      defaultValue: '',
      confirmLabel: 'Create Playlist',
      onConfirm: async (newName) => {
        const res = await submit('playlists', { name: newName, loop: 1 }, null, `Created playlist "${newName}"`);
        if (res?.id) setSelectedPlaylistId(res.id);
      }
    });
  };

  const takeLiveInput = async (inputId) => {
    await mutate(`/inputs/${inputId}/take`, 'POST', {}, 'Live Input Stream switched to Programme Air');
  };

  const stopLiveInput = async (inputId) => {
    const targetId = inputId || data.engine?.live_input_id || data.inputs?.[0]?.id || 1;
    await mutate(`/inputs/${targetId}/stop`, 'POST', {}, 'Returned to automated playlist playout');
  };

  const savePreviewCg = async (layerId, draftOverride) => {
    const payloadDraft = draftOverride || cgDraft;
    const targetId = layerId || payloadDraft?.id || selectedCg?.id;
    if (!targetId || !payloadDraft) return;
    await mutate(`/cg/preview/${targetId}`, 'PUT', payloadDraft, `Saved preview state for "${payloadDraft.name || 'CG Layer'}"`);
  };

  const takeCgLayer = async (layerId, draftOverride) => {
    const payloadDraft = draftOverride || cgDraft;
    const targetId = layerId || payloadDraft?.id || selectedCg?.id;
    if (!targetId) return;
    await mutate(`/cg/${targetId}/take`, 'POST', payloadDraft || {}, `TAKEN ON AIR: ${payloadDraft?.name || 'CG Layer'}`);
  };

  const cutCgLayer = async (layerId) => {
    const targetId = layerId || cgDraft?.id || selectedCg?.id;
    if (!targetId) return;
    await mutate(`/cg/${targetId}/cut`, 'POST', {}, 'Graphics layer CUT OFF AIR');
  };

  const duplicateCgLayer = async (layerId) => {
    const targetId = layerId || cgDraft?.id || selectedCg?.id;
    if (!targetId) return;
    await mutate(`/cg/${targetId}/duplicate`, 'POST', {}, 'Duplicated CG layer');
  };

  const resetCgLayout = async (layerId) => {
    setConfirmDialog({
      badge: 'RESET CG CANVAS GEOMETRY',
      title: 'Reset CG Layer Positions to Default?',
      message: 'This will restore default 16:9 safe-zone coordinates and dimensions for your CG graphics layers.',
      confirmLabel: 'Reset Layout',
      onConfirm: async () => {
        await mutate('/cg/layout/reset', 'POST', layerId ? { layer_id: layerId } : {}, 'Reset CG layer geometry to 16:9 defaults');
      }
    });
  };

  const saveLayoutPreset = async (presetName) => {
    if (presetName) {
      await mutate('/cg/layout-presets', 'POST', { name: presetName, description: 'Saved from CG Broadcast Editor' }, `Saved layout preset "${presetName}"`);
      return;
    }
    setConfirmDialog({
      isPrompt: true,
      badge: 'SAVE CG LAYOUT PRESET',
      title: 'Save Current 16:9 Canvas Layout Preset',
      message: 'Save all current CG layer positions, dimensions, and priorities as a reusable studio layout preset.',
      inputLabel: 'Layout Preset Name',
      placeholder: 'e.g. Election Night 16:9 Layout',
      defaultValue: `${selectedCg?.name || 'Studio'} Layout Preset`,
      confirmLabel: 'Save Layout Preset',
      onConfirm: async (enteredName) => {
        await mutate('/cg/layout-presets', 'POST', { name: enteredName, description: 'Saved from CG Broadcast Editor' }, `Saved layout preset "${enteredName}"`);
      }
    });
  };

  const applyLayoutPreset = async (presetId) => {
    if (!presetId) return;
    await mutate(`/cg/layout-presets/${presetId}/apply`, 'POST', {}, 'Applied CG layout preset');
  };

  const saveAsNewTemplate = async (tplId, draftOverride) => {
    const d = draftOverride || cgDraft;
    if (!d) return;
    const baseTplId = tplId || d.template_id || data.cg_templates?.[0]?.id || 1;
    setConfirmDialog({
      isPrompt: true,
      badge: 'SAVE AS NEW CG TEMPLATE',
      title: 'Save Custom Broadcast CG Template',
      message: 'Store the current layer typography, colors, 16:9 coordinates, and animations in your reusable CG Template Library.',
      inputLabel: 'New Template Name',
      placeholder: 'e.g. Prime Headline Strap v2',
      defaultValue: `${d.name || 'Custom'} Template`,
      confirmLabel: 'Save Template',
      onConfirm: async (newName) => {
        await mutate(`/cg-templates/${baseTplId}/save-as`, 'POST', {
          name: newName,
          category: d.category || 'lower_third',
          animation: d.animation || 'slide',
          accent: d.color || '#e11d72',
          bg_color: d.bg_color || '#150d29',
          text_color: d.text_color || '#ffffff',
          gradient: d.gradient || '',
          font_family: d.font_family || 'Nirmala UI, Noto Sans Devanagari, DM Sans, sans-serif',
          font_size: d.font_size || 32,
          font_weight: d.font_weight || '700',
          text_align: d.text_align || 'left',
          position_x: d.position_x ?? 48,
          position_y: d.position_y ?? 820,
          width: d.width ?? 680,
          height: d.height ?? 130,
          z_index: d.z_index ?? 20,
          opacity: d.opacity ?? 0.95,
          border_radius: d.border_radius ?? 12,
          border_width: d.border_width ?? 2,
          border_color: d.border_color || d.color || '#e11d72',
          priority: d.priority ?? 50,
          speed: d.speed ?? 85,
          sample_text: d.text || 'SAMPLE HEADLINE',
          sample_subtext: d.subtext || 'Sample subtitle',
          style_json: d.style_json || ''
        }, `Saved "${newName}" to CG Template Library`);
      }
    });
  };

  const toggleCgLayer = async (layer, e) => {
    if (e) e.stopPropagation();
    const allowedCg = data.entitlements?.cg_categories || ALL_KEYS;
    if (!allowedCg.includes(layer.category)) {
      const isMusicProCat = ['music_now', 'music_credits', 'program_info', 'sponsored_by', 'live_location', 'fullscreen_alert'].includes(layer.category);
      const recPlan = isMusicProCat ? 'music_graphics_pro' : layer.category === 'promo' ? 'broadcast_plus' : ['breaking', 'flash', 'update', 'clock', 'quote', 'headline'].includes(layer.category) ? 'news_pro' : 'growth';
      const recName = isMusicProCat ? 'Graphics Automation Pro (NPR 60,000/mo)' : layer.category === 'promo' ? 'Broadcast Plus' : ['breaking', 'flash', 'update', 'clock', 'quote', 'headline'].includes(layer.category) ? 'News Pro' : 'Growth';
      setUpgradePrompt({
        title: `${ALL_LABELS[layer.category] || layer.category} Locked on ${data.subscription?.plan_name || 'Current'} Plan`,
        message: `Your active ${data.subscription?.plan_name} plan does not include the "${ALL_LABELS[layer.category] || layer.category}" graphics layer. Switch to ${recName} in Demo Mode to unlock it immediately.`,
        recommendedPlan: recPlan,
        recommendedName: recName
      });
      return;
    }
    const nextActive = layer.active ? 0 : 1;
    await submit('cg', { ...layer, active: nextActive }, layer.id, `${layer.name} ${nextActive ? 'TAKEN LIVE' : 'CUT OFF AIR'}`);
  };

  const activateDemoPlan = async (planId) => {
    await mutate('/subscriptions/activate', 'POST', { plan: planId, reason: 'Activated via Subscriptions dashboard' }, `Activated ${planId.replace(/_/g, ' ').toUpperCase()} Demo Plan`);
  };

  if (!token) return <Login onAuth={() => setToken(sessionStorage.getItem('kashtrix_token'))} />;

  const isEmbedMode = Boolean(new URLSearchParams(window.location.search).get('embed'));
  if (isEmbedMode) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <OverlayStage data={data} large />
      </div>
    );
  }

  const onAir = data.engine?.state === 'on_air' || data.engine?.state === 'preview';
  const title = sections.find(s => s[0] === page)?.[1] || 'Overview';
  const activePlanName = data.subscription?.plan_name || 'Graphics Automation Pro';
  const cmsAllowed = data.entitlements?.cms_enabled !== false;

  const isStandaloneStudio = page === 'playout' || page === 'cg_editor' || page === 'cg_controller';

  return (
    <div className={`app-shell ${isStandaloneStudio ? 'standalone-studio-shell' : ''}`}>
      {!isStandaloneStudio && (
        <aside className={'sidebar ' + (drawer ? 'open' : '')}>
        <div className="sidebar-header">
          <img src={asset + 'simulcast-logo-white.png'} alt="Simulcast" />
          <div className="product-identity">
            <strong>KASHTRIX <span>SUITE</span></strong>
            <small>BROADCAST OPERATIONS</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {sections.map(([id, name, Icon]) => {
            const locked =
              (id === 'cms' && !cmsAllowed) ||
              (id === 'live_inputs' && !data.entitlements?.live_input_streaming);
            const activeCount = (data.cg || []).filter(c => c.effective_active).length;
            return (
              <button
                type="button"
                key={id}
                className={'nav-item ' + (page === id ? 'selected' : '')}
                onClick={() => {
                  if (id === 'cg_editor') setCgStudioMode('editor');
                  else if (id === 'cg_controller') setCgStudioMode('controller');
                  setPage(id);
                  setDrawer(false);
                }}
              >
                <Icon size={17} />
                <span>{name}</span>
                {id === 'cg_controller' && activeCount > 0 && (
                  <i className="nav-number">{activeCount} LIVE</i>
                )}
                {id === 'live_inputs' && data.entitlements?.live_input_streaming && (
                  <i className="nav-number">
                    {(data.inputs || []).length}/{data.entitlements?.max_inputs || 4}
                  </i>
                )}
                {id === 'streaming' && (
                  <i className="nav-number">
                    {(data.outputs || []).filter(o => o.enabled).length}/{data.entitlements?.max_outputs || data.tenant?.max_outputs || 8}
                  </i>
                )}
                {id === 'subscriptions' && <i className="nav-badge">{activePlanName}</i>}
                {locked && <Lock size={12} className="nav-lock" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-plan-box" onClick={() => setPage('subscriptions')}>
            <div>
              <small>ACTIVE DEMO PLAN</small>
              <strong>{activePlanName}</strong>
              <span>{fmtNpr(data.subscription?.price_npr || 60000)}/mo • {data.entitlements?.max_outputs || 8} Outputs</span>
            </div>
            <Sparkles size={16} />
          </div>
          <div className="sidebar-health">
            <div className="health-icon"><Activity size={17} /></div>
            <div>
              <b>System monitor</b>
              <span>{data.engine?.dry_run ? 'Standby preview mode' : '24/7 Cloud Playout Active'}</span>
            </div>
            <i className={connected ? 'led' : 'led off'} />
          </div>
          <button type="button" className="signout" onClick={() => { sessionStorage.removeItem('kashtrix_token'); setToken(null); }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      )}

      <main className={`main ${isStandaloneStudio ? 'standalone-studio' : ''}`}>
        {!isStandaloneStudio && (
        <header className="topbar">
          <button type="button" className="mobile-menu" onClick={() => setDrawer(!drawer)}><Menu size={18} /></button>
          <div className="breadcrumb">BROADCAST / <span>{title.toUpperCase()}</span></div>
          <div className="top-right">
            <B small icon={CloudUpload} variant="outline" onClick={() => setUploadModalOpen(true)}>Upload Media</B>
            <Pill color="purple" dot>{activePlanName.toUpperCase()} PLAN</Pill>
            <Pill color={connected ? 'green' : 'red'} dot>{connected ? 'REALTIME CONNECTED' : 'DISCONNECTED'}</Pill>
            <Pill color={onAir ? 'red' : 'muted'} dot>{onAir ? (data.engine?.dry_run ? 'PREVIEW ACTIVE' : 'ON AIR') : 'OFF AIR'}</Pill>
            <div className="header-clock"><b>{clock(data.server_time)}</b><small>NEPAL STANDARD TIME</small></div>
            <div className="operator">OP</div>
          </div>
        </header>
        )}

        <div className={`content ${isStandaloneStudio ? 'standalone-studio-content' : ''}`}>
          {!isStandaloneStudio && (
          <div className="page-intro">
            <div>
              <p className="eyebrow">SIMULCAST / KASHTRIX BROADCAST SUITE</p>
              <h1>{title}<span className="title-pip">.</span></h1>
              <p>{({
                dashboard: 'Your channel operations, live programme monitor, and quick CG play/stop controls',
                playout: 'Master Control Playout Console — Preview/Program monitors, LED timecode bridge, rundown deck & quick controls',
                cg_editor: '16:9 Visual CG Broadcast Editor & Multi-Track Keyframe Timeline — Drag-and-drop layers, safe zones, and inspector',
                cg_controller: 'Dual-Bus CG Live Controller — Preview Bus, Program Bus, Transition Switcher, CG Catalog & Quick Take/Cut',
                live_inputs: 'Enterprise Live Input Streaming — Ingest RTMP, SRT, UDP & HLS studio camera or OB van feeds directly to air',
                playlist: 'Build, reorder, and manage 24/7 media rotations & music video metadata',
                scheduler: 'Automated broadcast scheduling for one-time, daily & weekly programmes, Programme Now/Next & CG overlays',
                graphics: '16:9 Visual CG Broadcast Editor, Multi-Track CG Timeline & Dual-Bus Live CG Controller',
                cms: 'Edit headline text, Nepali/English newsroom copy and editorial workflows',
                media: 'Upload, organize, preview, edit Music CMS metadata, add to playlist, and schedule video, audio & graphic assets',
                streaming: 'Configure independent RTMP, RTMPS, SRT, UDP, Social, HLS relays & Enterprise Live Streaming Inputs',
                subscriptions: 'Select and switch between all 6 Kashtrix SaaS broadcast plans in instant Demo Mode',
                users: 'Tenant users and role permissions',
                settings: 'Encoding presets, Automatic Music Now Playing CG, Programme Now/Next CG, and server diagnostics'
              })[page]}</p>
            </div>
            <div className="intro-actions">
              {busy && <span className="subtle">Saving…</span>}
              <Pill color="magenta">{fmtNpr(data.subscription?.price_npr || 60000)} / month (Demo)</Pill>
              <Pill color="purple"><Clock size={12} /> {new Date(data.server_time || Date.now()).toLocaleDateString('en-GB', { timeZone: 'Asia/Kathmandu', day: '2-digit', month: 'short', year: 'numeric' })}</Pill>
            </div>
          </div>
          )}

          {page === 'dashboard' && <Overview data={data} control={control} navigate={setPage} toggleCgLayer={toggleCgLayer} />}
          {page === 'playout' && (
            <Playout
              data={data}
              can={can}
              entitlements={data.entitlements || {}}
              control={control}
              save={submit}
              del={remove}
              reorderItem={reorderItem}
              addPlaylistItem={addPlaylistItem}
              onCreatePlaylist={promptCreatePlaylist}
              selectedPlaylistId={selectedPlaylistId}
              setSelectedPlaylistId={setSelectedPlaylistId}
              setModal={setUpgradePrompt}
              setUploadOpen={setUploadModalOpen}
              setTab={setPage}
              setCgStudioMode={setCgStudioMode}
              takeLiveInput={takeLiveInput}
              stopLiveInput={stopLiveInput}
              notifyToast={notifyToast}
            />
          )}
          {page === 'playlist' && <Playlists data={data} submit={submit} remove={remove} mutate={mutate} openUpload={() => setUploadModalOpen(true)} />}
          {page === 'scheduler' && <Scheduler data={data} submit={submit} remove={remove} mutate={mutate} openUpload={() => setUploadModalOpen(true)} onUpgrade={setUpgradePrompt} />}
          {(page === 'graphics' || page === 'cg_editor' || page === 'cg_controller') && (
            <Graphics
              data={data}
              can={can}
              entitlements={data.entitlements || {}}
              selectedCg={selectedCg}
              setSelectedCg={setSelectedCg}
              cgDraft={cgDraft}
              setCgDraft={setCgDraft}
              savePreviewCg={savePreviewCg}
              takeCgLayer={takeCgLayer}
              cutCgLayer={cutCgLayer}
              duplicateCgLayer={duplicateCgLayer}
              resetCgLayout={resetCgLayout}
              saveLayoutPreset={saveLayoutPreset}
              applyLayoutPreset={applyLayoutPreset}
              saveAsNewTemplate={saveAsNewTemplate}
              save={submit}
              del={remove}
              studioMode={page === 'cg_controller' ? 'controller' : page === 'cg_editor' ? 'editor' : cgStudioMode}
              setStudioMode={setCgStudioMode}
              setTab={setPage}
              notifyToast={notifyToast}
            />
          )}
          {page === 'live_inputs' && <LiveInputsPage data={data} submit={submit} remove={remove} mutate={mutate} onUpgrade={setUpgradePrompt} navigate={setPage} />}
          {page === 'cms' && <CMS data={data} submit={submit} mutate={mutate} remove={remove} navigate={setPage} onUpgrade={setUpgradePrompt} />}
          {page === 'media' && <MediaPage data={data} mutate={mutate} submit={submit} remove={remove} navigate={setPage} openUpload={() => setUploadModalOpen(true)} onUpgrade={setUpgradePrompt} />}
          {page === 'streaming' && <Streaming data={data} submit={submit} remove={remove} mutate={mutate} onUpgrade={setUpgradePrompt} navigate={setPage} />}
          {page === 'subscriptions' && <SubscriptionsPage data={data} onActivatePlan={activateDemoPlan} busy={busy} />}
          {page === 'users' && <UsersPage data={data} mutate={mutate} />}
          {page === 'settings' && <SettingsPage data={data} mutate={mutate} onUpgrade={setUpgradePrompt} />}
        </div>

        {!isStandaloneStudio && (
        <footer className="app-footer">
          <span>© Simulcast Technologies Pvt. Ltd. • Kashtrix Broadcast Suite</span>
          <span>CLOUD PLAYOUT & GRAPHICS SUITE • NEPAL STANDARD TIME</span>
        </footer>
        )}
      </main>

      {drawer && <div className="mobile-overlay" onClick={() => setDrawer(false)} />}
      <UploadMediaModal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} data={data} onUploaded={reload} />
      <UpgradeModal
        prompt={upgradePrompt}
        onClose={() => setUpgradePrompt(null)}
        onNavigatePlans={() => setPage('subscriptions')}
        onActivatePlan={activateDemoPlan}
      />
      <ConfirmDialogModal
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
      <ToastStack
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
}

function CgRenderPage() {
  const params = new URLSearchParams(window.location.search);
  const tenantId = params.get('tenant') || '1';
  const channelId = params.get('channel') || '1';
  const [state, setState] = useState({ cg: [], cg_content: [], server_time: new Date().toISOString() });

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    window.__setCgRenderState = (next) => {
      if (next && typeof next === 'object') setState(next);
    };
    fetch(`/api/cg/render-state/${tenantId}/${channelId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setState(d); })
      .catch(() => {});
    return () => { delete window.__setCgRenderState; };
  }, [tenantId, channelId]);

  const activeLayers = (state.cg || []).filter(c => c.effective_active && !c.hidden);

  return (
    <div className="kx-cg-render-root">
      {activeLayers.map(layer =>
        renderCgOverlayBox(layer, state.server_time, { cgContent: state.cg_content })
      )}
    </div>
  );
}

const isCgRenderMode = new URLSearchParams(window.location.search).get('cg_render') === '1';
createRoot(document.getElementById('root')).render(isCgRenderMode ? <CgRenderPage /> : <App />);
