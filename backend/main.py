"""FastAPI control-room backend for Kashtrix Broadcast Suite (Prisma ORM + MySQL + APScheduler + Music & Visual CG Pro)."""
import asyncio
import hashlib
import ipaddress
import json
import logging
import os
import re
import secrets
import shutil
import subprocess
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response
from prisma import Prisma
from pydantic import BaseModel

from db import (
    connect_db,
    disconnect_db,
    get_db,
    SessionLocal,
    object_dict,
    delegate,
    Tenant,
    SubscriptionPlan,
    PlanEntitlement,
    TenantSubscription,
    SubscriptionHistory,
    ResourceUsage,
    User,
    SessionToken,
    Channel,
    Media,
    MusicMetadata,
    ChannelMusicCGSetting,
    ProgrammeCGSetting,
    Playlist,
    PlaylistItem,
    CG,
    CGContent,
    CGTemplate,
    CGTemplateVersion,
    CGLayoutPreset,
    CGPreviewState,
    Schedule,
    Output,
    InputStream,
    Setting,
    Audit,
    utcnow,
    ROOT,
)
from security import hash_password, check_password, current_user, require, roles
from entitlements import (
    PLAN_DEFINITIONS,
    PLAN_LIMITS,
    seed_plans,
    get_plan_catalog,
    get_tenant_subscription,
    get_tenant_entitlements,
    compute_resource_usage,
    activate_or_change_plan,
    assert_cg_category_allowed,
    assert_cms_allowed,
    assert_custom_template_allowed,
    assert_music_cg_allowed,
    assert_programme_cg_allowed,
    assert_visual_designer_allowed,
    assert_schedule_allowed,
    assert_output_allowed,
    assert_input_stream_allowed,
    assert_cg_timeline_allowed,
    validate_feature_or_limit,
)
from cg_templates_catalog import (
    BUILTIN_20_TEMPLATES,
    DEFAULT_20_CG_LAYERS,
    format_music_now_playing,
    compute_music_cg_window,
)
from engine import BroadcastEngine, PRESETS, CATEGORIES, DATA, DRY_RUN, TZ, FFMPEG_BIN, FFPROBE_BIN
from system_info import get_hardware_info, get_available_fonts
from scheduler_service import BroadcastSchedulerService

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)
logging.getLogger('apscheduler').setLevel(logging.WARNING)
log = logging.getLogger('kashtrix.api')

APP_TENANT = int(os.getenv('ENGINE_TENANT_ID', '1'))
APP_CHANNEL = int(os.getenv('ENGINE_CHANNEL_ID', '1'))
HLS_ORIGIN = os.getenv('HLS_ORIGIN', 'http://127.0.0.1:8888').rstrip('/')
engine = BroadcastEngine(APP_TENANT, APP_CHANNEL)
SESSIONS = 12 * 3600
MAX_UPLOAD = int(os.getenv('MAX_UPLOAD_GB', '4')) * 1024**3
client_ws: set[WebSocket] = set()
_main_loop: asyncio.AbstractEventLoop | None = None

VIDEO_EXTS = {'.mp4', '.mov', '.mkv', '.webm', '.ts', '.m4v'}
AUDIO_EXTS = {'.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg'}
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp'}
ALLOWED_MEDIA_EXTS = VIDEO_EXTS | AUDIO_EXTS | IMAGE_EXTS

VALID_ANIMATIONS = {
    'slide', 'slide-left', 'slide-right', 'slide-up', 'slide-down',
    'fade', 'fade-in', 'fade-out', 'wipe', 'none',
    'scroll', 'scroll-left', 'zoom', 'zoom-in', 'pulse-slide', 'flash-in',
    'char-reveal', 'word-reveal', 'slide-in-out', 'typewriter', 'flip-3d',
    'glow-pulse', 'devanagari-wave', 'flip',
}

RESOURCES = {
    'media': Media,
    'playlists': Playlist,
    'playlist_items': PlaylistItem,
    'cg': CG,
    'cg_content': CGContent,
    'cg_templates': CGTemplate,
    'schedules': Schedule,
    'outputs': Output,
    'inputs': InputStream,
}
FIELDS = {
    'media': {'title', 'folder', 'category'},
    'playlists': {'name', 'loop'},
    'playlist_items': {'playlist_id', 'media_id', 'position'},
    'cg': {
        'name', 'category', 'text', 'subtext', 'active', 'image_media_id',
        'speed', 'color', 'bg_color', 'text_color', 'gradient',
        'font_family', 'font_size', 'font_weight', 'text_align',
        'template_id', 'content_id', 'animation',
        'position_x', 'position_y', 'width', 'height', 'z_index',
        'opacity', 'border_radius', 'border_width', 'border_color',
        'shadow', 'safe_anchor', 'priority', 'locked', 'hidden',
        'enter_transition', 'exit_transition', 'anim_duration_ms',
        'style_json', 'start_offset_sec', 'duration_sec',
    },
    'cg_content': {'title', 'category', 'text', 'subtext', 'status', 'template_id'},
    'cg_templates': {
        'template_key', 'name', 'category', 'animation', 'accent',
        'bg_color', 'text_color', 'gradient', 'font_family', 'font_size',
        'font_weight', 'text_align', 'position_x', 'position_y', 'width', 'height',
        'z_index', 'opacity', 'border_radius', 'border_width', 'border_color',
        'shadow', 'zone', 'priority', 'speed', 'enter_transition',
        'exit_transition', 'anim_duration_ms', 'sample_text', 'sample_subtext',
        'style_json', 'enabled',
    },
    'schedules': {
        'name', 'kind', 'target_id', 'starts_at', 'duration_sec',
        'repeat', 'priority', 'programme_category', 'enable_programme_cg',
        'enabled', 'status',
    },
    'outputs': {
        'name', 'protocol', 'url', 'stream_key', 'latency_ms', 'passphrase',
        'stream_mode', 'pkt_size', 'ttl', 'hls_segment_sec', 'hls_window_size',
        'config_json', 'enabled',
    },
    'inputs': {
        'name', 'source_type', 'protocol', 'url', 'backup_url',
        'latency_ms', 'passphrase', 'stream_mode', 'buffer_ms',
        'auto_fallback', 'enabled', 'is_live',
    },
}
REQUIRED = {
    'media': {'title'},
    'playlists': {'name'},
    'playlist_items': {'playlist_id', 'media_id'},
    'cg': {'name', 'category'},
    'cg_content': {'title', 'category'},
    'cg_templates': {'name', 'category'},
    'schedules': {'name', 'kind', 'target_id', 'starts_at'},
    'outputs': {'name', 'protocol', 'url'},
    'inputs': {'name', 'protocol', 'url'},
}
BOOL_FIELDS = {'loop', 'active', 'enabled', 'locked', 'hidden', 'enable_programme_cg', 'auto_fallback', 'is_live'}
INT_FIELDS = {
    'playlist_id', 'media_id', 'position', 'image_media_id',
    'speed', 'template_id', 'content_id', 'target_id', 'start_offset_sec', 'duration_sec', 'priority',
    'position_x', 'position_y', 'width', 'height', 'z_index', 'font_size',
    'border_radius', 'border_width', 'anim_duration_ms',
    'latency_ms', 'pkt_size', 'ttl', 'hls_segment_sec', 'hls_window_size', 'buffer_ms',
}
FLOAT_FIELDS = {'opacity'}
PERMS = {
    'media': 'editor',
    'playlists': 'operator',
    'playlist_items': 'operator',
    'cg': 'editor',
    'cg_content': 'editor',
    'cg_templates': 'editor',
    'schedules': 'operator',
    'outputs': 'admin',
    'inputs': 'operator',
}


def tenant_query(db: Prisma, model, uid: int, channel_id: int = APP_CHANNEL):
    return delegate(db, model).find_many(where={'tenant_id': uid, 'channel_id': channel_id})


def scoped(db: Prisma, model, id: int, user: User):
    obj = delegate(db, model).find_unique(where={'id': int(id)})
    if obj is None or obj.tenant_id != user.tenant_id or obj.channel_id != APP_CHANNEL:
        raise HTTPException(404, 'Item not found')
    return obj


def ensure_instance(user: User):
    if user.tenant_id != APP_TENANT:
        raise HTTPException(403, 'This node only runs its assigned tenant; deploy a separate worker for another tenant')


def audit(db: Prisma, user: User, action: str, detail=''):
    db.audit.create(
        data={
            'tenant_id': user.tenant_id,
            'channel_id': APP_CHANNEL,
            'user_id': user.id,
            'action': action,
            'detail': str(detail)[:290],
        }
    )


def settings_map(db: Prisma, tenant_id: int) -> dict[str, str]:
    return {
        x.key: x.value
        for x in db.setting.find_many(where={'tenant_id': tenant_id, 'channel_id': APP_CHANNEL})
    }


def upsert_setting(db: Prisma, tenant_id: int, channel_id: int, key: str, value: str):
    db.setting.upsert(
        where={'tenant_id_channel_id_key': {'tenant_id': tenant_id, 'channel_id': channel_id, 'key': key}},
        data={
            'create': {'tenant_id': tenant_id, 'channel_id': channel_id, 'key': key, 'value': str(value)},
            'update': {'value': str(value)},
        },
    )


def active_schedule_ids(db: Prisma):
    return {x.target_id for x in engine.active_events(db) if x.kind == 'cg'}


def secret_mask(s: str) -> str:
    p = urlparse(s)
    return f'{p.scheme}://{p.hostname or "destination"}/••••'


def _ensure_music_and_programme_settings(db: Prisma, tenant_id: int, channel_id: int = APP_CHANNEL):
    m_cfg = db.channelmusiccgsetting.find_unique(
        where={'tenant_id_channel_id': {'tenant_id': tenant_id, 'channel_id': channel_id}}
    )
    if not m_cfg:
        m_cfg = db.channelmusiccgsetting.create(
            data={
                'tenant_id': tenant_id,
                'channel_id': channel_id,
                'enabled': True,
                'show_at_start': True,
                'start_delay_sec': 20,
                'start_duration_sec': 10,
                'show_before_end': True,
                'end_lead_sec': 30,
                'end_duration_sec': 10,
                'template_key': 'music_now_playing_gradient',
                'visible_fields_json': '["song_title","artist","album"]',
                'position_x': 60,
                'position_y': 805,
                'width': 760,
                'height': 155,
                'opacity': 0.95,
                'text_color': '#ffffff',
                'bg_color': '#160d2d',
                'accent_color': '#e11d72',
                'animation': 'slide-up',
            }
        )
    p_cfg = db.programmecgsetting.find_unique(
        where={'tenant_id_channel_id': {'tenant_id': tenant_id, 'channel_id': channel_id}}
    )
    if not p_cfg:
        p_cfg = db.programmecgsetting.create(
            data={
                'tenant_id': tenant_id,
                'channel_id': channel_id,
                'enabled': True,
                'show_at_start': True,
                'start_delay_sec': 10,
                'start_duration_sec': 12,
                'show_before_end': True,
                'end_lead_sec': 45,
                'end_duration_sec': 12,
                'template_key': 'programme_now_next',
                'eligible_categories_json': '["news","talk","special","music","live"]',
                'eligible_schedule_ids': '[]',
                'show_title': True,
                'show_category': True,
                'show_time': True,
                'show_next': True,
                'position_x': 1180,
                'position_y': 250,
                'width': 680,
                'height': 135,
                'animation': 'slide-left',
            }
        )
    return m_cfg, p_cfg


def resource_list(db: Prisma, key: str, user: User):
    if key == 'media':
        meta_by_media = {
            m.media_id: object_dict(m)
            for m in db.musicmetadata.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
        }
        out = []
        for x in tenant_query(db, Media, user.tenant_id):
            d = object_dict(x)
            d['music_metadata'] = meta_by_media.get(x.id)
            out.append(d)
        return out
    if key == 'playlist_items':
        items = sorted(
            tenant_query(db, PlaylistItem, user.tenant_id),
            key=lambda x: (x.playlist_id or 0, x.position or 0, x.id),
        )
        meta_by_media = {
            m.media_id: object_dict(m)
            for m in db.musicmetadata.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
        }
        media_by_id = {m.id: m for m in tenant_query(db, Media, user.tenant_id)}
        out = []
        for x in items:
            m = media_by_id.get(x.media_id)
            out.append(
                dict(
                    object_dict(x),
                    title=m.title if m else 'Missing media',
                    category=m.category if m else 'video',
                    duration=m.duration if m else 0,
                    filename=m.filename if m else '',
                    music_metadata=meta_by_media.get(x.media_id),
                )
            )
        return out
    if key == 'cg':
        return engine.effective_layers(db)
    if key == 'schedules':
        s_map = settings_map(db, user.tenant_id)
        return [
            dict(
                object_dict(x),
                switch_mode=(s_map.get(f'schedule_mode_{x.id}') or 'hard_cut'),
            )
            for x in tenant_query(db, Schedule, user.tenant_id)
        ]
    if key == 'outputs':
        return [dict(object_dict(x), url=secret_mask(x.url), edit_url=x.url) for x in tenant_query(db, Output, user.tenant_id)]
    return [object_dict(x) for x in tenant_query(db, RESOURCES[key], user.tenant_id)]


