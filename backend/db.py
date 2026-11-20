"""Prisma ORM database layer for MySQL (Kashtrix Broadcast Suite v2)."""
import os
import subprocess
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse
import pymysql
from dotenv import load_dotenv
from prisma import Prisma
from prisma.models import (
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
    CGTemplate,
    CGTemplateVersion,
    CGLayoutPreset,
    CGPreviewState,
    CGContent,
    CG,
    Schedule,
    Output,
    InputStream,
    Setting,
    Audit,
)

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / 'prisma' / 'schema.prisma'
load_dotenv(ROOT / '.env', override=False)


def normalize_prisma_url(raw_url: str | None = None) -> str:
    url = raw_url or os.environ.get('PRISMA_DATABASE_URL') or os.environ.get('DATABASE_URL') or ''
    if not url or url.startswith('sqlite'):
        url = os.environ.get('MYSQL_TEST_URL', 'mysql://root:@127.0.0.1:3306/kashtrix')
    if url.startswith('mysql+pymysql://'):
        url = 'mysql://' + url[len('mysql+pymysql://'):]
    if '?' in url:
        url = url.split('?', 1)[0]
    return url


PRISMA_DATABASE_URL = normalize_prisma_url()
os.environ['PRISMA_DATABASE_URL'] = PRISMA_DATABASE_URL
os.environ.setdefault('DATABASE_URL', PRISMA_DATABASE_URL)

RELATIONS = {'users', 'channels', 'tenant', 'sessions', 'playlist_items', 'items', 'playlist', 'media', 'user'}

DELEGATE_MAP = {
    Tenant: 'tenant',
    SubscriptionPlan: 'subscriptionplan',
    PlanEntitlement: 'planentitlement',
    TenantSubscription: 'tenantsubscription',
    SubscriptionHistory: 'subscriptionhistory',
    ResourceUsage: 'resourceusage',
    User: 'user',
    SessionToken: 'sessiontoken',
    Channel: 'channel',
    Media: 'media',
    MusicMetadata: 'musicmetadata',
    ChannelMusicCGSetting: 'channelmusiccgsetting',
    ProgrammeCGSetting: 'programmecgsetting',
    Playlist: 'playlist',
    PlaylistItem: 'playlistitem',
    CGTemplate: 'cgtemplate',
    CGTemplateVersion: 'cgtemplateversion',
    CGLayoutPreset: 'cglayoutpreset',
    CGPreviewState: 'cgpreviewstate',
    CGContent: 'cgcontent',
    CG: 'cg',
    Schedule: 'schedule',
    Output: 'output',
    InputStream: 'inputstream',
    Setting: 'setting',
    Audit: 'audit',
    'tenants': 'tenant',
    'subscription_plans': 'subscriptionplan',
    'plan_entitlements': 'planentitlement',
    'tenant_subscriptions': 'tenantsubscription',
    'subscription_history': 'subscriptionhistory',
    'resource_usage': 'resourceusage',
    'users': 'user',
    'sessions': 'sessiontoken',
    'channels': 'channel',
    'media': 'media',
    'music_metadata': 'musicmetadata',
    'channel_music_cg_settings': 'channelmusiccgsetting',
    'programme_cg_settings': 'programmecgsetting',
    'playlists': 'playlist',
    'playlist_items': 'playlistitem',
    'cg_templates': 'cgtemplate',
    'cg_template_versions': 'cgtemplateversion',
    'cg_layout_presets': 'cglayoutpreset',
    'cg_preview_states': 'cgpreviewstate',
    'cg_content': 'cgcontent',
    'cg': 'cg',
    'schedules': 'schedule',
    'outputs': 'output',
    'inputs': 'inputstream',
    'input_streams': 'inputstream',
    'settings': 'setting',
    'audit': 'audit',
}

_lock = threading.Lock()
_initialized_urls: set[str] = set()
prisma_client: Prisma | None = None
_active_url: str | None = None


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def object_dict(obj) -> dict:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        d = {k: v for k, v in obj.items() if k not in RELATIONS}
    elif hasattr(obj, 'model_dump'):
        d = {k: v for k, v in obj.model_dump().items() if k not in RELATIONS}
    else:
        d = {k: getattr(obj, k) for k in dir(obj) if not k.startswith('_') and k not in RELATIONS}
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.replace(tzinfo=None).isoformat()
    return d


def delegate(db: Prisma, model_or_key):
    attr = DELEGATE_MAP.get(model_or_key, model_or_key)
    return getattr(db, attr)


def ensure_mysql_schema(url: str):
    if url in _initialized_urls:
        return
    parsed = urlparse(url)
    host = parsed.hostname or '127.0.0.1'
    port = parsed.port or 3306
    user = unquote(parsed.username) if parsed.username else 'root'
    password = unquote(parsed.password) if parsed.password else ''
    dbname = (parsed.path or '/kashtrix').lstrip('/') or 'kashtrix'

    conn = pymysql.connect(host=host, port=port, user=user, password=password, autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            cur.execute(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=%s AND table_name IN ('tenants', 'subscription_plans', 'music_metadata', 'cg_preview_states', 'input_streams');",
                (dbname,),
            )
            has_tables = (cur.fetchone() or [0])[0] >= 5
    finally:
        conn.close()

    if not has_tables:
        env = os.environ.copy()
        env['PRISMA_DATABASE_URL'] = url
        scripts_dir = str(Path(sys.executable).resolve().parent / 'Scripts')
        user_scripts = str(Path.home() / 'AppData' / 'Roaming' / 'Python' / f'Python{sys.version_info.major}{sys.version_info.minor}' / 'Scripts')
        env['PATH'] = f"{user_scripts}{os.pathsep}{scripts_dir}{os.pathsep}{env.get('PATH', '')}"
        subprocess.run(
            [sys.executable, '-m', 'prisma', 'db', 'push', f'--schema={SCHEMA_PATH}', '--skip-generate', '--accept-data-loss'],
            env=env,
            check=True,
            capture_output=True,
            text=True,
        )
    _initialized_urls.add(url)


def connect_db() -> Prisma:
    global prisma_client, _active_url
    target_url = normalize_prisma_url()
    with _lock:
        ensure_mysql_schema(target_url)
        if prisma_client is not None and _active_url != target_url:
            if prisma_client.is_connected():
                prisma_client.disconnect()
            prisma_client = None
        if prisma_client is None:
            prisma_client = Prisma(datasource={'url': target_url})
            _active_url = target_url
        if not prisma_client.is_connected():
            prisma_client.connect()
        return prisma_client


def disconnect_db():
    global prisma_client
    with _lock:
        if prisma_client is not None and prisma_client.is_connected():
            prisma_client.disconnect()


class SessionLocal:
    def __init__(self):
        self.db: Prisma | None = None

    def __enter__(self) -> Prisma:
        self.db = connect_db()
        return self.db

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False


def get_db():
    db = connect_db()
    yield db
