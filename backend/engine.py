"""Single-channel broadcast playout engine with Prisma ORM, Entitlements, APScheduler, Music/Programme Auto-CG, FFmpeg, and local MediaMTX."""
import json
import logging
import os
import re
import shutil
import socket
import subprocess
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from prisma import Prisma
from db import (
    SessionLocal,
    Media,
    MusicMetadata,
    ChannelMusicCGSetting,
    ProgrammeCGSetting,
    PlaylistItem,
    Setting,
    Schedule,
    CG,
    CGContent,
    Output,
    InputStream,
    delegate,
)
from entitlements import get_tenant_entitlements, ALL_CG_CATEGORIES
from cg_compositor import get_cg_compositor
from cg_templates_catalog import (
    resolve_cg_collisions,
    format_music_now_playing,
    compute_music_cg_window,
    evaluate_programme_cg_state,
)

log = logging.getLogger('kashtrix.engine')
ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get('DATA_DIR', ROOT / 'data')).resolve()
DATA.mkdir(parents=True, exist_ok=True)
TZ = ZoneInfo(os.environ.get('BROADCAST_TZ', 'Asia/Kathmandu'))
DRY_RUN = os.environ.get('PLAYOUT_DRY_RUN', '0') != '0'
INGEST = os.environ.get('INGEST_URL', 'rtmp://127.0.0.1:1935/channel1')
SOURCE = os.environ.get('SOURCE_URL', 'rtmp://127.0.0.1:1935/channel1')
MEDIAMTX_DIR = Path(os.environ.get('MEDIAMTX_DIR', r'C:\Users\karnk\Downloads\mediamtx_v1.21.3_windows_amd64'))
MEDIAMTX_BIN = Path(os.environ.get('MEDIAMTX_BIN', str(MEDIAMTX_DIR / 'mediamtx.exe')))
MEDIAMTX_CONF = Path(os.environ.get('MEDIAMTX_CONF', str(ROOT / 'deploy' / 'mediamtx.yml')))
CATEGORIES = tuple(ALL_CG_CATEGORIES)
PRESETS = {'360p': (640, 360), '480p': (854, 480), '720p': (1280, 720), '1080p': (1920, 1080)}


def resolve_bin(name: str, env_var: str, fallback_win: str) -> str:
    custom = os.environ.get(env_var, '').strip()
    if custom and Path(custom).exists() and Path(custom).stat().st_size > 0:
        return str(Path(custom))
    if Path(fallback_win).exists() and Path(fallback_win).stat().st_size > 0:
        return fallback_win
    for candidate in (name + '.exe', name):
        found = shutil.which(candidate)
        if found and Path(found).exists() and Path(found).stat().st_size > 0:
            return found
    return name


FFMPEG_BIN = resolve_bin('ffmpeg', 'FFMPEG_BIN', r'C:\ffmpeg\bin\ffmpeg.exe')
FFPROBE_BIN = resolve_bin('ffprobe', 'FFPROBE_BIN', r'C:\ffmpeg\bin\ffprobe.exe')


def _port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.4):
            return True
    except OSError:
        return False


def schedule_is_active(event, now: datetime, tz: ZoneInfo = TZ) -> bool:
    try:
        dt = datetime.fromisoformat(event.starts_at.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=tz)
        dt = dt.astimezone(tz)
    except (ValueError, TypeError):
        return False
    dur = timedelta(seconds=max(5, int(event.duration_sec or 60)))
    if event.repeat in ('daily', 'weekly'):
        target = now.replace(hour=dt.hour, minute=dt.minute, second=dt.second, microsecond=0)
        if event.repeat == 'weekly':
            target -= timedelta(days=(target.weekday() - dt.weekday()) % 7)
        if target > now:
            target -= timedelta(days=7 if event.repeat == 'weekly' else 1)
        dt = target
    return dt <= now <= dt + dur