def snapshot(db: Prisma, user: User) -> dict:
    result = {r: resource_list(db, r, user) for r in RESOURCES}
    audit_rows = db.audit.find_many(
        where={'tenant_id': user.tenant_id},
        order={'id': 'desc'},
        take=15,
    )
    tenant_obj = db.tenant.find_unique(where={'id': user.tenant_id})
    channels = db.channel.find_many(where={'tenant_id': user.tenant_id})
    sub_info = get_tenant_subscription(db, user.tenant_id, APP_CHANNEL)
    plans_catalog = get_plan_catalog(db)
    m_cfg, p_cfg = _ensure_music_and_programme_settings(db, user.tenant_id, APP_CHANNEL)
    music_meta_rows = db.musicmetadata.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
    preview_rows = db.cgpreviewstate.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
    preset_rows = db.cglayoutpreset.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
    version_rows = db.cgtemplateversion.find_many(
        where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL},
        order={'id': 'desc'},
        take=30,
    )
    hw = get_hardware_info()
    fonts_info = get_available_fonts()
    result.update(
        {
            'settings': settings_map(db, user.tenant_id),
            'engine': engine.status.copy(),
            'hardware': hw,
            'system_fonts': fonts_info,
            'system_telemetry': {
                'status': 'OK' if engine.status.get('state') != 'error' else 'DEGRADED',
                'cpu_pct': hw.get('cpu_pct', 0),
                'ram_mb': int(round(float(hw.get('ram_used_gb') or 0) * 1024)),
                'ram_gb_total': hw.get('ram_total_gb') or int(sub_info.get('ram_gb') or 8),
                'vcpu_total': hw.get('cpu_threads') or int(sub_info.get('vcpu') or 4),
                'disk_pct': hw.get('disk_pct') or float(sub_info['usage'].get('storage_percent') or 0.0),
                'db_status': 'CLOUD DB READY',
            },
            'audit': [object_dict(x) for x in audit_rows],
            'server_time': datetime.now(TZ).isoformat(),
            'account': {'id': user.id, 'username': user.username, 'role': user.role, 'tenant_id': user.tenant_id},
            'tenant': object_dict(tenant_obj),
            'channels': [object_dict(x) for x in channels],
            'subscription': sub_info,
            'entitlements': sub_info['entitlements'],
            'usage': sub_info['usage'],
            'plans': plans_catalog,
            'music_metadata': [object_dict(x) for x in music_meta_rows],
            'music_cg_settings': object_dict(m_cfg),
            'programme_cg_settings': object_dict(p_cfg),
            'cg_preview_states': [object_dict(x) for x in preview_rows],
            'cg_layout_presets': [object_dict(x) for x in preset_rows],
            'cg_template_versions': [object_dict(x) for x in version_rows],
        }
    )
    return result


async def notify(event_type: str | None = None, payload_data: dict | None = None):
    if not client_ws:
        return
    snap_by_user: dict[int, dict] = {}
    with SessionLocal() as db:
        for ws in list(client_ws):
            try:
                user_id = ws.state.user_id
                tenant_id = getattr(ws.state, 'tenant_id', APP_TENANT)
                if tenant_id != APP_TENANT:
                    continue
                if user_id not in snap_by_user:
                    u = db.user.find_unique(where={'id': user_id})
                    if u and u.enabled:
                        snap_by_user[user_id] = snapshot(db, u)
            except Exception:
                client_ws.discard(ws)
    for ws in list(client_ws):
        try:
            user_id = ws.state.user_id
            snap = snap_by_user.get(user_id)
            if not snap:
                continue
            if event_type:
                await ws.send_json(
                    {
                        'type': event_type,
                        'tenant_id': APP_TENANT,
                        'channel_id': APP_CHANNEL,
                        'payload': payload_data or {},
                        'data': snap,
                    }
                )
            else:
                await ws.send_json({'type': 'state', 'data': snap})
        except Exception:
            client_ws.discard(ws)


def _scheduler_event_bridge(event_type: str, payload_data: dict):
    if _main_loop and not _main_loop.is_closed():
        try:
            asyncio.run_coroutine_threadsafe(
                notify(event_type if event_type != 'system.health' else None, payload_data),
                _main_loop,
            )
        except RuntimeError:
            pass


scheduler_service = BroadcastSchedulerService(engine, event_callback=_scheduler_event_bridge)


def seed():
    connect_db()
    with SessionLocal() as db:
        t = db.tenant.find_unique(where={'id': APP_TENANT})
        if not t:
            initial_plan = os.getenv('TENANT_PLAN', 'broadcast_plus')
            if initial_plan not in PLAN_LIMITS:
                initial_plan = 'broadcast_plus'
            max_o, storage = PLAN_LIMITS[initial_plan]
            t = db.tenant.create(
                data={
                    'id': APP_TENANT,
                    'name': os.getenv('TENANT_NAME', 'Simulcast Demonstration Channel'),
                    'slug': 'simulcast-demo',
                    'plan': initial_plan,
                    'max_outputs': max_o,
                    'storage_quota_gb': storage,
                }
            )
        channel = db.channel.find_unique(where={'id': APP_CHANNEL})
        if not channel:
            db.channel.create(
                data={
                    'id': APP_CHANNEL,
                    'tenant_id': APP_TENANT,
                    'name': 'Main TV Channel',
                    'slug': 'main',
                    'enabled': True,
                }
            )
        if not db.user.find_first(where={'tenant_id': APP_TENANT}):
            pw = os.getenv('ADMIN_PASSWORD', 'KashtrixAdmin2026!')
            if not pw or len(pw) < 12:
                raise RuntimeError('ADMIN_PASSWORD must be set to a strong password (minimum 12 characters) before first start')
            db.user.create(
                data={
                    'tenant_id': APP_TENANT,
                    'username': os.getenv('ADMIN_USERNAME', 'admin'),
                    'password_hash': hash_password(pw),
                    'role': 'superadmin',
                    'enabled': True,
                }
            )
        playlists = db.playlist.find_many(where={'tenant_id': APP_TENANT, 'channel_id': APP_CHANNEL})
        if not playlists:
            p = db.playlist.create(
                data={
                    'tenant_id': APP_TENANT,
                    'channel_id': APP_CHANNEL,
                    'name': '24/7 Rotation',
                    'loop': True,
                }
            )
            base = p.id
        else:
            base = playlists[0].id

        # Ensure all 20 built-in animated CG templates exist
        existing_templates = db.cgtemplate.find_many(where={'tenant_id': APP_TENANT, 'channel_id': APP_CHANNEL})
        by_key = {t.template_key: t for t in existing_templates if t.template_key}
        by_cat = {}
        for tpl in BUILTIN_20_TEMPLATES:
            tkey = tpl['template_key']
            if tkey not in by_key:
                created_tpl = db.cgtemplate.create(
                    data={
                        'tenant_id': APP_TENANT,
                        'channel_id': APP_CHANNEL,
                        **tpl,
                        'enabled': True,
                    }
                )
                by_key[tkey] = created_tpl
                by_cat.setdefault(tpl['category'], created_tpl)
            else:
                by_cat.setdefault(tpl['category'], by_key[tkey])

        # Ensure all 20 CG layers exist (preserving existing records and adding any new categories)
        cg_rows = db.cg.find_many(where={'tenant_id': APP_TENANT, 'channel_id': APP_CHANNEL})
        existing_cg_cats = {c.category: c for c in cg_rows}
        for name, category, text, subtext, is_active, color, px, py, w, h, prio in DEFAULT_20_CG_LAYERS:
            if category not in existing_cg_cats:
                tpl = by_cat.get(category)
                anim = (
                    'scroll'
                    if category in ('ticker', 'crawl')
                    else 'slide'
                    if category in ('lower_third', 'breaking', 'flash', 'music_now', 'music_credits', 'now_next', 'program_info')
                    else 'fade'
                )
                db.cg.create(
                    data={
                        'tenant_id': APP_TENANT,
                        'channel_id': APP_CHANNEL,
                        'name': name,
                        'category': category,
                        'text': text,
                        'subtext': subtext,
                        'template_id': tpl.id if tpl else None,
                        'active': is_active,
                        'speed': 85,
                        'color': color,
                        'bg_color': tpl.bg_color if tpl else '#150d29',
                        'text_color': tpl.text_color if tpl else '#ffffff',
                        'gradient': tpl.gradient if tpl else '',
                        'font_family': tpl.font_family if tpl else 'Inter, DM Sans, sans-serif',
                        'font_size': tpl.font_size if tpl else 32,
                        'animation': anim,
                        'position_x': px,
                        'position_y': py,
                        'width': w,
                        'height': h,
                        'priority': prio,
                    }
                )
            elif category in ('lower_third', 'name_strap', 'update', 'quote', 'now_next', 'headline', 'promo', 'music_now', 'music_credits', 'program_info', 'sponsored_by', 'live_location'):
                cur_row = existing_cg_cats[category]
                old_nepali_samples = (
                    'विशेष संवाद र विश्लेषण',
                    'डा. प्रकाश शर्मा',
                    'NOW PLAYING • सम्झनाको फूल',
                    'SONG CREDITS • सम्झनाको फूल',
                    'NOW SHOWING: साँझ समाचार',
                    'TONIGHT 8:00 PM • विशेष साङ्गीतिक साँझ',
                    'यस कार्यक्रमका प्रायोजक',
                    '● LIVE  |  काठमाडौँ, नेपाल',
                    'आजका प्रमुख समाचार बुँदाहरू',
                    'NEWS UPDATE • समाचार बुलेटिन',
                )
                if (cur_row.text or '').strip() in old_nepali_samples:
                    db.cg.update(
                        where={'id': cur_row.id},
                        data={'text': text, 'subtext': subtext},
                    )

        _ensure_music_and_programme_settings(db, APP_TENANT, APP_CHANNEL)

        # Ensure default CG layout presets exist
        existing_presets = db.cglayoutpreset.find_many(where={'tenant_id': APP_TENANT, 'channel_id': APP_CHANNEL})
        preset_names = {p.name for p in existing_presets}
        if not existing_presets:
            default_layout = [
                {'category': cat, 'position_x': px, 'position_y': py, 'width': w, 'height': h, 'priority': prio}
                for (_, cat, _, _, _, _, px, py, w, h, prio) in DEFAULT_20_CG_LAYERS
            ]
            db.cglayoutpreset.create(
                data={
                    'tenant_id': APP_TENANT,
                    'channel_id': APP_CHANNEL,
                    'name': 'Standard Broadcast 1080p Safe Zones',
                    'description': 'Default non-overlapping 1920x1080 layout for news, ticker, crawl, and channel bugs',
                    'resolution': '1080p',
                    'layout_json': json.dumps(default_layout),
                    'is_default': True,
                }
            )
            music_layout = [
                {
                    'category': cat,
                    'position_x': (64 if cat == 'music_now' else px),
                    'position_y': (790 if cat == 'music_now' else py),
                    'width': (820 if cat == 'music_now' else w),
                    'height': (165 if cat == 'music_now' else h),
                    'priority': prio,
                }
                for (_, cat, _, _, _, _, px, py, w, h, prio) in DEFAULT_20_CG_LAYERS
            ]
            db.cglayoutpreset.create(
                data={
                    'tenant_id': APP_TENANT,
                    'channel_id': APP_CHANNEL,
                    'name': 'Music TV Prime Layout',
                    'description': 'Optimized for music channels with prominent Music Now Playing strap and clean top bugs',
                    'resolution': '1080p',
                    'layout_json': json.dumps(music_layout),
                    'is_default': False,
                }
            )
        if 'Hebron TV Complete Channel Demo' not in preset_names:
            hebron_layout = [
                {'category': cat, 'position_x': px, 'position_y': py, 'width': w, 'height': h, 'priority': prio}
                for (_, cat, _, _, _, _, px, py, w, h, prio) in DEFAULT_20_CG_LAYERS
                if cat.startswith('hebron_')
            ]
            db.cglayoutpreset.create(
                data={
                    'tenant_id': APP_TENANT,
                    'channel_id': APP_CHANNEL,
                    'name': 'Hebron TV Complete Channel Demo',
                    'description': 'Liquid-Glass Hebron TV channel bug, Breaking News, Flash News, Ticker, and News Crawl safe-zone layout',
                    'resolution': '1080p',
                    'layout_json': json.dumps(hebron_layout),
                    'is_default': False,
                }
            )

        setting_defaults = {
            'base_playlist': str(base),
            'resolution': '1080p',
            'width': '1920',
            'height': '1080',
            'fps': '25',
            'video_bitrate': '4500k',
            'preset': 'veryfast',
            'mode': 'automatic',
        }
        for key, value in setting_defaults.items():
            record = db.setting.find_unique(
                where={'tenant_id_channel_id_key': {'tenant_id': APP_TENANT, 'channel_id': APP_CHANNEL, 'key': key}}
            )
            if not record:
                db.setting.create(
                    data={'tenant_id': APP_TENANT, 'channel_id': APP_CHANNEL, 'key': key, 'value': value}
                )

        if os.getenv('SEED_DEMO_MEDIA', '1') == '1':
            existing_media = db.media.find_many(where={'tenant_id': APP_TENANT, 'channel_id': APP_CHANNEL})
            demo_clip = ROOT / 'assets' / 'demo-nepal-playout.mp4'
            if not existing_media and demo_clip.exists():
                dest = engine.media_dir / 'demo-nepal-playout.mp4'
                if not dest.exists():
                    shutil.copy2(demo_clip, dest)
                thumb = engine.media_dir / 'demo-nepal-playout.jpg'
                if not thumb.exists():
                    try:
                        subprocess.run(
                            [FFMPEG_BIN, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(dest), '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '4', str(thumb)],
                            capture_output=True,
                            timeout=25,
                        )
                    except (OSError, subprocess.SubprocessError):
                        pass
                duration = 10.0
                has_audio = True
                try:
                    probe = subprocess.run(
                        [FFPROBE_BIN, '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', str(dest)],
                        capture_output=True,
                        text=True,
                        timeout=25,
                    )
                    if probe.returncode == 0:
                        info = json.loads(probe.stdout)
                        duration = float(info.get('format', {}).get('duration') or 10.0)
                        has_audio = 'audio' in [s.get('codec_type') for s in info.get('streams', [])]
                except Exception:
                    pass
                m = db.media.create(
                    data={
                        'tenant_id': APP_TENANT,
                        'channel_id': APP_CHANNEL,
                        'title': 'Nepal Broadcast Demo Playout',
                        'filename': dest.name,
                        'mime': 'video/mp4',
                        'folder': 'News',
                        'category': 'video',
                        'duration': duration,
                        'size': dest.stat().st_size,
                        'width': 1920,
                        'height': 1080,
                        'codec': 'h264',
                        'has_audio': has_audio,
                    }
                )
                db.playlistitem.create(
                    data={
                        'tenant_id': APP_TENANT,
                        'channel_id': APP_CHANNEL,
                        'playlist_id': base,
                        'media_id': m.id,
                        'position': 0,
                    }
                )

        # Seed default enterprise Live Input feeds if none exist
        existing_inputs = db.inputstream.find_many(where={'tenant_id': APP_TENANT, 'channel_id': APP_CHANNEL})
        if not existing_inputs:
            db.inputstream.create(
                data={
                    'tenant_id': APP_TENANT,
                    'channel_id': APP_CHANNEL,
                    'name': 'Studio A — Primary Live Camera Feed',
                    'source_type': 'studio_input',
                    'protocol': 'rtmp',
                    'url': 'rtmp://ingest.kashtrix.local:1935/live/studio_a',
                    'backup_url': 'rtmp://ingest.kashtrix.local:1935/live/studio_a_backup',
                    'latency_ms': 250,
                    'buffer_ms': 1000,
                    'auto_fallback': True,
                    'enabled': True,
                    'is_live': False,
                }
            )
            db.inputstream.create(
                data={
                    'tenant_id': APP_TENANT,
                    'channel_id': APP_CHANNEL,
                    'name': 'Remote OB Van — Field Reporter Link',
                    'source_type': 'live_input',
                    'protocol': 'srt',
                    'url': 'srt://ingest.kashtrix.local:9000?mode=listener&latency=250',
                    'latency_ms': 250,
                    'stream_mode': 'listener',
                    'buffer_ms': 800,
                    'auto_fallback': True,
                    'enabled': True,
                    'is_live': False,
                }
            )

        seed_plans(db, APP_TENANT, APP_CHANNEL)


@asynccontextmanager
async def lifespan(app):
    global _main_loop
    _main_loop = asyncio.get_running_loop()
    seed()
    engine.ensure_mediamtx()
    engine.tick()
    scheduler_service.start()
    try:
        yield
    finally:
        scheduler_service.shutdown()
        engine.close()
        disconnect_db()


app = FastAPI(title='Kashtrix Broadcast Suite • Prisma MySQL Edition', version='2.0', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allow_headers=['Authorization', 'Content-Type'],
)


class Credentials(BaseModel):
    username: str = 'admin'
    password: str


class Command(BaseModel):
    action: str
    media_id: int | None = None
    position_sec: float | None = None


class SettingsUpdate(BaseModel):
    values: dict[str, str]


class Reorder(BaseModel):
    playlist_id: int
    ids: list[int]


class UserInput(BaseModel):
    username: str
    password: str
    role: str = 'editor'


class TenantPlan(BaseModel):
    plan: str
    reason: str | None = 'Demo plan selection'


class FeatureValidationInput(BaseModel):
    feature: str
    context: dict | None = None


@app.get('/api/health')
def health():
    return {
        'ok': True,
        'version': '2.0',
        'orm': 'prisma',
        'scheduler': 'apscheduler',
        'database': 'mysql',
        'engine': engine.status['state'],
        'dry_run': DRY_RUN,
    }


@app.get('/api/system/hardware')
def system_hardware():
    return get_hardware_info()


@app.get('/api/system/fonts')
def system_fonts():
    return get_available_fonts()


@app.post('/api/login')
def login(c: Credentials, db: Prisma = Depends(get_db)):
    u = db.user.find_first(where={'tenant_id': APP_TENANT, 'username': c.username})
    if not u or not u.enabled or not check_password(c.password, u.password_hash):
        raise HTTPException(401, 'Invalid credentials')
    token = secrets.token_urlsafe(36)
    db.sessiontoken.create(
        data={
            'token_hash': hashlib.sha256(token.encode()).hexdigest(),
            'user_id': u.id,
            'expires': int(time.time()) + SESSIONS,
        }
    )
    audit(db, u, 'login', 'control room')
    return {'token': token, 'expires_in': SESSIONS, 'user': {'id': u.id, 'username': u.username, 'role': u.role}}


@app.post('/api/logout')
def logout(req: Request, user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    token = req.headers.get('Authorization', '').replace('Bearer ', '')
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db.sessiontoken.delete_many(where={'token_hash': token_hash})
    return {'ok': True}


@app.get('/api/me')
def me(user: User = Depends(current_user)):
    return {'id': user.id, 'username': user.username, 'role': user.role, 'tenant_id': user.tenant_id}


# --- Subscription Plans & Entitlements Endpoints ---

@app.get('/api/plans')
@app.get('/api/subscriptions/plans')
def list_plans(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    return get_plan_catalog(db)


@app.get('/api/subscriptions/current')
def current_subscription(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    return get_tenant_subscription(db, user.tenant_id, APP_CHANNEL)


@app.get('/api/subscriptions/entitlements')
def plan_entitlements(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    return get_tenant_entitlements(db, user.tenant_id)


@app.get('/api/subscriptions/usage')
def subscription_usage(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    return compute_resource_usage(db, user.tenant_id, APP_CHANNEL)


@app.post('/api/subscriptions/validate')
def validate_subscription_feature(
    body: FeatureValidationInput,
    user: User = Depends(current_user),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    return validate_feature_or_limit(db, user.tenant_id, APP_CHANNEL, body.feature, body.context)


async def _apply_plan_change(body: TenantPlan, user: User, db: Prisma) -> dict:
    ensure_instance(user)
    sub_info = activate_or_change_plan(
        db,
        user.tenant_id,
        APP_CHANNEL,
        body.plan,
        user_id=user.id,
        reason=body.reason or 'Demo plan activation',
    )
    audit(db, user, 'change plan', f"{sub_info.get('old_plan_id')} -> {body.plan}")
    # Re-evaluate music & programme auto-CG entitlements and sync CG/relays without restarting the main programme encoder
    engine.evaluate_music_cg_at_position(db, engine.current_media, float(engine.status.get('position_sec') or 0), emit_events=False)
    engine.evaluate_programme_cg(db, emit_events=False)
    engine.sync_cg(db)
    engine.sync_relays(db)
    await notify('subscription.changed', {'plan': body.plan, 'subscription': sub_info})
    await notify('entitlements.updated', sub_info['entitlements'])
    return {
        'ok': True,
        'plan': body.plan,
        'price_npr': sub_info['price_npr'],
        'max_outputs': sub_info['max_outputs'],
        'storage_quota_gb': sub_info['storage_gb'],
        'subscription': sub_info,
    }


@app.post('/api/subscriptions/activate')
async def activate_subscription(body: TenantPlan, user: User = Depends(require('admin')), db: Prisma = Depends(get_db)):
    return await _apply_plan_change(body, user, db)


@app.put('/api/subscriptions/change')
async def change_subscription(body: TenantPlan, user: User = Depends(require('admin')), db: Prisma = Depends(get_db)):
    return await _apply_plan_change(body, user, db)


@app.put('/api/tenant/plan')
async def tenant_plan(body: TenantPlan, user: User = Depends(require('admin')), db: Prisma = Depends(get_db)):
    return await _apply_plan_change(body, user, db)


@app.get('/api/embed-config')
def embed_config(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    ent = get_tenant_entitlements(db, user.tenant_id)
    if not ent['embed_player']:
        raise HTTPException(
            403,
            f"Website HTML embed player is not included in the {ent['plan_name']} plan. Upgrade to Digital 360 or higher.",
        )
    return {
        'enabled': True,
        'hls_url': '/hls/channel1/index.m3u8',
        'embed_url': '/embed.html',
        'iframe_code': '<iframe src="/embed.html" width="100%" height="450" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>',
    }


# --- Music Metadata CMS & Automatic Music Now Playing CG Endpoints (Graphics Automation Pro) ---

@app.get('/api/music/metadata')
def list_music_metadata(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    rows = db.musicmetadata.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
    return [object_dict(r) for r in rows]


@app.get('/api/music/metadata/{media_id}')
def get_music_metadata(media_id: int, user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    scoped(db, Media, media_id, user)
    row = db.musicmetadata.find_unique(where={'media_id': int(media_id)})
    return object_dict(row) if row else {'media_id': int(media_id)}


@app.put('/api/music/metadata/{media_id}')
async def upsert_music_metadata(
    media_id: int,
    req: Request,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_music_cg_allowed(db, user.tenant_id)
    media = scoped(db, Media, media_id, user)
    body = await req.json()

    if body.get('category') == 'music' or body.get('mark_as_music', True):
        db.media.update(where={'id': media.id}, data={'category': 'music'})

    allowed_str = {
        'song_title', 'artist', 'album', 'music_director', 'composer',
        'lyricist', 'record_label', 'release_year', 'genre', 'language',
        'copyright_credit', 'template_key', 'animation',
    }
    allowed_int = {'start_delay_sec', 'start_duration_sec', 'end_lead_sec', 'end_duration_sec', 'template_id'}
    data = {}
    for k in allowed_str:
        if k in body and body[k] is not None:
            data[k] = str(body[k])[:250] if k != 'copyright_credit' else str(body[k])[:1500]
    for k in allowed_int:
        if k in body:
            data[k] = int(body[k]) if body[k] not in (None, '') else None
    if 'override_enabled' in body:
        data['override_enabled'] = bool(body['override_enabled'])
    if 'custom_fields' in body and isinstance(body['custom_fields'], dict):
        data['custom_fields_json'] = json.dumps(body['custom_fields'])
    elif 'custom_fields_json' in body and body['custom_fields_json'] is not None:
        data['custom_fields_json'] = str(body['custom_fields_json'])

    rec = db.musicmetadata.upsert(
        where={'media_id': int(media_id)},
        data={
            'create': {
                'tenant_id': user.tenant_id,
                'channel_id': APP_CHANNEL,
                'media_id': int(media_id),
                'song_title': data.get('song_title') or media.title,
                **{k: v for k, v in data.items() if k != 'song_title'},
            },
            'update': {
                **data,
                'updated_at': utcnow(),
            },
        },
    )
    audit(db, user, 'update music metadata', f"media #{media_id}: {rec.song_title or media.title}")
    out = object_dict(rec)
    await notify('music.metadata.updated', out)
    return out


@app.post('/api/music/metadata/bulk')
async def bulk_music_metadata(
    req: Request,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_music_cg_allowed(db, user.tenant_id)
    body = await req.json()
    items = body.get('items', [])
    if not isinstance(items, list):
        raise HTTPException(422, 'items must be a list')
    updated = []
    for entry in items:
        mid = entry.get('media_id')
        if not mid:
            continue
        media = scoped(db, Media, int(mid), user)
        db.media.update(where={'id': media.id}, data={'category': 'music'})
        rec = db.musicmetadata.upsert(
            where={'media_id': int(mid)},
            data={
                'create': {
                    'tenant_id': user.tenant_id,
                    'channel_id': APP_CHANNEL,
                    'media_id': int(mid),
                    'song_title': str(entry.get('song_title') or media.title)[:250],
                    'artist': str(entry.get('artist') or '')[:250],
                    'album': str(entry.get('album') or '')[:250],
                    'music_director': str(entry.get('music_director') or '')[:200],
                    'composer': str(entry.get('composer') or '')[:200],
                    'lyricist': str(entry.get('lyricist') or '')[:200],
                    'record_label': str(entry.get('record_label') or '')[:200],
                    'release_year': str(entry.get('release_year') or '')[:20],
                    'genre': str(entry.get('genre') or '')[:100],
                    'language': str(entry.get('language') or 'Nepali')[:80],
                },
                'update': {
                    'song_title': str(entry.get('song_title') or media.title)[:250],
                    'artist': str(entry.get('artist') or '')[:250],
                    'album': str(entry.get('album') or '')[:250],
                    'music_director': str(entry.get('music_director') or '')[:200],
                    'composer': str(entry.get('composer') or '')[:200],
                    'lyricist': str(entry.get('lyricist') or '')[:200],
                    'record_label': str(entry.get('record_label') or '')[:200],
                    'release_year': str(entry.get('release_year') or '')[:20],
                    'genre': str(entry.get('genre') or '')[:100],
                    'language': str(entry.get('language') or 'Nepali')[:80],
                    'updated_at': utcnow(),
                },
            },
        )
        updated.append(object_dict(rec))
    audit(db, user, 'bulk music metadata', f'{len(updated)} tracks updated')
    await notify('music.metadata.updated', {'count': len(updated), 'items': updated})
    return {'ok': True, 'updated': len(updated), 'count': len(updated), 'items': updated}


@app.get('/api/music/cg-settings')
def get_music_cg_settings(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    m_cfg, _ = _ensure_music_and_programme_settings(db, user.tenant_id, APP_CHANNEL)
    return object_dict(m_cfg)


@app.put('/api/music/cg-settings')
async def update_music_cg_settings(
    req: Request,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_music_cg_allowed(db, user.tenant_id)
    _ensure_music_and_programme_settings(db, user.tenant_id, APP_CHANNEL)
    body = await req.json()
    bool_keys = {'enabled', 'show_at_start', 'show_before_end'}
    int_keys = {
        'start_delay_sec', 'start_duration_sec', 'end_lead_sec',
        'end_duration_sec', 'template_id', 'position_x', 'position_y',
        'width', 'height',
    }
    str_keys = {'template_key', 'text_color', 'bg_color', 'accent_color', 'gradient', 'animation'}
    update_data = {'updated_at': utcnow()}
    for k in bool_keys:
        if k in body:
            update_data[k] = bool(body[k])
    for k in int_keys:
        if k in body and body[k] is not None:
            update_data[k] = int(body[k])
    for k in str_keys:
        if k in body and body[k] is not None:
            update_data[k] = str(body[k])
    if 'opacity' in body and body['opacity'] is not None:
        update_data['opacity'] = float(body['opacity'])
    if 'visible_fields' in body and isinstance(body['visible_fields'], list):
        update_data['visible_fields_json'] = json.dumps(body['visible_fields'])
    elif 'visible_fields_json' in body and body['visible_fields_json'] is not None:
        update_data['visible_fields_json'] = str(body['visible_fields_json'])

    updated = db.channelmusiccgsetting.update(
        where={'tenant_id_channel_id': {'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL}},
        data=update_data,
    )
    audit(db, user, 'update music cg settings', f"delay={updated.start_delay_sec}s end_lead={updated.end_lead_sec}s")
    out = object_dict(updated)
    await notify('music.cg.preview', out)
    return out


@app.post('/api/music/cg-preview')
async def preview_music_cg(
    req: Request,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_music_cg_allowed(db, user.tenant_id)
    try:
        body = await req.json()
    except Exception:
        body = {}
    media_id = body.get('media_id') or engine.current_media
    media = db.media.find_unique(where={'id': int(media_id)}) if media_id else None
    meta = db.musicmetadata.find_unique(where={'media_id': int(media_id)}) if media_id else None
    m_cfg, _ = _ensure_music_and_programme_settings(db, user.tenant_id, APP_CHANNEL)
    headline, subtext = format_music_now_playing(media, meta, m_cfg)
    preview_payload = {
        'media_id': media.id if media else None,
        'headline': headline,
        'subtext': subtext,
        'preview': {'text': headline, 'subtext': subtext},
        'template_key': m_cfg.template_key,
        'settings': object_dict(m_cfg),
    }
    await notify('music.cg.preview', preview_payload)
    return preview_payload


@app.post('/api/music/cg-evaluate')
async def evaluate_music_cg_endpoint(
    req: Request,
    user: User = Depends(require('operator')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_music_cg_allowed(db, user.tenant_id)
    body = await req.json()
    media_id = int(body['media_id']) if body.get('media_id') is not None else engine.current_media
    pos = float(body.get('position_sec', 0.0))
    if body.get('reset_run'):
        engine.seek(pos)
    res = engine.evaluate_music_cg_at_position(db, media_id, pos, emit_events=False)
    engine.sync_cg(db)
    if res['active']:
        await notify('music.cg.activated', res)
    else:
        await notify('music.cg.deactivated', res)
    return res


# --- Automatic Programme Now / Next CG Endpoints (Graphics Automation Pro) ---

@app.get('/api/programme/cg-settings')
def get_programme_cg_settings(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    _, p_cfg = _ensure_music_and_programme_settings(db, user.tenant_id, APP_CHANNEL)
    return object_dict(p_cfg)


@app.put('/api/programme/cg-settings')
async def update_programme_cg_settings(
    req: Request,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_programme_cg_allowed(db, user.tenant_id)
    _ensure_music_and_programme_settings(db, user.tenant_id, APP_CHANNEL)
    body = await req.json()
    bool_keys = {'enabled', 'show_at_start', 'show_before_end', 'show_title', 'show_category', 'show_time', 'show_next'}
    int_keys = {'start_delay_sec', 'start_duration_sec', 'end_lead_sec', 'end_duration_sec', 'template_id', 'position_x', 'position_y', 'width', 'height'}
    str_keys = {'template_key', 'animation'}
    update_data = {'updated_at': utcnow()}
    for k in bool_keys:
        if k in body:
            update_data[k] = bool(body[k])
    for k in int_keys:
        if k in body and body[k] is not None:
            update_data[k] = int(body[k])
    for k in str_keys:
        if k in body and body[k] is not None:
            update_data[k] = str(body[k])
    if 'eligible_categories' in body and isinstance(body['eligible_categories'], list):
        update_data['eligible_categories_json'] = json.dumps(body['eligible_categories'])
    elif 'eligible_categories_json' in body and body['eligible_categories_json'] is not None:
        update_data['eligible_categories_json'] = str(body['eligible_categories_json'])
    if 'eligible_schedule_ids' in body:
        if isinstance(body['eligible_schedule_ids'], list):
            update_data['eligible_schedule_ids'] = json.dumps([int(x) for x in body['eligible_schedule_ids']])
        else:
            update_data['eligible_schedule_ids'] = str(body['eligible_schedule_ids'])

    updated = db.programmecgsetting.update(
        where={'tenant_id_channel_id': {'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL}},
        data=update_data,
    )
    audit(db, user, 'update programme cg settings', updated.template_key)
    out = object_dict(updated)
    await notify('cg.updated', out)
    return out


@app.post('/api/programme/cg-evaluate')
async def evaluate_programme_cg_endpoint(
    req: Request,
    user: User = Depends(require('operator')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_programme_cg_allowed(db, user.tenant_id)
    try:
        body = await req.json()
    except Exception:
        body = {}
    elapsed = float(body['elapsed_sec']) if body.get('elapsed_sec') is not None else None
    res = engine.evaluate_programme_cg(db, elapsed_override_sec=elapsed, emit_events=False)
    engine.sync_cg(db)
    if res['active']:
        await notify('program.cg.activated', res)
    else:
        await notify('program.cg.deactivated', res)
    return res


# --- Visual CG Studio: Preview vs. On-Air TAKE/CUT, Layout Presets & Template Versions ---

@app.get('/api/cg/render-state/{tenant_id}/{channel_id}')
def get_cg_render_state(tenant_id: int, channel_id: int, db: Prisma = Depends(get_db)):
    layers = engine.effective_layers(db)
    contents = db.cgcontent.find_many(where={'tenant_id': tenant_id})
    return {
        'cg': layers,
        'cg_content': [object_dict(c) for c in contents],
        'server_time': datetime.now(engine.get_tz(db)).isoformat(),
    }


@app.get('/api/cg/preview')
def list_cg_previews(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    rows = db.cgpreviewstate.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
    return [object_dict(r) for r in rows]


@app.put('/api/cg/preview/{layer_id}')
async def save_cg_preview(
    layer_id: int,
    req: Request,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    """
    Save CG edits in the isolated Preview State WITHOUT modifying the live On-Air CG layer or FFmpeg output.
    Live output remains unchanged until operator presses TAKE.
    """
    ensure_instance(user)
    assert_visual_designer_allowed(db, user.tenant_id)
    layer = scoped(db, CG, layer_id, user)
    assert_cg_category_allowed(db, user.tenant_id, layer.category)
    body = await req.json()

    style_fields = {
        k: body[k]
        for k in (
            'color', 'bg_color', 'text_color', 'gradient', 'font_family',
            'font_size', 'font_weight', 'text_align', 'opacity',
            'border_radius', 'border_width', 'border_color', 'shadow',
            'safe_anchor', 'priority', 'speed', 'animation',
            'enter_transition', 'exit_transition', 'anim_duration_ms',
            'image_media_id', 'locked', 'hidden',
        )
        if k in body
    }

    prev = db.cgpreviewstate.upsert(
        where={
            'tenant_id_channel_id_layer_id': {
                'tenant_id': user.tenant_id,
                'channel_id': APP_CHANNEL,
                'layer_id': int(layer_id),
            }
        },
        data={
            'create': {
                'tenant_id': user.tenant_id,
                'channel_id': APP_CHANNEL,
                'layer_id': int(layer_id),
                'template_id': int(body['template_id']) if body.get('template_id') else layer.template_id,
                'title': str(body.get('name') or body.get('title') or layer.name)[:200],
                'text': str(body['text']) if 'text' in body else (layer.text or ''),
                'subtext': str(body['subtext']) if 'subtext' in body else (layer.subtext or ''),
                'position_x': int(body['position_x']) if 'position_x' in body and body['position_x'] is not None else int(layer.position_x or 40),
                'position_y': int(body['position_y']) if 'position_y' in body and body['position_y'] is not None else int(layer.position_y or 820),
                'width': int(body['width']) if 'width' in body and body['width'] is not None else int(layer.width or 680),
                'height': int(body['height']) if 'height' in body and body['height'] is not None else int(layer.height or 130),
                'z_index': int(body['z_index']) if 'z_index' in body and body['z_index'] is not None else int(layer.z_index or 10),
                'style_json': json.dumps(style_fields),
                'updated_by': user.id,
            },
            'update': {
                'template_id': int(body['template_id']) if body.get('template_id') else layer.template_id,
                'title': str(body.get('name') or body.get('title') or layer.name)[:200],
                'text': str(body['text']) if 'text' in body else (layer.text or ''),
                'subtext': str(body['subtext']) if 'subtext' in body else (layer.subtext or ''),
                'position_x': int(body['position_x']) if 'position_x' in body and body['position_x'] is not None else int(layer.position_x or 40),
                'position_y': int(body['position_y']) if 'position_y' in body and body['position_y'] is not None else int(layer.position_y or 820),
                'width': int(body['width']) if 'width' in body and body['width'] is not None else int(layer.width or 680),
                'height': int(body['height']) if 'height' in body and body['height'] is not None else int(layer.height or 130),
                'z_index': int(body['z_index']) if 'z_index' in body and body['z_index'] is not None else int(layer.z_index or 10),
                'style_json': json.dumps(style_fields),
                'updated_by': user.id,
                'updated_at': utcnow(),
            },
        },
    )
    out = object_dict(prev)
    await notify('cg.preview.updated', out)
    return out


@app.post('/api/cg/{layer_id}/take')
async def take_cg_layer_on_air(
    layer_id: int,
    req: Request,
    user: User = Depends(require('operator')),
    db: Prisma = Depends(get_db),
):
    """Promote the approved Preview state (or incoming payload) to the live On-Air Programme output."""
    ensure_instance(user)
    assert_visual_designer_allowed(db, user.tenant_id)
    layer = scoped(db, CG, layer_id, user)
    assert_cg_category_allowed(db, user.tenant_id, layer.category)
    try:
        body = await req.json()
    except Exception:
        body = {}

    preview = db.cgpreviewstate.find_unique(
        where={
            'tenant_id_channel_id_layer_id': {
                'tenant_id': user.tenant_id,
                'channel_id': APP_CHANNEL,
                'layer_id': int(layer_id),
            }
        }
    )
    update_data = {'active': True, 'updated_at': utcnow()}
    if preview:
        update_data.update(
            {
                'text': preview.text if preview.text is not None else layer.text,
                'subtext': preview.subtext if preview.subtext is not None else layer.subtext,
                'position_x': preview.position_x,
                'position_y': preview.position_y,
                'width': preview.width,
                'height': preview.height,
                'z_index': preview.z_index,
                'template_id': preview.template_id or layer.template_id,
            }
        )
        try:
            st = json.loads(preview.style_json or '{}')
            for k in (
                'color', 'bg_color', 'text_color', 'gradient', 'font_family',
                'font_size', 'font_weight', 'text_align', 'opacity',
                'border_radius', 'border_width', 'border_color', 'shadow',
                'safe_anchor', 'priority', 'speed', 'animation',
                'enter_transition', 'exit_transition', 'anim_duration_ms',
            ):
                if k in st and st[k] is not None:
                    update_data[k] = st[k]
        except Exception:
            pass

    # Allow body overrides on TAKE as well
    for k in (
        'text', 'subtext', 'position_x', 'position_y', 'width', 'height',
        'color', 'bg_color', 'text_color', 'gradient', 'font_family',
        'font_size', 'font_weight', 'text_align', 'opacity',
        'border_radius', 'border_width', 'border_color', 'z_index',
        'speed', 'animation', 'start_offset_sec', 'duration_sec',
        'content_id', 'image_media_id', 'style_json',
    ):
        if k in body and body[k] is not None:
            update_data[k] = int(body[k]) if k in INT_FIELDS else (float(body[k]) if k in FLOAT_FIELDS else body[k])

    updated = db.cg.update(where={'id': int(layer_id)}, data=update_data)
    if getattr(updated, 'duration_sec', 0):
        scheduler_service.schedule_cg_auto_cut(int(layer_id), int(updated.duration_sec))
    engine.sync_cg(db)
    compute_resource_usage(db, user.tenant_id, APP_CHANNEL)
    audit(db, user, 'cg take on air', f"{updated.name} ({updated.category})")
    out = object_dict(updated)
    await notify('cg.activated', out)
    return {**out, 'ok': True, 'layer': out}


@app.post('/api/cg/{layer_id}/cut')
async def cut_cg_layer_off_air(
    layer_id: int,
    user: User = Depends(require('operator')),
    db: Prisma = Depends(get_db),
):
    """Immediately CUT a CG layer off air."""
    ensure_instance(user)
    scoped(db, CG, layer_id, user)
    updated = db.cg.update(where={'id': int(layer_id)}, data={'active': False, 'updated_at': utcnow()})
    scheduler_service.schedule_cg_auto_cut(int(layer_id), 0)
    engine.sync_cg(db)
    compute_resource_usage(db, user.tenant_id, APP_CHANNEL)
    audit(db, user, 'cg cut off air', f"{updated.name} ({updated.category})")
    out = object_dict(updated)
    await notify('cg.deactivated', out)
    return {**out, 'ok': True, 'layer': out}


@app.post('/api/cg/{layer_id}/duplicate')
async def duplicate_cg_layer(
    layer_id: int,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_visual_designer_allowed(db, user.tenant_id)
    src = scoped(db, CG, layer_id, user)
    dup = db.cg.create(
        data={
            'tenant_id': user.tenant_id,
            'channel_id': APP_CHANNEL,
            'name': f"{src.name} (Copy)",
            'category': src.category,
            'text': src.text,
            'subtext': src.subtext,
            'active': False,
            'image_media_id': src.image_media_id,
            'speed': src.speed,
            'color': src.color,
            'bg_color': src.bg_color,
            'text_color': src.text_color,
            'gradient': src.gradient,
            'font_family': src.font_family,
            'font_size': src.font_size,
            'font_weight': src.font_weight,
            'text_align': src.text_align,
            'template_id': src.template_id,
            'animation': src.animation,
            'position_x': min(1760, int(src.position_x or 48) + 24),
            'position_y': max(24, int(src.position_y or 800) - 24),
            'width': src.width,
            'height': src.height,
            'z_index': int(src.z_index or 10) + 1,
            'opacity': src.opacity,
            'border_radius': src.border_radius,
            'border_width': src.border_width,
            'border_color': src.border_color,
            'shadow': src.shadow,
            'safe_anchor': src.safe_anchor,
            'priority': src.priority,
        }
    )
    audit(db, user, 'duplicate cg layer', dup.name)
    out = object_dict(dup)
    await notify('cg.layout.updated', out)
    return out


@app.post('/api/cg/layout/reset')
async def reset_cg_layout(
    req: Request,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    try:
        body = await req.json()
    except Exception:
        body = {}
    target_layer_id = body.get('layer_id')
    defaults_map = {
        cat: (px, py, w, h, prio, color)
        for (_, cat, _, _, _, color, px, py, w, h, prio) in DEFAULT_20_CG_LAYERS
    }
    layers = db.cg.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
    reset_ids = []
    for l in layers:
        if target_layer_id and l.id != int(target_layer_id):
            continue
        if l.category in defaults_map:
            px, py, w, h, prio, color = defaults_map[l.category]
            db.cg.update(
                where={'id': l.id},
                data={
                    'position_x': px,
                    'position_y': py,
                    'width': w,
                    'height': h,
                    'priority': prio,
                    'color': color,
                    'locked': False,
                    'hidden': False,
                    'updated_at': utcnow(),
                },
            )
            db.cgpreviewstate.delete_many(
                where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL, 'layer_id': l.id}
            )
            reset_ids.append(l.id)
    engine.sync_cg(db)
    audit(db, user, 'reset cg layout', f'{len(reset_ids)} layers')
    await notify('cg.layout.updated', {'reset_ids': reset_ids})
    return {'ok': True, 'reset_ids': reset_ids}


@app.get('/api/cg/layout-presets')
def list_cg_layout_presets(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    rows = db.cglayoutpreset.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
    return [object_dict(r) for r in rows]


@app.post('/api/cg/layout-presets')
async def create_cg_layout_preset(
    req: Request,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_visual_designer_allowed(db, user.tenant_id)
    body = await req.json()
    name = str(body.get('name') or 'Custom Layout Preset')[:150]
    layers = db.cg.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
    layout_data = body.get('layout') or [
        {
            'id': l.id,
            'category': l.category,
            'position_x': l.position_x,
            'position_y': l.position_y,
            'width': l.width,
            'height': l.height,
            'z_index': l.z_index,
            'priority': l.priority,
        }
        for l in layers
    ]
    preset = db.cglayoutpreset.create(
        data={
            'tenant_id': user.tenant_id,
            'channel_id': APP_CHANNEL,
            'name': name,
            'description': str(body.get('description') or 'Saved from 1920x1080 Visual CG Studio')[:250],
            'resolution': str(body.get('resolution') or '1080p')[:20],
            'layout_json': json.dumps(layout_data),
            'is_default': False,
        }
    )
    audit(db, user, 'save cg layout preset', name)
    out = object_dict(preset)
    await notify('cg.layout.updated', out)
    return out


@app.post('/api/cg/layout-presets/{preset_id}/apply')
async def apply_cg_layout_preset(
    preset_id: int,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    assert_visual_designer_allowed(db, user.tenant_id)
    preset = scoped(db, CGLayoutPreset, preset_id, user)
    try:
        items = json.loads(preset.layout_json or '[]')
    except Exception:
        items = []
    by_cat = {x.get('category'): x for x in items if x.get('category')}
    layers = db.cg.find_many(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL})
    for l in layers:
        spec = by_cat.get(l.category)
        if spec:
            db.cg.update(
                where={'id': l.id},
                data={
                    'position_x': int(spec.get('position_x', l.position_x or 0)),
                    'position_y': int(spec.get('position_y', l.position_y or 0)),
                    'width': int(spec.get('width', l.width or 680)),
                    'height': int(spec.get('height', l.height or 130)),
                    'priority': int(spec.get('priority', l.priority or 50)),
                    'updated_at': utcnow(),
                },
            )
    engine.sync_cg(db)
    audit(db, user, 'apply cg layout preset', preset.name)
    await notify('cg.layout.updated', {'preset_id': preset.id, 'name': preset.name})
    return {'ok': True, 'preset_id': preset.id}


@app.post('/api/cg-templates/{template_id}/save-as')
async def save_as_new_cg_template(
    template_id: int,
    req: Request,
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    src = scoped(db, CGTemplate, template_id, user)
    assert_custom_template_allowed(db, user.tenant_id, src.category)
    body = await req.json()
    new_name = str(body.get('name') or f"{src.name} (Custom)")[:150]
    created = db.cgtemplate.create(
        data={
            'tenant_id': user.tenant_id,
            'channel_id': APP_CHANNEL,
            'template_key': f"custom_{uuid.uuid4().hex[:8]}",
            'name': new_name,
            'category': str(body.get('category') or src.category),
            'animation': str(body.get('animation') or src.animation or 'slide'),
            'accent': str(body.get('accent') or src.accent or '#e11d72'),
            'bg_color': str(body.get('bg_color') or src.bg_color or '#150d29'),
            'text_color': str(body.get('text_color') or src.text_color or '#ffffff'),
            'gradient': str(body.get('gradient') if 'gradient' in body else (src.gradient or '')),
            'font_family': str(body.get('font_family') or src.font_family or 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif'),
            'font_size': int(body.get('font_size') or src.font_size or 32),
            'font_weight': str(body.get('font_weight') or src.font_weight or '700'),
            'text_align': str(body.get('text_align') or src.text_align or 'left'),
            'position_x': int(body.get('position_x') if body.get('position_x') is not None else (src.position_x or 40)),
            'position_y': int(body.get('position_y') if body.get('position_y') is not None else (src.position_y or 820)),
            'width': int(body.get('width') or src.width or 680),
            'height': int(body.get('height') or src.height or 130),
            'z_index': int(body.get('z_index') or src.z_index or 10),
            'opacity': float(body.get('opacity') if body.get('opacity') is not None else (src.opacity or 0.95)),
            'border_radius': int(body.get('border_radius') if body.get('border_radius') is not None else (src.border_radius or 12)),
            'border_width': int(body.get('border_width') if body.get('border_width') is not None else (src.border_width or 2)),
            'border_color': str(body.get('border_color') or src.border_color or '#e11d72'),
            'shadow': str(body.get('shadow') or src.shadow or '0 12px 32px rgba(0,0,0,0.55)'),
            'zone': str(body.get('zone') or src.zone or 'auto'),
            'priority': int(body.get('priority') or src.priority or 50),
            'speed': int(body.get('speed') or src.speed or 100),
            'enter_transition': str(body.get('enter_transition') or src.enter_transition or 'slide-left'),
            'exit_transition': str(body.get('exit_transition') or src.exit_transition or 'fade-out'),
            'anim_duration_ms': int(body.get('anim_duration_ms') or src.anim_duration_ms or 450),
            'sample_text': str(body.get('sample_text') if 'sample_text' in body else (src.sample_text or '')),
            'sample_subtext': str(body.get('sample_subtext') if 'sample_subtext' in body else (src.sample_subtext or '')),
            'style_json': str(body.get('style_json') if 'style_json' in body else (src.style_json or '')),
            'enabled': True,
        }
    )
    out = object_dict(created)
    db.cgtemplateversion.create(
        data={
            'tenant_id': user.tenant_id,
            'channel_id': APP_CHANNEL,
            'template_id': created.id,
            'version': 1,
            'name': created.name,
            'snapshot_json': json.dumps(out),
            'created_by': user.id,
        }
    )
    audit(db, user, 'save as new cg template', created.name)
    await notify('cg.template.updated', out)
    return out


@app.get('/api/users')
def users(user: User = Depends(require('admin')), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    return [
        {k: v for k, v in object_dict(u).items() if k != 'password_hash'}
        for u in db.user.find_many(where={'tenant_id': user.tenant_id})
    ]


@app.post('/api/users')
def create_user(body: UserInput, user: User = Depends(require('admin')), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    if body.role not in ('viewer', 'editor', 'operator', 'admin'):
        raise HTTPException(422, 'Invalid user role')
    if user.role != 'superadmin' and body.role == 'admin':
        raise HTTPException(403, 'Superadmin required to grant admin')
    if db.user.find_first(where={'tenant_id': user.tenant_id, 'username': body.username}):
        raise HTTPException(409, 'Username exists')
    try:
        password = hash_password(body.password)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    new = db.user.create(
        data={
            'tenant_id': user.tenant_id,
            'username': body.username,
            'password_hash': password,
            'role': body.role,
            'enabled': True,
        }
    )
    audit(db, user, 'create user', body.username)
    return {'id': new.id}


DEMO_CMS_ITEMS = [
    {
        'title': 'AP1-Style News Ticker with Channel Logo',
        'category': 'ticker',
        'text': '<img src="/cgdemo/hebron/Liquid-glass%20HEBRON%20TV%20logo.png" alt="Logo" style="height:26px;vertical-align:middle;margin:0 10px;" /> <b style="color:#facc15;">LIVE UPDATES:</b> Parliament session resumes at 2 PM <img src="/cgdemo/hebron/Liquid-glass%20HEBRON%20TV%20logo.png" alt="Logo" style="height:24px;vertical-align:middle;margin:0 10px;" /> <b style="color:#38bdf8;">MARKET:</b> NEPSE climbs 24.6 points in morning trade <img src="/cgdemo/hebron/Liquid-glass%20HEBRON%20TV%20logo.png" alt="Logo" style="height:24px;vertical-align:middle;margin:0 10px;" /> <b style="color:#4ade80;">WEATHER:</b> Clear skies across Kathmandu Valley today',
        'subtext': 'HEBRON / AP1 STYLE TICKER',
        'status': 'published',
    },
    {
        'title': 'Breaking News — National Infrastructure Summit',
        'category': 'breaking',
        'text': '<b style="color:#fde047;">BREAKING:</b> National Energy & Digital Highway Agreement Signed in Kathmandu Today',
        'subtext': 'LIVE COVERAGE • SPECIAL CORRESPONDENT REPORT',
        'status': 'published',
    },
    {
        'title': 'Flash News — Urgent Weather & Aviation Advisory',
        'category': 'flash',
        'text': '<b style="color:#ffffff;">FLASH NEWS:</b> Domestic flights resume normal schedule across Pokhara and Biratnagar airports',
        'subtext': 'CIVIL AVIATION DESK • VERIFIED',
        'status': 'approved',
    },
    {
        'title': '24/7 Headlines Crawl',
        'category': 'crawl',
        'text': '◆ TOP STORY: 24/7 Cloud Playout & Broadcast Automation Live ◆ SPORTS: National Football Camp Begins in Lalitpur ◆ TECH: Local Startups Expand Regional Cloud Hubs',
        'subtext': 'HEADLINES CRAWL',
        'status': 'published',
    },
    {
        'title': 'Anchor & Guest Lower Third',
        'category': 'lower_third',
        'text': 'Ramesh Adhikari — Senior Broadcast Analyst',
        'subtext': 'LIVE FROM KATHMANDU STUDIO',
        'status': 'published',
    },
    {
        'title': 'Prime Time Top Headline',
        'category': 'headline',
        'text': 'Economic Growth Forecast Revised Upward for Current Fiscal Year',
        'subtext': 'PRIME NEWS BULLETIN',
        'status': 'approved',
    },
    {
        'title': 'Live Update — Traffic & Weather',
        'category': 'update',
        'text': 'Kathmandu Valley Temperature 22°C • Clear Visibility • Ring Road Traffic Smooth',
        'subtext': 'LIVE DESK UPDATE',
        'status': 'published',
    },
    {
        'title': 'Hebron TV Breaking Bulletin',
        'category': 'hebron_breaking',
        'text': '<img src="/cgdemo/hebron/Liquid-glass%20HEBRON%20TV%20logo.png" alt="Hebron TV" style="height:28px;vertical-align:middle;margin-right:10px;" /> <b style="color:#fef08a;">HEBRON EXCLUSIVE:</b> Community Broadcast Network Expands HD Satellite & Streaming Coverage',
        'subtext': 'HEBRON TV NEWSROOM • LIVE',
        'status': 'published',
    },
    {
        'title': 'Hebron TV Flash Dispatch',
        'category': 'hebron_flash',
        'text': '<b style="color:#ffffff;">HEBRON FLASH:</b> Special Evening Faith & Community Dialogue Tonight at 8:00 PM NPT',
        'subtext': 'HEBRON TV PROGRAMME DESK',
        'status': 'published',
    },
    {
        'title': 'Hebron TV Ticker with Logo',
        'category': 'hebron_ticker',
        'text': '<img src="/cgdemo/hebron/Liquid-glass%20HEBRON%20TV%20logo.png" alt="Hebron TV" style="height:24px;vertical-align:middle;margin:0 10px;" /> <b>HEBRON TV:</b> Light in the Town — 24/7 Live HD Broadcast <img src="/cgdemo/hebron/Liquid-glass%20HEBRON%20TV%20logo.png" alt="Hebron TV" style="height:24px;vertical-align:middle;margin:0 10px;" /> Watch Live on YouTube, Web & Cable',
        'subtext': 'HEBRON TV LIVE',
        'status': 'published',
    },
]


def seed_demo_cms_content(db: Prisma, tenant_id: int, channel_id: int = APP_CHANNEL) -> int:
    existing = db.cgcontent.find_many(where={'tenant_id': tenant_id, 'channel_id': channel_id})
    existing_titles = {c.title for c in existing}
    added = 0
    for item in DEMO_CMS_ITEMS:
        if item['title'] in existing_titles:
            continue
        db.cgcontent.create(
            data={
                'tenant_id': tenant_id,
                'channel_id': channel_id,
                'title': item['title'],
                'category': item['category'],
                'text': item['text'],
                'subtext': item['subtext'],
                'status': item['status'],
            }
        )
        added += 1
    return added


@app.post('/api/cms/seed-demo')
async def api_seed_demo_cms(user: User = Depends(require('editor')), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    added = seed_demo_cms_content(db, user.tenant_id, APP_CHANNEL)
    audit(db, user, 'seed demo cms', str(added))
    await notify('cg.updated', {'seeded_cms': added})
    return {'ok': True, 'added': added}


@app.get('/api/bootstrap')
def bootstrap(user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    if db.cgcontent.count(where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL}) == 0:
        seed_demo_cms_content(db, user.tenant_id, APP_CHANNEL)
    return snapshot(db, user)


@app.websocket('/ws')
async def websocket(ws: WebSocket):
    signature = hashlib.sha256(ws.query_params.get('token', '').encode()).hexdigest()
    with SessionLocal() as db:
        s = db.sessiontoken.find_unique(where={'token_hash': signature})
        u = db.user.find_unique(where={'id': s.user_id}) if s and s.user_id and s.expires > time.time() else None
        if not u or not u.enabled or u.tenant_id != APP_TENANT:
            await ws.close(code=1008)
            return
        user_id = u.id
        tenant_id = u.tenant_id
    await ws.accept()
    ws.state.user_id = user_id
    ws.state.tenant_id = tenant_id
    client_ws.add(ws)
    try:
        with SessionLocal() as db:
            u = db.user.find_unique(where={'id': user_id})
            if u:
                await ws.send_json({'type': 'state', 'data': snapshot(db, u)})
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        client_ws.discard(ws)


@app.post('/api/control')
async def control(body: Command, user: User = Depends(require('operator')), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    if body.action == 'seek':
        engine.seek(float(body.position_sec or 0.0))
        engine.evaluate_music_cg_at_position(db, engine.current_media, float(body.position_sec or 0.0), emit_events=True)
        engine.sync_cg(db)
        audit(db, user, 'seek', f"{body.position_sec}s")
        await notify('playout.status', engine.status.copy())
        return {'ok': True, 'engine': engine.status}
    if body.action == 'seek_delta':
        cur = float(engine.status.get('position_sec') or 0.0)
        new_pos = max(0.0, cur + float(body.position_sec or 0.0))
        engine.seek(new_pos)
        engine.evaluate_music_cg_at_position(db, engine.current_media, new_pos, emit_events=True)
        engine.sync_cg(db)
        audit(db, user, 'seek delta', f"{new_pos:.1f}s")
        await notify('playout.status', engine.status.copy())
        return {'ok': True, 'engine': engine.status}
    if body.action == 'take' and body.media_id is not None:
        scoped(db, Media, body.media_id, user)
    if body.action == 'take_input' and body.media_id is not None:
        assert_input_stream_allowed(db, user.tenant_id, APP_CHANNEL, int(body.media_id))
        inp = scoped(db, InputStream, body.media_id, user)
        db.inputstream.update_many(
            where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL},
            data={'is_live': False},
        )
        db.inputstream.update(where={'id': inp.id}, data={'is_live': True})
    if body.action in ('stop_input', 'auto', 'start', 'stop', 'next', 'prev'):
        db.inputstream.update_many(
            where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL},
            data={'is_live': False},
        )
    try:
        engine.control(body.action, body.media_id)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    audit(db, user, 'control', body.action)
    engine.tick()
    await notify('playout.status', engine.status.copy())
    return {'ok': True, 'engine': engine.status}


@app.post('/api/inputs/{item_id}/take')
async def take_live_input_to_air(item_id: int, user: User = Depends(require('operator')), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    assert_input_stream_allowed(db, user.tenant_id, APP_CHANNEL, item_id)
    inp = scoped(db, InputStream, item_id, user)
    db.inputstream.update_many(
        where={'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL},
        data={'is_live': False},
    )
    updated = db.inputstream.update(where={'id': inp.id}, data={'is_live': True, 'enabled': True})
    engine.control('take_input', inp.id)
    engine.tick()
    audit(db, user, 'take live input', inp.name)
    out = object_dict(updated)
    await notify('input.live', out)
    await notify('playout.status', engine.status.copy())
    return {'ok': True, 'input': out, 'engine': engine.status}


@app.post('/api/inputs/{item_id}/stop')
async def stop_live_input_feed(item_id: int, user: User = Depends(require('operator')), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    inp = scoped(db, InputStream, item_id, user)
    updated = db.inputstream.update(where={'id': inp.id}, data={'is_live': False})
    if engine.live_input_id == inp.id:
        engine.control('stop_input')
        engine.tick()
    audit(db, user, 'stop live input', inp.name)
    out = object_dict(updated)
    await notify('input.stopped', out)
    await notify('playout.status', engine.status.copy())
    return {'ok': True, 'input': out, 'engine': engine.status}


@app.post('/api/settings')
async def setting_update(body: SettingsUpdate, user: User = Depends(require('admin')), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    ent = get_tenant_entitlements(db, user.tenant_id)
    settings = body.values
    allowed_keys = {'base_playlist', 'resolution', 'fps', 'video_bitrate', 'preset', 'audio_bitrate', 'keyint_sec', 'rate_control', 'timezone', 'master_volume', 'stream_volume', 'scan_mode'}
    if not set(settings).issubset(allowed_keys):
        raise HTTPException(422, 'Unsupported settings fields')
    if 'scan_mode' in settings and settings['scan_mode'] not in ('progressive', 'interlaced'):
        raise HTTPException(422, 'Scan mode must be progressive or interlaced')
    if 'master_volume' in settings:
        try:
            mv = int(settings['master_volume'])
        except (ValueError, TypeError):
            raise HTTPException(422, 'Master volume must be 0–200')
        if mv < 0 or mv > 200:
            raise HTTPException(422, 'Master volume must be 0–200')
        settings = {**settings, 'master_volume': str(mv)}
    if 'stream_volume' in settings:
        raw_sv = str(settings['stream_volume'] or '').strip()
        if raw_sv != '':
            try:
                sv = int(raw_sv)
            except (ValueError, TypeError):
                raise HTTPException(422, 'Stream volume must be 0–200')
            if sv < 0 or sv > 200:
                raise HTTPException(422, 'Stream volume must be 0–200')
            settings = {**settings, 'stream_volume': str(sv)}
        else:
            settings = {**settings, 'stream_volume': ''}
    if 'timezone' in settings:
        tz_val = str(settings['timezone'] or '').strip()
        try:
            ZoneInfo(tz_val)
        except Exception:
            raise HTTPException(422, f'Invalid timezone: {tz_val}')
        settings = {**settings, 'timezone': tz_val}
    if 'resolution' in settings:
        if settings['resolution'] not in PRESETS:
            raise HTTPException(422, 'Resolution must be 360p/480p/720p/1080p')
        if settings['resolution'] not in (ent.get('resolutions') or list(PRESETS)):
            raise HTTPException(403, f"Resolution {settings['resolution']} is not included in {ent['plan_name']}")
    if 'fps' in settings and settings['fps'] not in ('24', '25', '30'):
        raise HTTPException(422, 'FPS must be 24, 25 or 30')
    if 'preset' in settings and settings['preset'] not in ('ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'):
        raise HTTPException(422, 'Invalid CPU preset')
    if 'audio_bitrate' in settings and settings['audio_bitrate'] not in ('96k', '128k', '192k', '256k'):
        raise HTTPException(422, 'Audio bitrate must be 96k, 128k, 192k or 256k')
    if 'keyint_sec' in settings and str(settings['keyint_sec']) not in ('1', '2', '3', '4'):
        raise HTTPException(422, 'Keyframe interval must be 1–4 seconds')
    if 'rate_control' in settings and settings['rate_control'] not in ('cbr', 'vbr'):
        raise HTTPException(422, 'Rate control must be cbr or vbr')
    if 'video_bitrate' in settings:
        if not re.fullmatch(r'[0-9]{3,4}k', settings['video_bitrate']):
            raise HTTPException(422, 'Bitrate must be 500k–9000k')
        kbps = int(settings['video_bitrate'].rstrip('k'))
        max_kbps = int(ent.get('max_bitrate_kbps') or 9000)
        if kbps < 500 or kbps > max_kbps:
            raise HTTPException(403, f"Bitrate {settings['video_bitrate']} exceeds {ent['plan_name']} limit (500k–{max_kbps}k). Upgrade plan for higher bitrates.")
    if 'base_playlist' in settings:
        scoped(db, Playlist, int(settings['base_playlist']), user)
    if 'resolution' in settings:
        w, h = PRESETS[settings['resolution']]
        settings = {**settings, 'width': str(w), 'height': str(h)}
    for key, value in settings.items():
        upsert_setting(db, user.tenant_id, APP_CHANNEL, key, str(value))
    if 'timezone' in settings:
        scheduler_service.restore_schedules()
    audit(db, user, 'encoder settings', json.dumps(settings))
    only_stream_vol = set(settings.keys()) == {'stream_volume'}
    if only_stream_vol:
        engine.sync_relays(db)
    else:
        if set(settings.keys()).issubset({'master_volume', 'stream_volume'}) and engine.running and engine.current_media:
            engine.resume_at_sec = max(0.0, time.monotonic() - engine.media_started + engine.seek_offset_sec)
        engine.request_restart = True
    await notify('playout.status', engine.status.copy())
    return {'ok': True}


@app.post('/api/media/upload')
async def upload(
    file: UploadFile = File(...),
    folder: str = Form('General'),
    category: str = Form(''),
    song_title: str = Form(''),
    artist: str = Form(''),
    album: str = Form(''),
    user: User = Depends(require('editor')),
    db: Prisma = Depends(get_db),
):
    ensure_instance(user)
    ext = Path(file.filename or '').suffix.lower()
    if ext not in ALLOWED_MEDIA_EXTS:
        raise HTTPException(415, f'Unsupported file type: {ext}')
    ent = get_tenant_entitlements(db, user.tenant_id)
    quota_gb = int(ent['storage_quota_gb'])
    existing_media = db.media.find_many(where={'tenant_id': user.tenant_id})
    used = sum(int(x.size or 0) for x in existing_media)
    file_path = engine.media_dir / (uuid.uuid4().hex + ext)
    total = 0
    try:
        with file_path.open('wb') as target:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD or used + total > quota_gb * 1024**3:
                    raise HTTPException(413, 'Upload or storage quota exceeded')
                target.write(chunk)
        probe = subprocess.run(
            [
                FFPROBE_BIN, '-v', 'error',
                '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height',
                '-of', 'json', str(file_path),
            ],
            capture_output=True,
            text=True,
            timeout=45,
        )
        if probe.returncode != 0:
            raise HTTPException(415, 'Invalid media file')
        details = json.loads(probe.stdout)
        stream_objs = details.get('streams', [])
        streams = [s.get('codec_type') for s in stream_objs]
        if ext in AUDIO_EXTS:
            if 'audio' not in streams:
                raise HTTPException(415, 'An audio stream is required for audio files')
        else:
            if 'video' not in streams:
                raise HTTPException(415, 'A video or image stream is required')

        video_stream = next((s for s in stream_objs if s.get('codec_type') == 'video'), {})
        audio_stream = next((s for s in stream_objs if s.get('codec_type') == 'audio'), {})
        width = int(video_stream.get('width') or 0)
        height = int(video_stream.get('height') or 0)
        codec = str(video_stream.get('codec_name') or audio_stream.get('codec_name') or '')
        inferred_cat = (
            category.strip()
            if category.strip()
            else 'image'
            if ext in IMAGE_EXTS
            else 'audio'
            if ext in AUDIO_EXTS
            else 'video'
        )
        mime_type = (
            file.content_type
            or ('image/' + ext.lstrip('.') if ext in IMAGE_EXTS else 'audio/' + ext.lstrip('.') if ext in AUDIO_EXTS else 'video/mp4')
        )
        duration = 0.0 if ext in IMAGE_EXTS else float(details.get('format', {}).get('duration') or 0)

        m = db.media.create(
            data={
                'tenant_id': user.tenant_id,
                'channel_id': APP_CHANNEL,
                'title': Path(file.filename or 'Untitled').stem[:250] if not (file.filename or '').endswith(ext) else (file.filename or 'Untitled')[:250],
                'filename': file_path.name,
                'mime': mime_type,
                'folder': (folder or 'General').strip()[:100],
                'category': inferred_cat[:40],
                'duration': duration,
                'size': total,
                'width': width,
                'height': height,
                'codec': codec[:60],
                'has_audio': 'audio' in streams,
            }
        )
        if inferred_cat == 'music' or song_title or artist or album:
            db.musicmetadata.upsert(
                where={'media_id': m.id},
                data={
                    'create': {
                        'tenant_id': user.tenant_id,
                        'channel_id': APP_CHANNEL,
                        'media_id': m.id,
                        'song_title': (song_title or m.title)[:250],
                        'artist': artist[:250],
                        'album': album[:250],
                    },
                    'update': {
                        'song_title': (song_title or m.title)[:250],
                        'artist': artist[:250],
                        'album': album[:250],
                    },
                },
            )
        if ext not in AUDIO_EXTS:
            thumb = engine.media_dir / (file_path.stem + '.jpg')
            try:
                subprocess.run(
                    [FFMPEG_BIN, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(file_path), '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '4', str(thumb)],
                    capture_output=True,
                    timeout=25,
                )
            except (OSError, subprocess.TimeoutExpired):
                pass
        compute_resource_usage(db, user.tenant_id, APP_CHANNEL)
        audit(db, user, 'upload media', file.filename)
        media_dict = object_dict(m)
        await notify('media.uploaded', media_dict)
        return {'id': m.id, 'duration': m.duration, 'size': total, 'media': media_dict}
    except Exception:
        file_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@app.get('/api/media/file/{media_id}')
def media_file(media_id: int, user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    m = scoped(db, Media, media_id, user)
    return FileResponse(engine.media_dir / m.filename, media_type=m.mime or 'application/octet-stream')


@app.get('/api/media/thumb/{media_id}')
def media_thumbnail(media_id: int, user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    m = scoped(db, Media, media_id, user)
    thumb = engine.media_dir / (Path(m.filename).stem + '.jpg')
    if not thumb.exists():
        raise HTTPException(404, 'Thumbnail not available')
    return FileResponse(thumb, media_type='image/jpeg')


@app.post('/api/playlist-items/reorder')
async def reorder(body: Reorder, user: User = Depends(require('operator')), db: Prisma = Depends(get_db)):
    scoped(db, Playlist, body.playlist_id, user)
    current = db.playlistitem.find_many(
        where={'tenant_id': user.tenant_id, 'playlist_id': body.playlist_id}
    )
    if len(current) != len(body.ids) or {i.id for i in current} != set(body.ids):
        raise HTTPException(422, 'All playlist items must be included once')
    for pos, item_id in enumerate(body.ids):
        db.playlistitem.update(where={'id': item_id}, data={'position': pos})
    audit(db, user, 'reorder playlist', body.playlist_id)
    if not engine.current_media:
        engine.request_restart = True
    await notify('playlist.updated', {'playlist_id': body.playlist_id, 'ids': body.ids})
    return {'ok': True}


@app.post('/api/schedules/{item_id}/pause')
async def pause_schedule_endpoint(item_id: int, user: User = Depends(require('operator')), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    scoped(db, Schedule, item_id, user)
    data = scheduler_service.pause_schedule(item_id)
    audit(db, user, 'pause schedule', item_id)
    await notify('schedule.updated', data)
    return {'ok': True, 'schedule': data}


@app.post('/api/schedules/{item_id}/resume')
async def resume_schedule_endpoint(item_id: int, user: User = Depends(require('operator')), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    s = scoped(db, Schedule, item_id, user)
    assert_schedule_allowed(db, user.tenant_id, s.kind, s.target_id)
    data = scheduler_service.resume_schedule(item_id)
    audit(db, user, 'resume schedule', item_id)
    await notify('schedule.updated', data)
    return {'ok': True, 'schedule': data}


@app.get('/api/{resource}')
def list_resource(resource: str, user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    if resource not in RESOURCES:
        raise HTTPException(404)
    return resource_list(db, resource, user)


def payload(resource: str, body: dict, db: Prisma, user: User, is_new: bool = True, item_id: int | None = None) -> dict:
    data = {k: v for k, v in body.items() if k in FIELDS[resource]}
    if is_new and not REQUIRED[resource].issubset(data):
        raise HTTPException(422, 'Missing ' + ', '.join(sorted(REQUIRED[resource] - set(data))))
    if resource in ('cg', 'cg_content', 'cg_templates'):
        if 'category' in data and data['category'] not in CATEGORIES:
            raise HTTPException(422, 'Invalid CG category')
        if len(str(data.get('text') or '')) > 2500:
            raise HTTPException(422, 'Text too long')
        if 'animation' in data and data['animation'] not in VALID_ANIMATIONS:
            raise HTTPException(422, 'Invalid CG animation')
        if 'speed' in data and data['speed'] is not None and not 10 <= int(data['speed']) <= 250:
            raise HTTPException(422, 'CG speed 10–250')

    # Centralized subscription plan entitlement checks
    if resource == 'cg':
        cat = data.get('category') or body.get('category')
        if cat and (is_new or bool(data.get('active', body.get('active')))):
            assert_cg_category_allowed(db, user.tenant_id, cat)
    if resource == 'cg_content':
        if 'status' in data and data['status'] not in ('draft', 'approved', 'published', 'live', 'archived'):
            raise HTTPException(422, 'Invalid editorial status')
        assert_cms_allowed(db, user.tenant_id, data.get('category'), data.get('status'))
    if resource == 'cg_templates':
        assert_custom_template_allowed(db, user.tenant_id, data.get('category'))
    if resource == 'playlist_items':
        if 'playlist_id' in data and data['playlist_id'] is not None:
            scoped(db, Playlist, int(data['playlist_id']), user)
        if 'media_id' in data and data['media_id'] is not None:
            scoped(db, Media, int(data['media_id']), user)
    if resource == 'schedules':
        if 'kind' in data and data['kind'] not in ('media', 'playlist', 'cg', 'cg_content'):
            raise HTTPException(422, 'Invalid scheduled target')
        if 'repeat' in data and data['repeat'] not in ('none', 'daily', 'weekly'):
            raise HTTPException(422, 'Invalid repeat')
        if 'duration_sec' in data and data['duration_sec'] is not None and not 1 <= int(data['duration_sec']) <= 604800:
            raise HTTPException(422, 'Invalid duration')
        if 'starts_at' in data:
            try:
                datetime.fromisoformat(str(data['starts_at']).replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                raise HTTPException(422, 'Invalid ISO timestamp')
        kind = data.get('kind') or body.get('kind')
        target = data.get('target_id') or body.get('target_id')
        if kind and target:
            model = {'media': Media, 'playlist': Playlist, 'cg': CG, 'cg_content': CGContent}.get(kind)
            if model:
                scoped(db, model, int(target), user)
            assert_schedule_allowed(db, user.tenant_id, kind, int(target))
    if resource == 'cg' and 'image_media_id' in data and data['image_media_id'] is not None:
        scoped(db, Media, int(data['image_media_id']), user)
    if resource == 'outputs':
        if 'protocol' in data or 'url' in data:
            proto = data.get('protocol', body.get('protocol'))
            url = data.get('url', body.get('url', ''))
            p = urlparse(url)
            good = {
                'rtmp': ('rtmp', 'rtmps'),
                'youtube': ('rtmp', 'rtmps'),
                'facebook': ('rtmp', 'rtmps'),
                'srt': ('srt',),
                'udp': ('udp',),
                'hls': ('http', 'https'),
            }
            if proto not in good or p.scheme not in good[proto] or not p.hostname:
                raise HTTPException(422, 'Invalid output protocol/URL')
            try:
                ip = ipaddress.ip_address(p.hostname)
                if not ip.is_global and os.getenv('ALLOW_PRIVATE_OUTPUTS', '0') != '1':
                    raise HTTPException(422, 'Private/loopback remote IP prohibited unless ALLOW_PRIVATE_OUTPUTS=1')
            except ValueError:
                pass
            if p.hostname.lower() in ('localhost', 'host.docker.internal') and proto != 'hls':
                raise HTTPException(422, 'Local destinations not permitted')
            enabling = bool(data.get('enabled', body.get('enabled', False)))
            assert_output_allowed(
                db,
                user.tenant_id,
                APP_CHANNEL,
                proto,
                url,
                enabling=enabling,
                output_id=item_id,
            )
        if 'config_json' in data and data['config_json']:
            try:
                cfg = json.loads(data['config_json']) if isinstance(data['config_json'], str) else dict(data['config_json'])
            except (ValueError, TypeError):
                raise HTTPException(422, 'Invalid output encoding configuration JSON')
            if cfg.get('custom_encoding'):
                ent = get_tenant_entitlements(db, user.tenant_id)
                if not ent.get('custom_output_encoding'):
                    raise HTTPException(403, f"Per-destination custom encoding requires News Pro or higher (current plan: {ent['plan_name']}).")
                br = str(cfg.get('video_bitrate') or '4500k').lower().strip()
                if not re.fullmatch(r'[0-9]{3,4}k', br) or int(br.rstrip('k')) < 500:
                    raise HTTPException(422, 'Custom output bitrate must be 500k–9000k')
                if int(br.rstrip('k')) > int(ent.get('max_bitrate_kbps') or 9000):
                    raise HTTPException(403, f"Custom output bitrate {br} exceeds {ent['plan_name']} limit ({ent['max_bitrate_kbps']}k).")
            data['config_json'] = json.dumps(cfg)
    if resource == 'inputs':
        assert_input_stream_allowed(db, user.tenant_id, APP_CHANNEL, input_id=item_id)
        proto = data.get('protocol', body.get('protocol', 'rtmp'))
        if proto not in ('rtmp', 'srt', 'udp', 'hls'):
            raise HTTPException(422, 'Input protocol must be rtmp, srt, udp, or hls')

    for k in list(data.keys()):
        if k in BOOL_FIELDS and data[k] is not None:
            data[k] = bool(data[k])
        elif k in INT_FIELDS and data[k] is not None:
            data[k] = int(data[k])
        elif k in FLOAT_FIELDS and data[k] is not None:
            data[k] = float(data[k])
    return data


@app.post('/api/{resource}')
async def create_resource(resource: str, req: Request, user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    if resource not in FIELDS or resource == 'media':
        raise HTTPException(404)
    if roles.get(user.role or '', 0) < roles[PERMS[resource]]:
        raise HTTPException(403, 'Insufficient role')
    incoming = await req.json()
    fields = payload(resource, incoming, db, user, is_new=True)
    obj = delegate(db, RESOURCES[resource]).create(
        data={**fields, 'tenant_id': user.tenant_id, 'channel_id': APP_CHANNEL}
    )
    compute_resource_usage(db, user.tenant_id, APP_CHANNEL)
    audit(db, user, 'created ' + resource, obj.id)

    ws_event = None
    if resource == 'schedules':
        sm = str(incoming.get('switch_mode') or 'hard_cut').strip().lower()
        if sm not in ('hard_cut', 'after_current'):
            sm = 'hard_cut'
        upsert_setting(db, user.tenant_id, APP_CHANNEL, f'schedule_mode_{obj.id}', sm)
        scheduler_service.sync_schedule(obj.id)
        ws_event = 'schedule.created'
    elif resource in ('playlists', 'playlist_items'):
        if not engine.current_media:
            engine.request_restart = True
        ws_event = 'playlist.updated'
    elif resource == 'cg_templates':
        engine.sync_cg(db)
        ws_event = 'cg.template.updated'
    elif resource in ('cg', 'cg_content'):
        engine.sync_cg(db)
        ws_event = 'cg.updated'
    elif resource == 'outputs':
        engine.sync_relays(db)
        ws_event = 'stream.status'

    await notify(ws_event, object_dict(obj))
    return {'id': obj.id}


@app.put('/api/{resource}/{item_id}')
async def update_resource(resource: str, item_id: int, req: Request, user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    if resource not in FIELDS:
        raise HTTPException(404)
    if roles.get(user.role or '', 0) < roles[PERMS[resource]]:
        raise HTTPException(403)
    obj = scoped(db, RESOURCES[resource], item_id, user)
    incoming = await req.json()
    if resource == 'outputs' and (not incoming.get('url') or '••••' in incoming.get('url', '')):
        incoming['url'] = obj.url
    merged = {**object_dict(obj), **incoming}
    fields = payload(resource, merged, db, user, is_new=False, item_id=item_id)
    update_data = {k: fields[k] for k in incoming if k in fields}
    if resource in ('cg', 'cg_content'):
        update_data['updated_at'] = utcnow()
    updated_obj = obj
    if update_data:
        updated_obj = delegate(db, RESOURCES[resource]).update(where={'id': item_id}, data=update_data)
    compute_resource_usage(db, user.tenant_id, APP_CHANNEL)
    audit(db, user, 'updated ' + resource, item_id)

    ws_event = None
    if resource == 'schedules':
        if 'switch_mode' in incoming:
            sm = str(incoming.get('switch_mode') or 'hard_cut').strip().lower()
            if sm not in ('hard_cut', 'after_current'):
                sm = 'hard_cut'
            upsert_setting(db, user.tenant_id, APP_CHANNEL, f'schedule_mode_{item_id}', sm)
        scheduler_service.sync_schedule(item_id)
        ws_event = 'schedule.updated'
    elif resource in ('playlists', 'playlist_items'):
        if not engine.current_media:
            engine.request_restart = True
        ws_event = 'playlist.updated'
    elif resource == 'cg':
        engine.sync_cg(db)
        if 'active' in update_data:
            ws_event = 'cg.activated' if update_data['active'] else 'cg.deactivated'
            if update_data['active'] and getattr(updated_obj, 'duration_sec', 0):
                scheduler_service.schedule_cg_auto_cut(item_id, updated_obj.duration_sec)
        elif any(k in update_data for k in ('position_x', 'position_y', 'width', 'height', 'z_index', 'priority')):
            ws_event = 'cg.layout.updated'
        else:
            ws_event = 'cg.updated'
    elif resource == 'cg_templates':
        existing_vers = db.cgtemplateversion.find_many(where={'template_id': item_id})
        db.cgtemplateversion.create(
            data={
                'tenant_id': user.tenant_id,
                'channel_id': APP_CHANNEL,
                'template_id': item_id,
                'version': len(existing_vers) + 1,
                'name': updated_obj.name,
                'snapshot_json': json.dumps(object_dict(updated_obj)),
                'created_by': user.id,
            }
        )
        engine.sync_cg(db)
        ws_event = 'cg.template.updated'
    elif resource == 'cg_content':
        engine.sync_cg(db)
        ws_event = 'cg.updated'
    elif resource == 'outputs':
        engine.sync_relays(db)
        ws_event = 'stream.status'

    await notify(ws_event, object_dict(updated_obj))
    return {'ok': True}


@app.delete('/api/{resource}/{item_id}')
async def delete_resource(resource: str, item_id: int, user: User = Depends(current_user), db: Prisma = Depends(get_db)):
    ensure_instance(user)
    if resource not in RESOURCES:
        raise HTTPException(404)
    if roles.get(user.role or '', 0) < roles[PERMS[resource]]:
        raise HTTPException(403)
    obj = scoped(db, RESOURCES[resource], item_id, user)
    if resource == 'media':
        if db.cg.find_first(where={'tenant_id': user.tenant_id, 'image_media_id': item_id}):
            raise HTTPException(409, 'This image is in use by a graphics layer')
        if db.playlistitem.find_first(where={'tenant_id': user.tenant_id, 'media_id': item_id}):
            raise HTTPException(409, 'Media used by playlist')
        db.musicmetadata.delete_many(where={'media_id': item_id})
        (engine.media_dir / obj.filename).unlink(missing_ok=True)
        (engine.media_dir / (Path(obj.filename).stem + '.jpg')).unlink(missing_ok=True)
    if resource == 'playlists':
        if str(item_id) == settings_map(db, user.tenant_id).get('base_playlist'):
            raise HTTPException(409, 'Change fallback playlist before deleting this one')
        db.playlistitem.delete_many(where={'playlist_id': item_id})
    if resource == 'schedules':
        scheduler_service.remove_schedule(item_id)
    delegate(db, RESOURCES[resource]).delete(where={'id': item_id})
    compute_resource_usage(db, user.tenant_id, APP_CHANNEL)
    audit(db, user, 'deleted ' + resource, item_id)
    if resource == 'outputs':
        engine.sync_relays(db)
    await notify()
    return {'ok': True}


@app.get('/hls/{subpath:path}')
async def hls_proxy(subpath: str, req: Request):
    qs = req.url.query
    url = f'{HLS_ORIGIN}/{subpath}' + (f'?{qs}' if qs else '')
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            r = await client.get(url)
            return Response(
                content=r.content,
                status_code=r.status_code,
                media_type=r.headers.get('content-type', 'application/vnd.apple.mpegurl'),
                headers={'Access-Control-Allow-Origin': '*'},
            )
    except httpx.HTTPError:
        raise HTTPException(502, 'Cloud Media Origin not reachable')


# Mount cgdemo assets (fonts, PNG sequences, scrolling backgrounds) for React CG Overlay components
from fastapi.staticfiles import StaticFiles
CGDEMO_DIR = Path(__file__).resolve().parent.parent / 'cgdemo'
if CGDEMO_DIR.exists():
    app.mount('/cgdemo', StaticFiles(directory=str(CGDEMO_DIR)), name='cgdemo')

# Built React SPA in single-service deployment
DIST = Path(__file__).resolve().parent.parent / 'frontend' / 'dist'
if DIST.exists():
    app.mount('/assets', StaticFiles(directory=str(DIST / 'assets')), name='assets')

    @app.get('/')
    def index():
        return FileResponse(DIST / 'index.html')

    @app.get('/embed.html')
    def embed_player(db: Prisma = Depends(get_db)):
        ent = get_tenant_entitlements(db, APP_TENANT)
        if not ent['embed_player']:
            return HTMLResponse(
                content=f"<html><body style='background:#0a0c16;color:#fff;font-family:sans-serif;display:grid;place-items:center;height:100vh'><div><h2>Website Embed Locked</h2><p>Current plan ({ent['plan_name']}) does not include the HTML website embed player. Upgrade to Digital 360 or higher.</p></div></body></html>",
                status_code=403,
            )
        return FileResponse(DIST / 'embed.html')

    @app.get('/{path:path}')
    def spa(path: str):
        if path.startswith(('api/', 'ws', 'hls/', 'cgdemo/')):
            raise HTTPException(404)
        return FileResponse(DIST / 'index.html')