class BroadcastEngine:
    def __init__(self, tenant_id: int = 1, channel_id: int = 1):
        self.tenant_id = tenant_id
        self.channel_id = channel_id
        self.media_dir = DATA / 'media' / str(tenant_id) / str(channel_id)
        self.media_dir.mkdir(parents=True, exist_ok=True)
        self.cg_dir = DATA / 'cg' / str(tenant_id) / str(channel_id)
        self.cg_dir.mkdir(parents=True, exist_ok=True)
        self.proc: subprocess.Popen | None = None
        self.mediamtx_proc: subprocess.Popen | None = None
        self.relays: dict[int, subprocess.Popen] = {}
        self.relay_sig: dict[int, str] = {}
        self.relay_errors: dict[int, str] = {}
        self.next_retry: dict[int, float] = {}
        self.triggered_schedules: set[int] = set()
        self.event_callback = None
        self.running = True
        self.paused = False
        self.waiting_signal = False
        self.manual_media: int | None = None
        self.live_input_id: int | None = None
        self.index = 0
        self.active_schedule_id: int | None = None
        self.sched_index: int = 0
        self.selector: str | None = None
        self.request_restart = False
        self.started = time.monotonic()
        self.media_started = time.monotonic()
        self.seek_offset_sec: float = 0.0
        self.resume_at_sec: float = 0.0
        self.current_media: int | None = None
        self.media_run_id: str = uuid.uuid4().hex
        self.music_cg_runtime = {
            'run_id': None,
            'media_id': None,
            'active': False,
            'phase': None,
            'text': '',
            'subtext': '',
            'completed_phases': set(),
        }
        self.program_cg_runtime = {
            'schedule_id': None,
            'active': False,
            'phase': None,
            'text': '',
            'subtext': '',
            'completed_phases': set(),
        }
        self.graph_sig = None
        self._cg_contents_cache: tuple[float, list[dict]] | None = None
        self.status = {
            'state': 'idle',
            'source': 'rotation',
            'media_id': None,
            'media_title': None,
            'media_category': None,
            'media_duration': 0,
            'position_sec': 0,
            'live_input_id': None,
            'live_input_name': None,
            'music_cg_active': False,
            'music_cg_phase': None,
            'program_cg_active': False,
            'program_cg_phase': None,
            'error': None,
            'encoder_pid': None,
            'uptime_sec': 0,
            'outputs': {},
            'dry_run': DRY_RUN,
        }

    def emit(self, event_type: str, payload: dict):
        if self.event_callback:
            try:
                self.event_callback(event_type, payload)
            except Exception:
                log.exception('Engine event emit failed for %s', event_type)

    def ensure_mediamtx(self):
        if DRY_RUN or _port_open('127.0.0.1', 1935):
            return
        if self.mediamtx_proc and self.mediamtx_proc.poll() is None:
            return
        if MEDIAMTX_BIN.exists():
            try:
                cmd = [str(MEDIAMTX_BIN)]
                if MEDIAMTX_CONF.exists():
                    cmd.append(str(MEDIAMTX_CONF))
                self.mediamtx_proc = subprocess.Popen(
                    cmd,
                    cwd=str(MEDIAMTX_BIN.parent),
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
                for _ in range(10):
                    if _port_open('127.0.0.1', 1935):
                        break
                    time.sleep(0.15)
                log.info('Started local MediaMTX (PID %s) from %s', self.mediamtx_proc.pid, MEDIAMTX_BIN)
            except OSError as exc:
                log.error('Failed to start MediaMTX from %s: %s', MEDIAMTX_BIN, exc)

    def query(self, db: Prisma, cls):
        if cls is Schedule:
            return delegate(db, cls).find_many(
                where={
                    'tenant_id': self.tenant_id,
                    'OR': [{'channel_id': self.channel_id}, {'channel_id': None}],
                }
            )
        return delegate(db, cls).find_many(where={'tenant_id': self.tenant_id, 'channel_id': self.channel_id})

    def settings(self, db: Prisma) -> dict[str, str]:
        return {r.key: r.value for r in self.query(db, Setting)}

    def get_tz(self, db: Prisma | None = None) -> ZoneInfo:
        if db is not None:
            tz_name = (self.settings(db).get('timezone') or '').strip()
            if tz_name:
                try:
                    return ZoneInfo(tz_name)
                except Exception:
                    pass
        return TZ

    def schedule_switch_mode(self, db: Prisma, event_id: int) -> str:
        mode = (self.settings(db).get(f'schedule_mode_{int(event_id)}') or 'hard_cut').strip().lower()
        return mode if mode in ('hard_cut', 'after_current') else 'hard_cut'

    def active_events(self, db: Prisma):
        tz = self.get_tz(db)
        now = datetime.now(tz)
        return sorted(
            (
                e
                for e in self.query(db, Schedule)
                if e.enabled
                and getattr(e, 'status', 'scheduled') not in ('paused', 'cancelled')
                and (e.id in self.triggered_schedules or schedule_is_active(e, now, tz))
            ),
            key=lambda v: (v.priority or 0, v.id),
            reverse=True,
        )

    def evaluate_music_cg_at_position(
        self,
        db: Prisma,
        media_id: int | None,
        position_sec: float,
        emit_events: bool = True,
    ) -> dict:
        """
        Evaluate automatic Music Now Playing CG at exact playback `position_sec`.
        Only activates when tenant has `music_now_playing` entitlement, media has category == 'music',
        and `ChannelMusicCGSetting.enabled` is True.
        """
        ent = get_tenant_entitlements(db, self.tenant_id)
        if not ent.get('music_now_playing') or not media_id:
            if self.music_cg_runtime['active']:
                self.music_cg_runtime['active'] = False
                self.music_cg_runtime['phase'] = None
                if emit_events:
                    self.emit('music.cg.deactivated', {'media_id': media_id, 'reason': 'entitlement_or_no_media'})
            return {'active': False, 'phase': None, 'text': '', 'subtext': ''}

        media = db.media.find_unique(where={'id': int(media_id)})
        if not media or media.tenant_id != self.tenant_id or (media.category or '').lower() != 'music':
            if self.music_cg_runtime['active']:
                self.music_cg_runtime['active'] = False
                self.music_cg_runtime['phase'] = None
                if emit_events:
                    self.emit('music.cg.deactivated', {'media_id': media_id, 'reason': 'not_music'})
            return {'active': False, 'phase': None, 'text': '', 'subtext': ''}

        cfg = db.channelmusiccgsetting.find_unique(
            where={'tenant_id_channel_id': {'tenant_id': self.tenant_id, 'channel_id': self.channel_id}}
        )
        meta = db.musicmetadata.find_unique(where={'media_id': int(media.id)})
        win = compute_music_cg_window(float(media.duration or 0.0), float(position_sec), cfg, meta)

        if self.music_cg_runtime['run_id'] != self.media_run_id or self.music_cg_runtime['media_id'] != media.id:
            self.music_cg_runtime = {
                'run_id': self.media_run_id,
                'media_id': media.id,
                'active': False,
                'phase': None,
                'text': '',
                'subtext': '',
                'completed_phases': set(),
            }

        headline, subtext = format_music_now_playing(media, meta, cfg)
        phase = win.get('phase')
        should_be_active = bool(win.get('active') and phase not in self.music_cg_runtime['completed_phases'])

        # If previously active in a phase and now outside the window, mark that phase completed for this run_id
        prev_active = self.music_cg_runtime['active']
        prev_phase = self.music_cg_runtime['phase']
        if prev_active and (not win.get('active') or phase != prev_phase):
            if prev_phase:
                self.music_cg_runtime['completed_phases'].add(prev_phase)
            self.music_cg_runtime['active'] = False
            self.music_cg_runtime['phase'] = None
            if emit_events:
                self.emit(
                    'music.cg.deactivated',
                    {
                        'media_id': media.id,
                        'phase': prev_phase,
                        'position_sec': round(float(position_sec), 2),
                    },
                )

        if should_be_active and not self.music_cg_runtime['active']:
            self.music_cg_runtime['active'] = True
            self.music_cg_runtime['phase'] = phase
            self.music_cg_runtime['text'] = headline
            self.music_cg_runtime['subtext'] = subtext
            if emit_events:
                self.emit(
                    'music.cg.activated',
                    {
                        'media_id': media.id,
                        'phase': phase,
                        'text': headline,
                        'subtext': subtext,
                        'position_sec': round(float(position_sec), 2),
                    },
                )
        elif should_be_active:
            self.music_cg_runtime['text'] = headline
            self.music_cg_runtime['subtext'] = subtext

        self.status['music_cg_active'] = self.music_cg_runtime['active']
        self.status['music_cg_phase'] = self.music_cg_runtime['phase']
        return {
            'active': self.music_cg_runtime['active'],
            'phase': self.music_cg_runtime['phase'],
            'text': headline if self.music_cg_runtime['active'] else '',
            'subtext': subtext if self.music_cg_runtime['active'] else '',
            'media_id': media.id,
        }

    def evaluate_programme_cg(
        self,
        db: Prisma,
        now: datetime | None = None,
        elapsed_override_sec: float | None = None,
        emit_events: bool = True,
    ) -> dict:
        """
        Evaluate automatic Programme Now / Next CG.
        Only activates on Graphics Automation Pro when an eligible scheduled programme is running.
        """
        tz = self.get_tz(db)
        now_dt = now or datetime.now(tz)
        ent = get_tenant_entitlements(db, self.tenant_id)
        if not ent.get('program_now_next_auto'):
            if self.program_cg_runtime['active']:
                self.program_cg_runtime['active'] = False
                self.program_cg_runtime['phase'] = None
                if emit_events:
                    self.emit('program.cg.deactivated', {'reason': 'entitlement'})
            return {'active': False, 'phase': None, 'text': '', 'subtext': ''}

        prog_cfg = db.programmecgsetting.find_unique(
            where={'tenant_id_channel_id': {'tenant_id': self.tenant_id, 'channel_id': self.channel_id}}
        )
        all_schedules = self.query(db, Schedule)
        active_ev = self.active_events(db)
        res = evaluate_programme_cg_state(
            all_schedules,
            active_ev,
            now_dt,
            prog_cfg,
            tz,
            elapsed_override_sec=elapsed_override_sec,
        )

        prev_active = self.program_cg_runtime['active']
        prev_phase = self.program_cg_runtime['phase']
        if prev_active and not res['active']:
            self.program_cg_runtime['active'] = False
            self.program_cg_runtime['phase'] = None
            if emit_events:
                self.emit('program.cg.deactivated', {'schedule_id': res.get('schedule_id'), 'phase': prev_phase})
        elif res['active'] and (not prev_active or prev_phase != res['phase']):
            self.program_cg_runtime['active'] = True
            self.program_cg_runtime['phase'] = res['phase']
            self.program_cg_runtime['schedule_id'] = res.get('schedule_id')
            self.program_cg_runtime['text'] = res['text']
            self.program_cg_runtime['subtext'] = res['subtext']
            if emit_events:
                self.emit(
                    'program.cg.activated',
                    {
                        'schedule_id': res.get('schedule_id'),
                        'next_schedule_id': res.get('next_schedule_id'),
                        'phase': res['phase'],
                        'text': res['text'],
                        'subtext': res['subtext'],
                    },
                )
        elif res['active']:
            self.program_cg_runtime['text'] = res['text']
            self.program_cg_runtime['subtext'] = res['subtext']

        self.status['program_cg_active'] = self.program_cg_runtime['active']
        self.status['program_cg_phase'] = self.program_cg_runtime['phase']
        return res

    def effective_layers(self, db: Prisma) -> list[dict]:
        ent = get_tenant_entitlements(db, self.tenant_id)
        allowed_cg = set(ent['cg_categories'])
        settings = self.settings(db)
        w, h = PRESETS.get(settings.get('resolution', '1080p'), PRESETS['1080p'])
        layers = self.query(db, CG)
        events = self.active_events(db)
        cg_takes = {x.target_id for x in events if x.kind == 'cg'}
        contents = {c.id: c for c in self.query(db, CGContent)}
        content_override = next((x for x in events if x.kind == 'cg_content'), None)

        out = []
        for layer in layers:
            item = {
                k: getattr(layer, k, None)
                for k in (
                    'id', 'name', 'category', 'text', 'subtext', 'active',
                    'image_media_id', 'speed', 'color', 'bg_color', 'text_color',
                    'gradient', 'font_family', 'font_size', 'font_weight', 'text_align',
                    'template_id', 'content_id', 'animation', 'position_x', 'position_y',
                    'width', 'height', 'z_index', 'opacity', 'border_radius',
                    'border_width', 'border_color', 'shadow', 'safe_anchor', 'priority',
                    'locked', 'hidden', 'enter_transition', 'exit_transition',
                    'anim_duration_ms', 'style_json', 'start_offset_sec', 'duration_sec',
                )
            }
            cat_allowed = layer.category in allowed_cg
            item['entitled'] = cat_allowed
            c = contents.get(layer.content_id) if layer.content_id else None
            if c and c.status in ('approved', 'published', 'live'):
                item['text'] = c.text or ''
                item['subtext'] = c.subtext or ''
            if content_override and cat_allowed:
                cc = contents.get(content_override.target_id)
                if cc and cc.category == layer.category:
                    item['text'] = cc.text or ''
                    item['subtext'] = cc.subtext or ''
                    item['effective_active'] = True

            # Automatic Music Now Playing injection when active
            if layer.category == 'music_now' and cat_allowed and self.music_cg_runtime.get('active'):
                item['text'] = self.music_cg_runtime.get('text') or item['text']
                item['subtext'] = self.music_cg_runtime.get('subtext') or item['subtext']
                item['effective_active'] = True

            # Automatic Programme Now / Next injection when active
            if layer.category in ('now_next', 'program_info') and cat_allowed and self.program_cg_runtime.get('active'):
                tpl_key = self.program_cg_runtime.get('template_key', 'programme_now_next')
                target_cat = 'program_info' if tpl_key == 'programme_now_showing' else 'now_next'
                if layer.category == target_cat:
                    item['text'] = self.program_cg_runtime.get('text') or item['text']
                    item['subtext'] = self.program_cg_runtime.get('subtext') or ''
                    item['effective_active'] = True

            item.setdefault(
                'effective_active',
                bool(cat_allowed and not item.get('hidden') and (layer.active or layer.id in cg_takes)),
            )
            out.append(item)

        return resolve_cg_collisions(out, target_w=w, target_h=h)

    def select_media(self, db: Prisma):
        ent = get_tenant_entitlements(db, self.tenant_id)
        if self.live_input_id and ent.get('live_input_streaming'):
            inp = db.inputstream.find_unique(where={'id': int(self.live_input_id)})
            if inp and inp.tenant_id == self.tenant_id and inp.enabled:
                return f'input-{inp.id}', inp, f'live_input:{inp.source_type or "live_input"}'
            self.live_input_id = None
        events = self.active_events(db)
        event = next((x for x in events if x.kind in ('media', 'playlist')), None)
        if event:
            switch_mode = self.schedule_switch_mode(db, event.id)
            if (
                switch_mode == 'after_current'
                and self.active_schedule_id != event.id
                and self.selector
                and self.proc is not None
                and self.current_media is not None
            ):
                cur_m = db.media.find_unique(where={'id': self.current_media})
                if cur_m and cur_m.tenant_id == self.tenant_id:
                    return self.selector, cur_m, 'completing current before schedule'
            if self.active_schedule_id != event.id:
                self.active_schedule_id = event.id
                self.sched_index = 0
            if event.kind == 'media':
                m = db.media.find_unique(where={'id': event.target_id})
                if m and m.tenant_id == self.tenant_id:
                    return 'scheduled-' + str(event.id), m, 'scheduled'
            if event.kind == 'playlist':
                pid = event.target_id
                items = db.playlistitem.find_many(
                    where={'tenant_id': self.tenant_id, 'channel_id': self.channel_id, 'playlist_id': pid},
                    order=[{'position': 'asc'}, {'id': 'asc'}],
                )
                if items:
                    m = db.media.find_unique(where={'id': items[self.sched_index % len(items)].media_id})
                    if m and (self.media_dir / m.filename).exists():
                        return f'sched-{event.id}-{pid}-{self.sched_index}-{m.id}', m, 'scheduled playlist'
        else:
            self.active_schedule_id = None
        if self.manual_media and not event:
            self.waiting_signal = False
            m = db.media.find_unique(where={'id': self.manual_media})
            if m and m.tenant_id == self.tenant_id:
                return 'manual-' + str(m.id), m, 'manual'
        if self.waiting_signal:
            return 'waiting-signal', None, 'waiting'
        base = int(self.settings(db).get('base_playlist', '0'))
        pid = base
        items = db.playlistitem.find_many(
            where={'tenant_id': self.tenant_id, 'channel_id': self.channel_id, 'playlist_id': pid},
            order=[{'position': 'asc'}, {'id': 'asc'}],
        )
        if items:
            m = db.media.find_unique(where={'id': items[self.index % len(items)].media_id})
            if m and (self.media_dir / m.filename).exists():
                return f'list-{pid}-{self.index}-{m.id}', m, 'rotation'
        return 'slate', None, 'slate'

    def sync_cg(self, db: Prisma):
        layers = self.effective_layers(db)
        bycat = {v['category']: v for v in layers if v['effective_active']}
        all_bycat = {v['category']: v for v in layers}
        tz = self.get_tz(db)
        for cat in CATEGORIES:
            c = bycat.get(cat)
            text = ((c['text'] or '') + ('\n' + c['subtext'] if c.get('subtext') else '')) if c else ''
            if text and ('<' in text and '>' in text):
                text = re.sub(r'<[^>]+>', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip()
            if cat == 'clock' and c:
                text = datetime.now(tz).strftime('%d %b %Y  %H:%M:%S %Z')
            if cat == 'hebron_logo' and c:
                text = ''
            if cat in ('logo', 'sponsor') and c and c.get('image_media_id'):
                text = ''
            path = self.cg_dir / (cat + '.txt')
            if not path.exists() or path.read_text('utf-8') != text:
                tmp = self.cg_dir / (cat + '.' + uuid.uuid4().hex + '.tmp')
                try:
                    tmp.write_text(text, encoding='utf-8')
                    os.replace(tmp, path)
                except PermissionError:
                    try:
                        path.write_text(text, encoding='utf-8')
                    except OSError:
                        pass
                    finally:
                        tmp.unlink(missing_ok=True)
        use_html_cg = (not DRY_RUN) and (os.getenv('FFMPEG_HTML_CG', '1') == '1')
        if use_html_cg:
            try:
                now_mono = time.monotonic()
                if not self._cg_contents_cache or (now_mono - self._cg_contents_cache[0]) >= 4.0:
                    cg_contents = [
                        {
                            'id': c_row.id,
                            'title': c_row.title,
                            'category': c_row.category,
                            'text': c_row.text,
                            'subtext': c_row.subtext,
                            'status': c_row.status,
                            'template_id': c_row.template_id,
                        }
                        for c_row in db.cgcontent.find_many(where={'tenant_id': self.tenant_id})
                    ]
                    self._cg_contents_cache = (now_mono, cg_contents)
                else:
                    cg_contents = self._cg_contents_cache[1]
                get_cg_compositor(self.tenant_id, self.channel_id).update_state(
                    layers, cg_contents, datetime.now(tz).isoformat()
                )
            except Exception:
                pass
        # Text CG layers update in real time via drawtext reload=1 or HTML5 CG compositor.
        # Only restart for image overlays when HTML5 CG compositor is not active.
        sig = tuple(
            (
                cat,
                bool(bycat[cat].get('effective_active')) if cat in bycat else False,
                bycat[cat].get('image_media_id') if cat in bycat else None,
                int(bycat[cat].get('position_x') or 0) if cat in bycat else 0,
                int(bycat[cat].get('position_y') or 0) if cat in bycat else 0,
                int(bycat[cat].get('width') or 0) if cat in bycat else 0,
            )
            for cat in ('logo', 'sponsor', 'hebron_logo')
        )
        if not use_html_cg and self.graph_sig is not None and sig != self.graph_sig and self.running and not self.paused and self.proc is not None:
            self.resume_at_sec = max(0.0, time.monotonic() - self.media_started + self.seek_offset_sec)
            self.request_restart = True
        self.graph_sig = sig
        return bycat

    def font(self) -> str:
        custom = os.getenv('CG_FONT', '').strip()
        if custom and Path(custom).exists():
            return str(Path(custom))
        for win_font in (
            'C:/Windows/Fonts/Nirmala.ttf',
            'C:/Windows/Fonts/mangal.ttf',
            'C:/Windows/Fonts/segoeui.ttf',
            'C:/Windows/Fonts/arial.ttf',
        ):
            if Path(win_font).exists():
                return win_font
        for linux_font in (
            '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
        ):
            if Path(linux_font).exists():
                return linux_font
        try:
            found = subprocess.run(
                ['fc-match', '-f', '%{file}', 'sans:bold'],
                text=True,
                capture_output=True,
                timeout=5,
            ).stdout.strip()
            if found and Path(found).exists():
                return found
        except (OSError, subprocess.SubprocessError):
            pass
        return '/usr/share/fonts/truetype/freefont/FreeSans.ttf'

    def ffmpeg_args(self, db: Prisma, media, seek_sec: float = 0.0):
        settings = self.settings(db)
        w, h = PRESETS.get(settings.get('resolution', '1080p'), PRESETS['1080p'])
        fps = int(settings.get('fps', '25'))
        speedscale = w / 1920
        bycat = self.sync_cg(db)
        all_layers = {v['category']: v for v in self.effective_layers(db)}
        is_live_input = bool(media and hasattr(media, 'url') and not hasattr(media, 'filename'))
        is_audio_only = bool(media and not is_live_input and (getattr(media, 'mime', '') or '').startswith('audio/'))
        has_file = bool(media and not is_live_input and (self.media_dir / media.filename).exists())
        seek_args = ['-ss', f'{float(seek_sec):.2f}'] if seek_sec and float(seek_sec) > 0.5 else []

        if is_live_input:
            input_args = ['-rw_timeout', '8000000', '-i', str(media.url)]
        elif has_file and not is_audio_only:
            base = int(self.settings(db).get('base_playlist', '0'))
            loop_items = db.playlistitem.find_many(
                where={'tenant_id': self.tenant_id, 'channel_id': self.channel_id, 'playlist_id': base}
            )
            pl = db.playlist.find_unique(where={'id': base}) if base else None
            pl_loop = bool(pl.loop) if pl else True
            loop_args = ['-stream_loop', '-1'] if (pl_loop and len(loop_items) <= 1 and not self.manual_media) else []
            input_args = ['-re'] + seek_args + loop_args + ['-i', str(self.media_dir / media.filename)]
            if not media.has_audio:
                input_args += ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']
        elif has_file and is_audio_only:
            input_args = [
                '-re', '-f', 'lavfi', '-i', f'color=c=0x090e1d:s={w}x{h}:r={fps}',
                '-re',
            ] + seek_args + [
                '-i', str(self.media_dir / media.filename),
            ]
        else:
            input_args = [
                '-re', '-f', 'lavfi', '-i', f'color=c=0x090e1d:s={w}x{h}:r={fps}',
                '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
            ]
        esc = lambda val: Path(str(val)).resolve().as_posix().replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'")
        f = [
            'scale=trunc(iw*sar/2)*2:ih',
            'setsar=1',
            f'scale={w}:{h}:force_original_aspect_ratio=decrease',
            f'pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black',
            'setsar=1',
            'setdar=16/9',
            f'fps={fps}',
            'format=yuv420p',
        ]
        specs = {
            'logo': ('w-tw-28', '22', 30),
            'sponsor': ('24', '25', 24),
            'clock': ('w-tw-35', '70', 23),
            'headline': ('40', 'h-480', 40),
            'promo': ('42', 'h-530', 32),
            'quote': ('40', 'h-430', 30),
            'update': ('40', 'h-385', 30),
            'flash': ('40', 'h-345', 34),
            'breaking': ('40', 'h-285', 42),
            'lower_third': ('40', 'h-235', 33),
            'name_strap': ('40', 'h-182', 30),
            'ticker': ('scroll', 'h-95', 28),
            'crawl': ('scroll', 'h-42', 26),
            'now_next': ('w-tw-35', 'h-575', 27),
            'music_now': ('48', 'h-265', 31),
            'music_credits': ('48', 'h-410', 27),
            'program_info': ('w-tw-35', '125', 28),
            'sponsored_by': ('36', '115', 25),
            'live_location': ('36', '215', 25),
            'fullscreen_alert': ('(w-tw)/2', '(h-th)/2', 44),
            'hebron_breaking': ('40', 'h-260', 38),
            'hebron_flash': ('40', 'h-310', 36),
            'hebron_crawl': ('scroll', 'h-48', 26),
            'hebron_ticker': ('scroll', 'h-96', 28),
            'flash_premium': ('40', 'h-345', 34),
            'breaking_full': ('40', 'h-285', 40),
            'breaking_split': ('40', 'h-285', 36),
            'breaking_3win': ('40', 'h-285', 36),
            'weather_map': ('w-tw-35', '125', 26),
            'logo_anim': ('w-tw-28', '22', 28),
            'live_anim': ('36', '30', 26),
        }
        if 'ticker' not in bycat:
            specs['crawl'] = ('scroll', 'h-72', 34)
        font_escaped = esc(self.font())
        cg_port = None
        cg_pipe_fps = fps
        if not DRY_RUN and os.getenv('FFMPEG_HTML_CG', '1') == '1':
            comp = get_cg_compositor(self.tenant_id, self.channel_id)
            comp.set_fps(fps)
            cg_pipe_fps = comp._fps
            cg_port = comp.ensure_started()
        burn_raw_drawtext = (cg_port is None) and (os.getenv('FFMPEG_RAW_DRAWTEXT', '1') == '1')
        for cat in CATEGORIES:
            if not burn_raw_drawtext:
                continue
            if cat not in bycat:
                continue
            if cat == 'hebron_logo':
                continue
            if cat in ('logo', 'sponsor') and all_layers.get(cat, {}).get('image_media_id'):
                continue
            x, y, default_size = specs.get(cat, ('40', 'h-235', 30))
            c = all_layers.get(cat, {})
            custom_font_size = int(c.get('font_size') or default_size)
            px = max(12, round(custom_font_size * speedscale))
            pad = max(3, round(9 * speedscale))
            color = (c.get('color') or '#E11D72').lstrip('#')
            if len(color) != 6:
                color = 'E11D72'
            bg_hex = (c.get('bg_color') or '').lstrip('#')
            if len(bg_hex) != 6:
                bg_hex = color if cat in ('breaking', 'flash', 'ticker', 'crawl') else '150d29'
            txt_hex = (c.get('text_color') or '#ffffff').lstrip('#')
            if len(txt_hex) != 6:
                txt_hex = 'ffffff'
            opacity = max(0.2, min(1.0, float(c.get('opacity') if c.get('opacity') is not None else 0.88)))
            bg = f'0x{bg_hex}@{opacity:.2f}'
            fcolor = f'0x{txt_hex}'

            scaled_x = int(c.get('scaled_x') or 0)
            scaled_y = int(c.get('scaled_y') or 0)
            anim = c.get('animation') or 'slide'

            if x == 'scroll' or anim == 'scroll-left':
                sp = max(25, min(230, int(c.get('speed') or 100))) * speedscale
                x_expr = f'w-mod(t*{int(sp)}\\,w+tw)'
            elif int(c.get('position_x') or 0) > 0 and scaled_x > 0:
                if anim in ('slide', 'slide-left') and cat in ('lower_third', 'name_strap', 'breaking', 'flash', 'update', 'headline', 'music_now', 'music_credits'):
                    x_expr = f'if(lt(mod(t\\,20)\\,0.65)\\,-tw+(tw+{scaled_x})*mod(t\\,20)/0.65\\,{scaled_x})'
                else:
                    x_expr = str(scaled_x)
            elif anim in ('slide', 'slide-left') and cat in ('lower_third', 'name_strap', 'breaking', 'flash', 'update', 'headline', 'music_now', 'music_credits'):
                x_expr = f'if(lt(mod(t\\,20)\\,0.65)\\,-tw+(tw+{round(40 * speedscale)})*mod(t\\,20)/0.65\\,{round(40 * speedscale)})'
            else:
                x_expr = str(round(int(x) * speedscale)) if x.isdigit() else x

            if scaled_y > 0:
                y_expr = str(scaled_y)
            elif y.startswith('h-'):
                y_expr = f'h-{round(int(y.split("-")[1]) * speedscale)}'
            elif y.isdigit():
                y_expr = str(round(int(y) * speedscale))
            else:
                y_expr = y

            f.append(
                f"drawtext=fontfile='{font_escaped}':textfile='{esc(self.cg_dir / (cat + '.txt'))}'"
                f":reload=1:expansion=none:fontcolor={fcolor}:fontsize={px}:x={x_expr}:y={y_expr}:box=1:boxcolor={bg}:boxborderw={pad}"
            )
        args = [FFMPEG_BIN, '-hide_banner', '-loglevel', 'warning', '-nostdin'] + input_args
        if cg_port is not None:
            cg_idx = sum(1 for a in input_args if a == '-i')
            args += ['-f', 'image2pipe', '-vcodec', 'png', '-r', str(cg_pipe_fps), '-i', f'tcp://127.0.0.1:{cg_port}']
            graph = ['[0:v]' + ','.join(f) + '[v0]']
            cg_scale = f'[{cg_idx}:v]scale={w}:{h}:flags=bilinear[cg0]' if (w != 1280 or h != 720) else f'[{cg_idx}:v]null[cg0]'
            graph.append(cg_scale)
            graph.append('[v0][cg0]overlay=0:0:eof_action=pass[v1]')
            args += ['-filter_complex', ';'.join(graph), '-map', '[v1]']
        else:
            images = []
            for kind in ('logo', 'sponsor', 'hebron_logo'):
                c = bycat.get(kind)
                if not c:
                    continue
                if kind == 'hebron_logo':
                    hebron_png = ROOT / 'cgdemo' / 'hebron' / 'Liquid-glass HEBRON TV logo.png'
                    if hebron_png.exists():
                        images.append((kind, hebron_png, c))
                elif c.get('image_media_id'):
                    m = db.media.find_unique(where={'id': int(c['image_media_id'])})
                    if (
                        m
                        and m.tenant_id == self.tenant_id
                        and Path(m.filename).suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')
                        and (self.media_dir / m.filename).exists()
                    ):
                        images.append((kind, self.media_dir / m.filename, c))
            if images:
                graph = ['[0:v]' + ','.join(f) + '[v0]']
                prev = 'v0'
                for ix, (kind, img_path, c_obj) in enumerate(images):
                    node = f'logo{ix}'
                    out = f'v{ix + 1}'
                    target_w = round((int(c_obj.get('width') or 240) if kind == 'hebron_logo' else (270 if kind == 'logo' else 225)) * speedscale)
                    graph.append(
                        f"movie=filename='{esc(img_path)}',scale={max(60, target_w)}:-1[{node}]"
                    )
                    if kind == 'hebron_logo' and int(c_obj.get('position_x') or 0) > 0:
                        x = str(round(int(c_obj['position_x']) * speedscale))
                        y = str(round(int(c_obj.get('position_y') or 24) * speedscale))
                    else:
                        x = 'W-w-25' if kind in ('logo', 'hebron_logo') else '25'
                        y = '30'
                    graph.append(f'[{prev}][{node}]overlay={x}:{y}:eof_action=repeat[{out}]')
                    prev = out
                args += ['-filter_complex', ';'.join(graph), '-map', '[' + prev + ']']
            else:
                args += ['-vf', ','.join(f), '-map', '0:v:0']
        rate = settings.get('video_bitrate', '4500k')
        rate_kbps = int(rate[:-1]) if rate.endswith('k') and rate[:-1].isdigit() else 4500
        keyint_sec = int(settings.get('keyint_sec', '2') or '2')
        gop = max(fps, fps * max(1, min(4, keyint_sec)))
        rate_control = settings.get('rate_control', 'cbr')
        audio_br = settings.get('audio_bitrate', '128k')
        if audio_br not in ('96k', '128k', '192k', '256k'):
            audio_br = '128k'
        maxrate = f'{rate_kbps}k' if rate_control == 'cbr' else f'{int(rate_kbps * 1.25)}k'
        audio_map = '0:a:0?' if is_live_input else ('0:a:0' if (has_file and not is_audio_only and media.has_audio) else '1:a:0')
        try:
            master_vol = max(0, min(200, int(settings.get('master_volume') or 100)))
        except (ValueError, TypeError):
            master_vol = 100
        scan_mode = (settings.get('scan_mode') or 'progressive').strip().lower()
        ff_threads = os.getenv('FFMPEG_THREADS', '4')
        args += [
            '-map', audio_map,
            '-c:v', 'libx264',
            '-preset', settings.get('preset', 'veryfast'),
            '-tune', 'zerolatency',
            '-threads', ff_threads,
            '-pix_fmt', 'yuv420p',
            '-r', str(fps),
            '-g', str(gop),
            '-b:v', rate,
            '-maxrate', maxrate,
            '-bufsize', str(rate_kbps * 2) + 'k',
        ]
        if scan_mode == 'interlaced':
            args += ['-flags', '+ilme+ildct', '-top', '1', '-x264-params', 'tff=1']
        if master_vol != 100:
            args += ['-af', f'volume={master_vol / 100.0:.2f}']
        args += [
            '-c:a', 'aac',
            '-b:a', audio_br,
            '-ar', '48000',
            '-ac', '2',
        ]
        if has_file and (is_audio_only or not media.has_audio):
            args += ['-shortest']
        return args + ['-f', 'flv', INGEST]

    def stop_encoder(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait(timeout=2)
        self.proc = None

    def stop_relays(self):
        for proc in self.relays.values():
            if proc.poll() is None:
                proc.terminate()
        self.relays.clear()

    def close(self):
        self.stop_encoder()
        self.stop_relays()
        if self.mediamtx_proc and self.mediamtx_proc.poll() is None:
            self.mediamtx_proc.terminate()
            self.mediamtx_proc = None

    def seek(self, position_sec: float):
        """Update playback position and reset music CG phase tracking safely without duplicate triggers."""
        pos = max(0.0, float(position_sec))
        self.seek_offset_sec = pos
        self.media_started = time.monotonic()
        self.media_run_id = uuid.uuid4().hex
        self.status['position_sec'] = int(pos)

    def control(self, action: str, media_id: int | None = None):
        if action == 'stop':
            self.running = False
            self.paused = False
            self.live_input_id = None
            self.stop_encoder()
            self.stop_relays()
            self.status['state'] = 'stopped'
            self.status['live_input_id'] = None
            self.status['live_input_name'] = None
        elif action == 'pause':
            if self.running and not self.paused:
                self.seek_offset_sec = max(0.0, time.monotonic() - self.media_started + self.seek_offset_sec)
                self.paused = True
                self.status['state'] = 'paused'
                self.status['position_sec'] = int(self.seek_offset_sec)
        elif action == 'resume':
            if self.paused:
                self.paused = False
                self.media_started = time.monotonic()
                self.running = True
                self.status['state'] = 'preview' if DRY_RUN else 'on_air'
            elif not self.running:
                self.running = True
                self.request_restart = True
        elif action == 'start':
            if self.paused:
                self.paused = False
                self.media_started = time.monotonic()
                self.running = True
                self.status['state'] = 'preview' if DRY_RUN else 'on_air'
            elif not self.running:
                self.running = True
                self.manual_media = None
                self.live_input_id = None
                self.request_restart = True
            else:
                self.running = True
                if self.manual_media is not None or self.live_input_id is not None:
                    self.manual_media = None
                    self.live_input_id = None
                    self.request_restart = True
        elif action == 'auto':
            self.running = True
            self.paused = False
            if self.manual_media is not None or self.live_input_id is not None or not self.selector:
                self.manual_media = None
                self.live_input_id = None
                self.request_restart = True
        elif action == 'take':
            if media_id is None:
                raise ValueError('Select media')
            self.running = True
            self.paused = False
            self.live_input_id = None
            target_mid = int(media_id)
            matched_idx = None
            try:
                with SessionLocal() as db:
                    base = int(self.settings(db).get('base_playlist', '0'))
                    items = db.playlistitem.find_many(
                        where={'tenant_id': self.tenant_id, 'channel_id': self.channel_id, 'playlist_id': base},
                        order=[{'position': 'asc'}, {'id': 'asc'}],
                    )
                    for i_idx, it in enumerate(items):
                        if it.media_id == target_mid:
                            matched_idx = i_idx
                            break
            except Exception:
                matched_idx = None
            if matched_idx is not None:
                self.manual_media = None
                self.index = matched_idx
            else:
                self.manual_media = target_mid
            self.request_restart = True
        elif action == 'take_input':
            if media_id is None:
                raise ValueError('Select live input stream')
            self.running = True
            self.paused = False
            self.manual_media = None
            self.live_input_id = int(media_id)
            self.request_restart = True
        elif action == 'stop_input':
            self.live_input_id = None
            self.paused = False
            self.request_restart = True
        elif action == 'next':
            self.waiting_signal = False
            self.running = True
            self.paused = False
            self.manual_media = None
            self.live_input_id = None
            self.index += 1
            self.request_restart = True
        elif action == 'prev':
            self.running = True
            self.paused = False
            self.manual_media = None
            self.live_input_id = None
            self.index = max(0, self.index - 1)
            self.request_restart = True
        elif action == 'restart':
            self.running = True
            self.paused = False
            self.request_restart = True
        else:
            raise ValueError('Unsupported control')

    def start_media(self, db: Prisma, selector: str, media, source: str, seek_sec: float = 0.0):
        cmd_args = None
        if not DRY_RUN:
            self.ensure_mediamtx()
            cmd_args = self.ffmpeg_args(db, media, seek_sec=float(seek_sec or 0.0))
        self.stop_encoder()
        self.selector = selector
        is_live_input = bool(media and hasattr(media, 'url') and not hasattr(media, 'filename'))
        self.current_media = None if is_live_input else (media.id if media else None)
        self.media_started = time.monotonic()
        self.seek_offset_sec = float(seek_sec or 0.0)
        self.resume_at_sec = 0.0
        self.media_run_id = uuid.uuid4().hex
        self.music_cg_runtime = {
            'run_id': self.media_run_id,
            'media_id': self.current_media,
            'active': False,
            'phase': None,
            'text': '',
            'subtext': '',
            'completed_phases': set(),
        }
        self.status.update(
            state='preview' if DRY_RUN else 'starting',
            source=source,
            media_id=self.current_media,
            media_title=(media.name if is_live_input else media.title) if media else 'Emergency slate',
            media_category=(media.source_type if is_live_input else media.category) if media else 'slate',
            media_duration=0 if is_live_input else (float(media.duration or 0) if media else 0),
            live_input_id=media.id if is_live_input else None,
            live_input_name=media.name if is_live_input else None,
            position_sec=0,
            music_cg_active=False,
            music_cg_phase=None,
            error=None,
        )
        if not DRY_RUN:
            try:
                self.proc = subprocess.Popen(
                    cmd_args or self.ffmpeg_args(db, media, seek_sec=self.seek_offset_sec),
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
                self.status.update(encoder_pid=self.proc.pid, state='on_air')
            except (OSError, ValueError) as exc:
                self.status.update(state='error', error=str(exc))
                log.exception('Publisher failed')

    def _build_output_target(self, out) -> str:
        url = (out.url or '').strip()
        key = (getattr(out, 'stream_key', None) or '').strip()
        is_rtmp_family = out.protocol in ('rtmp', 'youtube', 'facebook')
        if is_rtmp_family and key:
            if not url.rstrip('/').endswith(key):
                url = url.rstrip('/') + '/' + key.lstrip('/')
        elif out.protocol == 'srt':
            sep = '&' if '?' in url else '?'
            params = []
            if getattr(out, 'stream_mode', None) and 'mode=' not in url:
                params.append(f'mode={out.stream_mode}')
            if getattr(out, 'latency_ms', None) and 'latency=' not in url:
                params.append(f'latency={int(out.latency_ms) * 1000}')
            if getattr(out, 'passphrase', None) and 'passphrase=' not in url:
                params.append(f'passphrase={out.passphrase}')
            if params:
                url = url + sep + '&'.join(params)
        elif out.protocol == 'udp':
            sep = '&' if '?' in url else '?'
            params = []
            if getattr(out, 'pkt_size', None) and 'pkt_size=' not in url:
                params.append(f'pkt_size={int(out.pkt_size)}')
            if getattr(out, 'ttl', None) and 'ttl=' not in url:
                params.append(f'ttl={int(out.ttl)}')
            if params:
                url = url + sep + '&'.join(params)
        return url

    def _output_sig(self, out, settings: dict | None = None) -> str:
        s = settings or {}
        return '|'.join([
            str(out.protocol or ''),
            str(out.url or ''),
            str(getattr(out, 'stream_key', None) or ''),
            str(getattr(out, 'stream_mode', None) or ''),
            str(getattr(out, 'latency_ms', None) or ''),
            str(getattr(out, 'passphrase', None) or ''),
            str(getattr(out, 'pkt_size', None) or ''),
            str(getattr(out, 'ttl', None) or ''),
            str(getattr(out, 'config_json', None) or ''),
            str(s.get('master_volume', '100')),
            str(s.get('stream_volume', '')),
        ])

    def _read_relay_error(self, out_id: int) -> str:
        log_path = self.cg_dir.parent.parent / f'relay_{self.tenant_id}_{out_id}.log'
        if not log_path.exists():
            return ''
        try:
            lines = [ln.strip() for ln in log_path.read_text(encoding='utf-8', errors='ignore').splitlines() if ln.strip()]
            return lines[-1][-220:] if lines else ''
        except OSError:
            return ''

    def relay_args(self, out, ent: dict | None = None, settings: dict | None = None):
        target_url = self._build_output_target(out)
        is_rtmp_family = out.protocol in ('rtmp', 'youtube', 'facebook')

        args = [
            FFMPEG_BIN, '-hide_banner', '-loglevel', 'warning', '-nostdin',
            '-fflags', '+genpts',
        ]
        if SOURCE.startswith('rtsp://'):
            args += ['-rtsp_transport', 'tcp']
        else:
            args += ['-rw_timeout', '10000000']
        args += ['-i', SOURCE, '-map', '0:v:0', '-map', '0:a:0?']

        cfg = {}
        raw_cfg = getattr(out, 'config_json', None)
        if raw_cfg:
            try:
                cfg = json.loads(raw_cfg) if isinstance(raw_cfg, str) else dict(raw_cfg)
            except (ValueError, TypeError):
                cfg = {}

        s = settings or {}
        try:
            master_vol = max(0, min(200, int(s.get('master_volume') or 100)))
        except (ValueError, TypeError):
            master_vol = 100
        raw_stream_vol = cfg.get('stream_volume') if cfg.get('stream_volume') not in (None, '') else s.get('stream_volume')
        try:
            stream_vol = max(0, min(200, int(raw_stream_vol))) if raw_stream_vol not in (None, '') else master_vol
        except (ValueError, TypeError):
            stream_vol = master_vol
        vol_ratio = (stream_vol / master_vol) if master_vol > 0 else (stream_vol / 100.0)
        needs_vol_filter = (stream_vol != master_vol)

        custom_allowed = bool(ent and ent.get('custom_output_encoding'))
        if cfg.get('custom_encoding') and custom_allowed:
            max_kbps = int(ent.get('max_bitrate_kbps') or 8000)
            raw_br = str(cfg.get('video_bitrate') or '4500k').lower().strip()
            try:
                br_kbps = min(max_kbps, max(500, int(raw_br.rstrip('k'))))
            except ValueError:
                br_kbps = min(max_kbps, 4500)
            preset = str(cfg.get('preset') or 'veryfast')
            if preset not in ('ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'):
                preset = 'veryfast'
            audio_br = str(cfg.get('audio_bitrate') or '128k')
            if audio_br not in ('96k', '128k', '192k', '256k'):
                audio_br = '128k'
            res_map = {'360p': (640, 360), '480p': (854, 480), '720p': (1280, 720), '1080p': (1920, 1080)}
            allowed_res = set(ent.get('resolutions') or ['360p', '480p', '720p', '1080p'])
            res = str(cfg.get('resolution') or 'source')
            if res in res_map and res in allowed_res:
                rw, rh = res_map[res]
                args += [
                    '-vf',
                    f'scale=trunc(iw*sar/2)*2:ih,setsar=1,scale={rw}:{rh}:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad={rw}:{rh}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,setdar=16/9',
                ]
            fps = str(cfg.get('fps') or 'source')
            if fps in ('24', '25', '30'):
                args += ['-r', fps]
                g_val = str(int(fps) * 2)
            else:
                g_val = '50'
            args += [
                '-c:v', 'libx264', '-preset', preset, '-tune', 'zerolatency',
                '-pix_fmt', 'yuv420p',
                '-b:v', f'{br_kbps}k', '-maxrate', f'{br_kbps}k', '-bufsize', f'{br_kbps * 2}k',
                '-g', g_val,
            ]
            if needs_vol_filter:
                args += ['-af', f'volume={vol_ratio:.3f}']
            args += ['-c:a', 'aac', '-b:a', audio_br, '-ar', '44100']
        elif needs_vol_filter:
            args += ['-c:v', 'copy', '-af', f'volume={vol_ratio:.3f}', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2']
        else:
            args += ['-c', 'copy']

        if is_rtmp_family:
            return args + ['-flvflags', 'no_duration_filesize', '-f', 'flv', target_url]
        return args + ['-f', 'mpegts', target_url]

    def sync_relays(self, db: Prisma):
        ent = get_tenant_entitlements(db, self.tenant_id)
        allowed_protocols = set(ent['protocols'])
        max_outputs = int(ent['max_outputs'])
        outs = self.query(db, Output)
        enabled = {}
        count = 0
        for x in outs:
            if x.enabled and self.running and x.protocol in allowed_protocols and count < max_outputs:
                enabled[x.id] = x
                count += 1
        cfg_settings = self.settings(db)
        for id, proc in list(self.relays.items()):
            sig = self._output_sig(enabled[id], cfg_settings) if id in enabled else ''
            if id not in enabled or self.relay_sig.get(id) != sig or proc.poll() is not None:
                if proc.poll() is None:
                    proc.terminate()
                else:
                    err_msg = self._read_relay_error(id)
                    if err_msg:
                        self.relay_errors[id] = err_msg
                        log.warning('Relay %s exited (%s): %s', id, proc.returncode, err_msg)
                self.relays.pop(id, None)
                self.next_retry[id] = time.monotonic() + 4
        for id, out in enabled.items():
            if id in self.relays or time.monotonic() < self.next_retry.get(id, 0) or DRY_RUN or out.protocol == 'hls':
                continue
            try:
                log_path = self.cg_dir.parent.parent / f'relay_{self.tenant_id}_{id}.log'
                log_file = open(log_path, 'wb')
                self.relays[id] = subprocess.Popen(
                    self.relay_args(out, ent, cfg_settings),
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=log_file,
                    start_new_session=True,
                )
                log_file.close()
                self.relay_sig[id] = self._output_sig(out, cfg_settings)
                self.relay_errors.pop(id, None)
            except OSError as exc:
                self.relay_errors[id] = str(exc)
                log.error('Relay %s failed: %s', out.name, exc)
        self.status['outputs'] = {
            str(x.id): (
                'disabled'
                if not x.enabled or x.id not in enabled
                else 'active-hls'
                if x.protocol == 'hls'
                else 'dry-run'
                if DRY_RUN
                else 'running'
                if x.id in self.relays
                else 'reconnecting'
            )
            for x in outs
        }
        self.status['output_errors'] = {
            str(x.id): self.relay_errors.get(x.id, '')
            for x in outs
            if self.relay_errors.get(x.id)
        }

    def tick(self):
        with SessionLocal() as db:
            self.status['uptime_sec'] = int(time.monotonic() - self.started)
            if not self.running or self.paused:
                if self.paused:
                    self.status['state'] = 'paused'
                    self.status['position_sec'] = int(self.seek_offset_sec)
                if not self.running:
                    self.stop_relays()
                else:
                    self.sync_relays(db)
                self.sync_cg(db)
                return
            base = int(self.settings(db).get('base_playlist', '0'))
            active_sched_ev = next((x for x in self.active_events(db) if x.kind == 'playlist' and x.id == self.active_schedule_id), None)
            is_sched_pl = bool(active_sched_ev and str(self.selector or '').startswith(f'sched-{active_sched_ev.id}-'))
            active_pid = active_sched_ev.target_id if is_sched_pl else base
            pl = db.playlist.find_unique(where={'id': active_pid}) if active_pid else None
            pl_loop = bool(pl.loop) if pl else True
            pl_items = db.playlistitem.find_many(
                where={'tenant_id': self.tenant_id, 'channel_id': self.channel_id, 'playlist_id': active_pid},
                order=[{'position': 'asc'}, {'id': 'asc'}],
            )
            cur_idx = self.sched_index if is_sched_pl else self.index
            if self.proc and self.proc.poll() is not None:
                self.proc = None
                if not pl_loop and pl_items and (cur_idx % len(pl_items)) >= len(pl_items) - 1 and self.manual_media is None and not is_sched_pl:
                    self.waiting_signal = True
                    self.selector = None
                    return
                self.manual_media = None
                next_idx = (cur_idx + 1) % len(pl_items) if (pl_loop and pl_items) else (cur_idx + 1)
                if is_sched_pl:
                    self.sched_index = next_idx
                else:
                    self.index = next_idx
                self.selector = None
            pos = time.monotonic() - self.media_started + self.seek_offset_sec
            if self.current_media and self.selector and not self.live_input_id:
                m = db.media.find_unique(where={'id': self.current_media})
                dur_val = float(m.duration or 0) if m else 0.0
                # Advance seamlessly right before EOF so looped playlists never drop offline
                threshold = dur_val if DRY_RUN else max(0.5, dur_val - 0.15)
                if dur_val > 0 and pos > threshold and (len(pl_items) > 1 or self.manual_media is not None or not pl_loop or self.active_schedule_id is not None):
                    if not pl_loop and pl_items and (cur_idx % len(pl_items)) >= len(pl_items) - 1 and self.manual_media is None and not is_sched_pl:
                        self.waiting_signal = True
                        self.selector = None
                        pos = 0.0
                        break_to_waiting = True
                    else:
                        break_to_waiting = False
                    if not break_to_waiting:
                        self.manual_media = None
                        next_idx = (cur_idx + 1) % len(pl_items) if (pl_loop and pl_items) else (cur_idx + 1)
                        if is_sched_pl:
                            self.sched_index = next_idx
                        else:
                            self.index = next_idx
                        self.selector = None
                        pos = 0.0
            selector, m, source = self.select_media(db)
            if self.request_restart or selector != self.selector:
                self.request_restart = False
                if selector == self.selector and self.resume_at_sec > 0.0:
                    resume = self.resume_at_sec
                    self.resume_at_sec = 0.0
                    self.start_media(db, selector, m, source, seek_sec=resume)
                    pos = resume
                else:
                    self.resume_at_sec = 0.0
                    self.start_media(db, selector, m, source)
                    pos = 0.0
            self.status['position_sec'] = int(pos)
            self.evaluate_music_cg_at_position(db, self.current_media, pos, emit_events=True)
            self.evaluate_programme_cg(db, emit_events=True)
            self.sync_cg(db)
            self.sync_relays(db)
