"""Centralized Subscription Plans & Entitlement Enforcement Service (Kashtrix Broadcast Suite)."""
import json
from fastapi import HTTPException
from prisma import Prisma
from db import utcnow, object_dict

STANDARD_14_CG_CATEGORIES = [
    'logo', 'sponsor', 'ticker', 'crawl', 'lower_third', 'name_strap',
    'breaking', 'flash', 'update', 'clock', 'quote', 'now_next', 'headline', 'promo',
    'flash_premium', 'breaking_full', 'breaking_split', 'breaking_3win',
    'weather_map', 'logo_anim', 'live_anim',
    'hebron_logo', 'hebron_breaking', 'hebron_flash', 'hebron_crawl', 'hebron_ticker',
]

MUSIC_PRO_EXTRA_CG_CATEGORIES = [
    'music_now', 'music_credits', 'program_info', 'sponsored_by', 'live_location', 'fullscreen_alert',
]

ALL_CG_CATEGORIES = STANDARD_14_CG_CATEGORIES + MUSIC_PRO_EXTRA_CG_CATEGORIES

PREMIUM_MUSIC_PRO_FLAGS_FALSE = {
    'music_now_playing': False,
    'music_metadata_cms': False,
    'music_auto_cg': False,
    'program_now_next_auto': False,
    'visual_cg_designer': False,
    'cg_drag_drop': False,
    'cg_preview_workflow': False,
    'custom_typography_styles': False,
    'animated_template_library': False,
    'cg_layout_presets': False,
}

PREMIUM_MUSIC_PRO_FLAGS_TRUE = {
    'music_now_playing': True,
    'music_metadata_cms': True,
    'music_auto_cg': True,
    'program_now_next_auto': True,
    'visual_cg_designer': True,
    'cg_drag_drop': True,
    'cg_preview_workflow': True,
    'custom_typography_styles': True,
    'animated_template_library': True,
    'cg_layout_presets': True,
}

PLAN_DEFINITIONS = {
    'essential': {
        'id': 'essential',
        'name': 'Essential',
        'price_npr': 15000,
        'billing_cycle': 'month',
        'vcpu': 4,
        'ram_gb': 8,
        'storage_gb': 150,
        'storage_quota_gb': 150,
        'max_outputs': 2,
        'sort_order': 1,
        'protocols': ['rtmp'],
        'protocol_labels': ['RTMP', 'RTMPS'],
        'support_tier': 'Standard online ticket support',
        'description': 'Foundational single-channel Full HD playout with automatic playlists, programme scheduling, main logo, and basic news ticker.',
        'entitlements': {
            'resolutions': ['360p', '480p', '720p', '1080p'],
            'max_outputs': 2,
            'storage_quota_gb': 150,
            'protocols': ['rtmp'],
            'rtmps_allowed': True,
            'srt_allowed': False,
            'udp_allowed': False,
            'hls_origin_output': False,
            'max_bitrate_kbps': 3500,
            'allowed_bitrates': ['1500k', '2500k', '3500k'],
            'custom_output_encoding': False,
            'youtube_integration': False,
            'facebook_integration': False,
            'embed_player': False,
            'cg_categories': ['logo', 'ticker'],
            'sponsor_overlay': False,
            'cms_enabled': False,
            'cms_level': 'none',
            'cms_workflow': False,
            'custom_templates': False,
            'video_scheduling': True,
            'cg_scheduling': False,
            'advanced_scheduling': False,
            'social_monitoring': False,
            'cg_timeline': False,
            'cg_controller': False,
            'live_input_streaming': False,
            'max_inputs': 0,
            **PREMIUM_MUSIC_PRO_FLAGS_FALSE,
            'features_list': [
                'Dedicated Cloud Playout Node: 4 vCPU, 8 GB RAM, 150 GB NVMe',
                'One Full HD programme channel (360p–1080p)',
                'Two simultaneous streaming outputs',
                'RTMP and RTMPS delivery',
                'Automatic video playlists & programme scheduling',
                'Main channel logo & basic news ticker',
                'Basic playout control (START / TAKE / NEXT / STOP)',
                'Standard online ticket support',
            ],
            'restricted_list': [
                'No advanced CG CMS or CG Timeline Editor',
                'No Live Input Streaming Ingest',
                'No sponsor overlays, SRT or UDP outputs',
                'No website HTML embed player',
                'No Music Now Playing or Visual CG Designer',
            ],
        },
    },
    'growth': {
        'id': 'growth',
        'name': 'Growth',
        'price_npr': 20000,
        'billing_cycle': 'month',
        'vcpu': 4,
        'ram_gb': 8,
        'storage_gb': 150,
        'storage_quota_gb': 150,
        'max_outputs': 3,
        'sort_order': 2,
        'protocols': ['rtmp'],
        'protocol_labels': ['RTMP', 'RTMPS'],
        'support_tier': 'Business-hour assisted support',
        'description': 'Expanded regional broadcast tier adding sponsor overlays, scrolling crawl, lower thirds, name straps, basic CMS, and CG scheduling.',
        'entitlements': {
            'resolutions': ['360p', '480p', '720p', '1080p'],
            'max_outputs': 3,
            'storage_quota_gb': 150,
            'protocols': ['rtmp'],
            'rtmps_allowed': True,
            'srt_allowed': False,
            'udp_allowed': False,
            'hls_origin_output': False,
            'max_bitrate_kbps': 4500,
            'allowed_bitrates': ['1500k', '2500k', '3500k', '4500k'],
            'custom_output_encoding': False,
            'youtube_integration': False,
            'facebook_integration': False,
            'embed_player': False,
            'cg_categories': ['logo', 'sponsor', 'ticker', 'crawl', 'lower_third', 'name_strap'],
            'sponsor_overlay': True,
            'cms_enabled': True,
            'cms_level': 'basic',
            'cms_workflow': False,
            'custom_templates': False,
            'video_scheduling': True,
            'cg_scheduling': True,
            'advanced_scheduling': False,
            'social_monitoring': False,
            'cg_timeline': False,
            'cg_controller': False,
            'live_input_streaming': False,
            'max_inputs': 0,
            **PREMIUM_MUSIC_PRO_FLAGS_FALSE,
            'features_list': [
                'Everything in Essential, plus:',
                'Dedicated Cloud Playout Node: 4 vCPU, 8 GB RAM, 150 GB NVMe',
                'Three simultaneous RTMP/RTMPS outputs',
                'Sponsor logo overlays',
                'Scrolling news / crawl',
                'Lower thirds and name straps',
                'Basic CG editor with approved CMS fields',
                'CG scheduling for permitted templates',
                'Business-hour assisted support',
            ],
            'restricted_list': [
                'No SRT or UDP outputs',
                'No Live Input Streaming or CG Timeline Editor',
                'No Breaking / Flash / Update CG straps',
                'No website HTML embed player',
                'No Music Now Playing or Visual CG Designer',
            ],
        },
    },
    'news_pro': {
        'id': 'news_pro',
        'name': 'News Pro',
        'price_npr': 25000,
        'billing_cycle': 'month',
        'vcpu': 6,
        'ram_gb': 12,
        'storage_gb': 300,
        'storage_quota_gb': 300,
        'max_outputs': 4,
        'sort_order': 3,
        'protocols': ['rtmp', 'srt', 'udp'],
        'protocol_labels': ['RTMP', 'RTMPS', 'SRT', 'UDP'],
        'support_tier': 'Extended online support',
        'description': 'Full newsroom automation with SRT/UDP delivery, Breaking/Flash/Update graphics, Nepali & English CMS workflow, and custom CG templates.',
        'entitlements': {
            'resolutions': ['360p', '480p', '720p', '1080p'],
            'max_outputs': 4,
            'storage_quota_gb': 300,
            'protocols': ['rtmp', 'srt', 'udp'],
            'rtmps_allowed': True,
            'srt_allowed': True,
            'udp_allowed': True,
            'hls_origin_output': False,
            'max_bitrate_kbps': 6000,
            'allowed_bitrates': ['1500k', '2500k', '3500k', '4500k', '5500k', '6000k'],
            'custom_output_encoding': True,
            'youtube_integration': False,
            'facebook_integration': False,
            'embed_player': False,
            'cg_categories': [
                'logo', 'sponsor', 'ticker', 'crawl', 'lower_third', 'name_strap',
                'breaking', 'flash', 'update', 'clock', 'quote', 'headline',
                'flash_premium', 'breaking_full', 'breaking_split', 'breaking_3win',
                'weather_map', 'logo_anim', 'live_anim',
                'hebron_logo', 'hebron_breaking', 'hebron_flash', 'hebron_crawl', 'hebron_ticker',
            ],
            'sponsor_overlay': True,
            'cms_enabled': True,
            'cms_level': 'full',
            'cms_workflow': True,
            'custom_templates': True,
            'video_scheduling': True,
            'cg_scheduling': True,
            'advanced_scheduling': False,
            'social_monitoring': False,
            'cg_timeline': False,
            'cg_controller': True,
            'live_input_streaming': False,
            'max_inputs': 0,
            **PREMIUM_MUSIC_PRO_FLAGS_FALSE,
            'features_list': [
                'Everything in Growth, plus:',
                'Dedicated Cloud Playout Node: 6 vCPU, 12 GB RAM, 300 GB NVMe',
                'Four simultaneous streaming destinations',
                'RTMP, RTMPS, SRT and UDP unicast delivery',
                'Breaking News, Flash News and News Updates',
                'Advanced ticker, crawl and lower-third content',
                'Realtime CG CMS editor & CG Live Controller',
                'Draft, approve, publish and TAKE workflow',
                'Custom CG templates & CG event scheduling',
                'Extended online support',
            ],
            'restricted_list': [
                'No website HTML iframe embed player',
                'No Multi-Track CG Timeline or Live Input Streaming',
                'No Music Now Playing or Visual CG Designer',
            ],
        },
    },
    'digital_360': {
        'id': 'digital_360',
        'name': 'Digital 360',
        'price_npr': 30000,
        'billing_cycle': 'month',
        'vcpu': 6,
        'ram_gb': 12,
        'storage_gb': 300,
        'storage_quota_gb': 300,
        'max_outputs': 5,
        'sort_order': 4,
        'protocols': ['rtmp', 'srt', 'udp', 'youtube', 'facebook', 'hls'],
        'protocol_labels': ['RTMP', 'RTMPS', 'SRT', 'UDP', 'YouTube Live', 'Facebook Live', 'HLS Origin'],
        'support_tier': 'Priority social and website-player support',
        'description': 'Multi-platform digital broadcaster with YouTube Live, Facebook Live, HLS origin, website iframe player, and full newsroom CG/CMS.',
        'entitlements': {
            'resolutions': ['360p', '480p', '720p', '1080p'],
            'max_outputs': 5,
            'storage_quota_gb': 300,
            'protocols': ['rtmp', 'srt', 'udp', 'youtube', 'facebook', 'hls'],
            'rtmps_allowed': True,
            'srt_allowed': True,
            'udp_allowed': True,
            'hls_origin_output': True,
            'max_bitrate_kbps': 6500,
            'allowed_bitrates': ['1500k', '2500k', '3500k', '4500k', '5500k', '6500k'],
            'custom_output_encoding': True,
            'youtube_integration': True,
            'facebook_integration': True,
            'embed_player': True,
            'cg_categories': [
                'logo', 'sponsor', 'ticker', 'crawl', 'lower_third', 'name_strap',
                'breaking', 'flash', 'update', 'clock', 'quote', 'now_next', 'headline',
                'flash_premium', 'breaking_full', 'breaking_split', 'breaking_3win',
                'weather_map', 'logo_anim', 'live_anim',
                'hebron_logo', 'hebron_breaking', 'hebron_flash', 'hebron_crawl', 'hebron_ticker',
            ],
            'sponsor_overlay': True,
            'cms_enabled': True,
            'cms_level': 'full',
            'cms_workflow': True,
            'custom_templates': True,
            'video_scheduling': True,
            'cg_scheduling': True,
            'advanced_scheduling': True,
            'social_monitoring': True,
            'cg_timeline': False,
            'cg_controller': True,
            'live_input_streaming': False,
            'max_inputs': 0,
            **PREMIUM_MUSIC_PRO_FLAGS_FALSE,
            'features_list': [
                'Everything in News Pro, plus:',
                'Dedicated Cloud Playout Node: 6 vCPU, 12 GB RAM, 300 GB NVMe',
                'Five simultaneous destination slots',
                'YouTube Live & Facebook Live integrations',
                'Two additional configurable relay outputs',
                'One HLS origin destination & custom HTML iframe player',
                'Full newsroom CG, CMS & realtime graphics publishing',
                'Social streaming status monitoring',
                'Priority social and website-player support',
            ],
            'restricted_list': [
                'Programme Promo overlay reserved for Broadcast Plus',
                'No Enterprise Live Input Streaming or CG Timeline Editor',
                'No Music Now Playing or Visual CG Designer',
            ],
        },
    },
    'broadcast_plus': {
        'id': 'broadcast_plus',
        'name': 'Broadcast Plus',
        'price_npr': 45000,
        'billing_cycle': 'month',
        'vcpu': 8,
        'ram_gb': 24,
        'storage_gb': 450,
        'storage_quota_gb': 450,
        'max_outputs': 8,
        'sort_order': 5,
        'protocols': ['rtmp', 'srt', 'udp', 'youtube', 'facebook', 'hls'],
        'protocol_labels': ['RTMP', 'RTMPS', 'SRT', 'UDP', 'YouTube Live', 'Facebook Live', 'HLS Origin'],
        'support_tier': 'Priority escalation, monitoring and tuning support',
        'description': 'Flagship 24/7 enterprise broadcast suite with 8 simultaneous outputs, all 14 branded CG layers, programme promos, and priority NOC escalation.',
        'entitlements': {
            'resolutions': ['360p', '480p', '720p', '1080p'],
            'max_outputs': 8,
            'storage_quota_gb': 450,
            'protocols': ['rtmp', 'srt', 'udp', 'youtube', 'facebook', 'hls'],
            'rtmps_allowed': True,
            'srt_allowed': True,
            'udp_allowed': True,
            'hls_origin_output': True,
            'max_bitrate_kbps': 8000,
            'allowed_bitrates': ['1500k', '2500k', '3500k', '4500k', '5500k', '6500k', '7500k', '8000k'],
            'custom_output_encoding': True,
            'youtube_integration': True,
            'facebook_integration': True,
            'embed_player': True,
            'cg_categories': list(STANDARD_14_CG_CATEGORIES),
            'sponsor_overlay': True,
            'cms_enabled': True,
            'cms_level': 'enterprise',
            'cms_workflow': True,
            'custom_templates': True,
            'video_scheduling': True,
            'cg_scheduling': True,
            'advanced_scheduling': True,
            'social_monitoring': True,
            'cg_timeline': True,
            'cg_controller': True,
            'live_input_streaming': True,
            'max_inputs': 2,
            **PREMIUM_MUSIC_PRO_FLAGS_FALSE,
            'features_list': [
                'Everything in Digital 360, plus:',
                'Dedicated Cloud Playout Node: 8 vCPU, 24 GB RAM, 450 GB NVMe',
                'Eight simultaneous streaming destinations',
                'Enterprise Live Input Streaming (2 Live Studio / Remote Ingest Feeds)',
                'Multi-Track CG Timeline & Dual-Bus CG Live Controller',
                'Complete branded 14-layer CG collection',
                'Advanced CMS with custom template configuration',
                'Sponsor graphics, programme promotions & news overlays',
                'Priority escalation, monitoring and tuning support',
            ],
            'restricted_list': [
                'No Automatic Music Now Playing CG or Music Metadata CMS',
                'No Drag-and-Drop 16:9 Visual CG Designer',
                'No Automatic Programme Now/Next Graphics',
            ],
        },
    },
    'music_graphics_pro': {
        'id': 'music_graphics_pro',
        'name': 'Graphics Automation Pro',
        'price_npr': 60000,
        'billing_cycle': 'month',
        'vcpu': 8,
        'ram_gb': 24,
        'storage_gb': 450,
        'storage_quota_gb': 450,
        'max_outputs': 8,
        'sort_order': 6,
        'protocols': ['rtmp', 'srt', 'udp', 'youtube', 'facebook', 'hls'],
        'protocol_labels': ['RTMP', 'RTMPS', 'SRT', 'UDP', 'YouTube Live', 'Facebook Live', 'HLS Origin'],
        'support_tier': 'Dedicated broadcast graphics engineer + 24/7 NOC priority escalation',
        'description': 'Ultimate music channel & visual graphics powerhouse including all Broadcast Plus features, automatic Music Now Playing CG, Music Metadata CMS, Programme Now/Next automation, Flash News Premium, and 16:9 drag-and-drop Visual CG Studio.',
        'entitlements': {
            'resolutions': ['360p', '480p', '720p', '1080p'],
            'max_outputs': 8,
            'storage_quota_gb': 450,
            'protocols': ['rtmp', 'srt', 'udp', 'youtube', 'facebook', 'hls'],
            'rtmps_allowed': True,
            'srt_allowed': True,
            'udp_allowed': True,
            'hls_origin_output': True,
            'max_bitrate_kbps': 9000,
            'allowed_bitrates': ['1500k', '2500k', '3500k', '4500k', '5500k', '6500k', '7500k', '8000k', '9000k'],
            'custom_output_encoding': True,
            'youtube_integration': True,
            'facebook_integration': True,
            'embed_player': True,
            'cg_categories': list(ALL_CG_CATEGORIES),
            'sponsor_overlay': True,
            'cms_enabled': True,
            'cms_level': 'music_graphics_pro',
            'cms_workflow': True,
            'custom_templates': True,
            'video_scheduling': True,
            'cg_scheduling': True,
            'advanced_scheduling': True,
            'social_monitoring': True,
            'cg_timeline': True,
            'cg_controller': True,
            'live_input_streaming': True,
            'max_inputs': 4,
            **PREMIUM_MUSIC_PRO_FLAGS_TRUE,
            'features_list': [
                'Includes all Broadcast Plus (NPR 45,000) features, plus:',
                'Enterprise Live Input Streaming (Up to 4 Live Studio / OB Feeds)',
                'Full Multi-Track CG Timeline Editor & Dual-Bus CG Switcher',
                'Automatic Music Now Playing lower-third graphics (20s start / 30s before end)',
                'Music Metadata CMS (Song, Artist, Album, Composer, Lyricist, Label, Credits)',
                'Automatic Programme Now Showing / Next graphics from Scheduler',
                '16:9 Multi-Resolution Drag-and-Drop Visual CG Broadcast Editor',
                'All Animated Broadcast Graphics Templates, Flash News Premium & Layout Presets',
            ],
            'restricted_list': [],
        },
    },
}

PLAN_LIMITS = {
    pid: (p['max_outputs'], p['storage_quota_gb'])
    for pid, p in PLAN_DEFINITIONS.items()
}


def seed_plans(db: Prisma, tenant_id: int = 1, channel_id: int = 1):
    for pid, pdef in PLAN_DEFINITIONS.items():
        ent_json = json.dumps(pdef['entitlements'])
        protos_str = ','.join(pdef['protocols'])
        db.subscriptionplan.upsert(
            where={'id': pid},
            data={
                'create': {
                    'id': pid,
                    'name': pdef['name'],
                    'price_npr': pdef['price_npr'],
                    'billing_cycle': pdef['billing_cycle'],
                    'vcpu': pdef['vcpu'],
                    'ram_gb': pdef['ram_gb'],
                    'storage_gb': pdef['storage_gb'],
                    'max_outputs': pdef['max_outputs'],
                    'protocols': protos_str,
                    'support_tier': pdef['support_tier'],
                    'description': pdef['description'],
                    'entitlements_json': ent_json,
                    'sort_order': pdef['sort_order'],
                },
                'update': {
                    'name': pdef['name'],
                    'price_npr': pdef['price_npr'],
                    'vcpu': pdef['vcpu'],
                    'ram_gb': pdef['ram_gb'],
                    'storage_gb': pdef['storage_gb'],
                    'max_outputs': pdef['max_outputs'],
                    'protocols': protos_str,
                    'support_tier': pdef['support_tier'],
                    'description': pdef['description'],
                    'entitlements_json': ent_json,
                    'sort_order': pdef['sort_order'],
                },
            },
        )
        for fkey, fval in pdef['entitlements'].items():
            val_str = json.dumps(fval) if isinstance(fval, (list, dict, bool)) else str(fval)
            enabled_bool = bool(fval) if not isinstance(fval, str) or fval != 'none' else False
            db.planentitlement.upsert(
                where={'plan_id_feature_key': {'plan_id': pid, 'feature_key': fkey}},
                data={
                    'create': {
                        'plan_id': pid,
                        'feature_key': fkey,
                        'feature_value': val_str,
                        'enabled': enabled_bool,
                    },
                    'update': {
                        'feature_value': val_str,
                        'enabled': enabled_bool,
                    },
                },
            )

    tenant = db.tenant.find_unique(where={'id': tenant_id})
    active_plan = (tenant.plan if tenant and tenant.plan in PLAN_DEFINITIONS else 'broadcast_plus')
    sub = db.tenantsubscription.find_unique(where={'tenant_id': tenant_id})
    if not sub:
        db.tenantsubscription.create(
            data={
                'tenant_id': tenant_id,
                'plan_id': active_plan,
                'status': 'active',
                'is_demo': True,
            }
        )
    compute_resource_usage(db, tenant_id, channel_id)


def get_plan_catalog(db: Prisma) -> list[dict]:
    rows = db.subscriptionplan.find_many(order={'sort_order': 'asc'})
    if len(rows) < len(PLAN_DEFINITIONS):
        seed_plans(db)
        rows = db.subscriptionplan.find_many(order={'sort_order': 'asc'})
    catalog = []
    for r in rows:
        pdef = PLAN_DEFINITIONS.get(r.id, {})
        try:
            ent = json.loads(r.entitlements_json)
        except Exception:
            ent = pdef.get('entitlements', {})
        catalog.append(
            {
                'id': r.id,
                'name': r.name,
                'price_npr': r.price_npr,
                'billing_cycle': r.billing_cycle,
                'vcpu': r.vcpu,
                'ram_gb': r.ram_gb,
                'storage_gb': r.storage_gb,
                'storage_quota_gb': r.storage_gb,
                'max_outputs': r.max_outputs,
                'protocols': [x for x in r.protocols.split(',') if x],
                'protocol_labels': pdef.get('protocol_labels', [x.upper() for x in r.protocols.split(',') if x]),
                'support_tier': r.support_tier,
                'description': r.description,
                'sort_order': r.sort_order,
                'entitlements': ent,
            }
        )
    return catalog


def get_tenant_entitlements(db: Prisma, tenant_id: int) -> dict:
    sub = db.tenantsubscription.find_unique(where={'tenant_id': tenant_id})
    tenant = db.tenant.find_unique(where={'id': tenant_id})
    plan_id = (sub.plan_id if sub else None) or (tenant.plan if tenant else None) or 'broadcast_plus'
    if plan_id not in PLAN_DEFINITIONS:
        plan_id = 'broadcast_plus'
    pdef = PLAN_DEFINITIONS[plan_id]
    return {
        'plan_id': plan_id,
        'plan_name': pdef['name'],
        'price_npr': pdef['price_npr'],
        'vcpu': pdef['vcpu'],
        'ram_gb': pdef['ram_gb'],
        'storage_gb': pdef['storage_gb'],
        'support_tier': pdef['support_tier'],
        **pdef['entitlements'],
    }


def compute_resource_usage(db: Prisma, tenant_id: int, channel_id: int = 1) -> dict:
    ent = get_tenant_entitlements(db, tenant_id)
    media_rows = db.media.find_many(where={'tenant_id': tenant_id, 'channel_id': channel_id})
    outputs = db.output.find_many(where={'tenant_id': tenant_id, 'channel_id': channel_id})
    cg_rows = db.cg.find_many(where={'tenant_id': tenant_id, 'channel_id': channel_id})
    sched_rows = db.schedule.find_many(where={'tenant_id': tenant_id, 'channel_id': channel_id})

    storage_used = sum(int(m.size or 0) for m in media_rows)
    active_outputs = sum(1 for o in outputs if o.enabled)
    total_outputs = len(outputs)
    active_cg = sum(1 for c in cg_rows if c.active and c.category in ent['cg_categories'])
    active_schedules = sum(1 for s in sched_rows if s.enabled)

    db.resourceusage.upsert(
        where={'tenant_id_channel_id': {'tenant_id': tenant_id, 'channel_id': channel_id}},
        data={
            'create': {
                'tenant_id': tenant_id,
                'channel_id': channel_id,
                'storage_used_bytes': storage_used,
                'media_count': len(media_rows),
                'active_outputs': active_outputs,
                'total_outputs': total_outputs,
                'active_cg_layers': active_cg,
                'active_schedules': active_schedules,
            },
            'update': {
                'storage_used_bytes': storage_used,
                'media_count': len(media_rows),
                'active_outputs': active_outputs,
                'total_outputs': total_outputs,
                'active_cg_layers': active_cg,
                'active_schedules': active_schedules,
                'updated_at': utcnow(),
            },
        },
    )
    quota_bytes = int(ent['storage_quota_gb']) * 1024**3
    return {
        'tenant_id': tenant_id,
        'channel_id': channel_id,
        'plan_id': ent['plan_id'],
        'plan_name': ent['plan_name'],
        'storage_used_bytes': storage_used,
        'storage_used_mb': round(storage_used / (1024 * 1024), 2),
        'storage_quota_gb': ent['storage_quota_gb'],
        'storage_quota_bytes': quota_bytes,
        'storage_percent': round((storage_used / quota_bytes) * 100, 2) if quota_bytes else 0,
        'media_count': len(media_rows),
        'active_outputs': active_outputs,
        'total_outputs': total_outputs,
        'max_outputs': ent['max_outputs'],
        'remaining_outputs': max(0, ent['max_outputs'] - total_outputs),
        'remaining_active_outputs': max(0, ent['max_outputs'] - active_outputs),
        'active_cg_layers': active_cg,
        'allowed_cg_count': len(ent['cg_categories']),
        'active_schedules': active_schedules,
    }


def get_tenant_subscription(db: Prisma, tenant_id: int, channel_id: int = 1) -> dict:
    sub = db.tenantsubscription.find_unique(where={'tenant_id': tenant_id})
    tenant = db.tenant.find_unique(where={'id': tenant_id})
    plan_id = (sub.plan_id if sub else None) or (tenant.plan if tenant else None) or 'broadcast_plus'
    if plan_id not in PLAN_DEFINITIONS:
        plan_id = 'broadcast_plus'
    pdef = PLAN_DEFINITIONS[plan_id]
    ent = get_tenant_entitlements(db, tenant_id)
    usage = compute_resource_usage(db, tenant_id, channel_id)
    history = db.subscriptionhistory.find_many(
        where={'tenant_id': tenant_id},
        order={'id': 'desc'},
        take=10,
    )
    return {
        'tenant_id': tenant_id,
        'plan_id': plan_id,
        'plan_name': pdef['name'],
        'price_npr': pdef['price_npr'],
        'billing_cycle': pdef['billing_cycle'],
        'status': sub.status if sub else 'active',
        'is_demo': True if not sub else bool(sub.is_demo),
        'vcpu': pdef['vcpu'],
        'ram_gb': pdef['ram_gb'],
        'storage_gb': pdef['storage_gb'],
        'max_outputs': pdef['max_outputs'],
        'protocols': pdef['protocols'],
        'protocol_labels': pdef['protocol_labels'],
        'support_tier': pdef['support_tier'],
        'description': pdef['description'],
        'activated_at': sub.activated_at.isoformat() if sub and sub.activated_at else None,
        'updated_at': sub.updated_at.isoformat() if sub and sub.updated_at else None,
        'entitlements': ent,
        'usage': usage,
        'history': [object_dict(h) for h in history],
    }


def activate_or_change_plan(
    db: Prisma,
    tenant_id: int,
    channel_id: int,
    plan_id: str,
    user_id: int | None = None,
    reason: str = 'Demo plan activation',
) -> dict:
    if plan_id not in PLAN_DEFINITIONS:
        raise HTTPException(422, f'Unknown subscription plan: {plan_id}')

    pdef = PLAN_DEFINITIONS[plan_id]
    ent = pdef['entitlements']
    max_outputs = pdef['max_outputs']
    storage_gb = pdef['storage_quota_gb']
    allowed_protocols = set(ent['protocols'])
    allowed_cg = set(ent['cg_categories'])

    current_sub = db.tenantsubscription.find_unique(where={'tenant_id': tenant_id})
    tenant = db.tenant.find_unique(where={'id': tenant_id})
    old_plan_id = (current_sub.plan_id if current_sub else None) or (tenant.plan if tenant else None)

    db.tenant.update(
        where={'id': tenant_id},
        data={
            'plan': plan_id,
            'max_outputs': max_outputs,
            'storage_quota_gb': storage_gb,
        },
    )
    db.tenantsubscription.upsert(
        where={'tenant_id': tenant_id},
        data={
            'create': {
                'tenant_id': tenant_id,
                'plan_id': plan_id,
                'status': 'active',
                'is_demo': True,
                'activated_by': user_id,
            },
            'update': {
                'plan_id': plan_id,
                'status': 'active',
                'is_demo': True,
                'activated_by': user_id,
                'updated_at': utcnow(),
            },
        },
    )
    db.subscriptionhistory.create(
        data={
            'tenant_id': tenant_id,
            'old_plan_id': old_plan_id,
            'new_plan_id': plan_id,
            'changed_by': user_id,
            'reason': reason,
        }
    )

    # Safely disable excess or protocol-restricted outputs without deleting user records
    outputs = db.output.find_many(
        where={'tenant_id': tenant_id, 'channel_id': channel_id},
        order={'id': 'asc'},
    )
    enabled_count = 0
    disabled_output_ids = []
    for out in outputs:
        proto_ok = out.protocol in allowed_protocols
        if out.enabled:
            if proto_ok and enabled_count < max_outputs:
                enabled_count += 1
            else:
                db.output.update(where={'id': out.id}, data={'enabled': False})
                disabled_output_ids.append(out.id)

    # Safely deactivate CG layers that are not permitted under the new plan (preserving content)
    cg_layers = db.cg.find_many(where={'tenant_id': tenant_id, 'channel_id': channel_id})
    deactivated_cg_ids = []
    for layer in cg_layers:
        if layer.active and layer.category not in allowed_cg:
            db.cg.update(where={'id': layer.id}, data={'active': False, 'updated_at': utcnow()})
            deactivated_cg_ids.append(layer.id)

    # Safely deactivate live input streams if downgrading to a plan without live_input_streaming
    if not ent.get('live_input_streaming'):
        try:
            active_inputs = db.inputstream.find_many(where={'tenant_id': tenant_id, 'channel_id': channel_id})
            for inp in active_inputs:
                if inp.is_live:
                    db.inputstream.update(where={'id': inp.id}, data={'is_live': False})
        except Exception:
            pass

    sub_info = get_tenant_subscription(db, tenant_id, channel_id)
    sub_info['disabled_output_ids'] = disabled_output_ids
    sub_info['deactivated_cg_ids'] = deactivated_cg_ids
    sub_info['old_plan_id'] = old_plan_id
    return sub_info


def assert_input_stream_allowed(db: Prisma, tenant_id: int, channel_id: int = 1, input_id: int | None = None):
    ent = get_tenant_entitlements(db, tenant_id)
    if not ent.get('live_input_streaming'):
        raise HTTPException(
            403,
            f"Enterprise Live Input Streaming requires Broadcast Plus or Graphics Automation Pro (current plan: {ent['plan_name']}).",
        )
    max_inputs = int(ent.get('max_inputs') or 2)
    existing = db.inputstream.find_many(where={'tenant_id': tenant_id, 'channel_id': channel_id})
    if input_id is None and len(existing) >= max_inputs:
        raise HTTPException(
            409,
            f"Live Input limit reached ({max_inputs} feeds on {ent['plan_name']}). Upgrade to Graphics Automation Pro for up to 4 live inputs.",
        )


def assert_cg_timeline_allowed(db: Prisma, tenant_id: int):
    ent = get_tenant_entitlements(db, tenant_id)
    if not ent.get('cg_timeline'):
        raise HTTPException(
            403,
            f"The Multi-Track CG Timeline requires Broadcast Plus or Graphics Automation Pro (current plan: {ent['plan_name']}).",
        )


def assert_cg_category_allowed(db: Prisma, tenant_id: int, category: str):
    ent = get_tenant_entitlements(db, tenant_id)
    if category not in ent['cg_categories']:
        raise HTTPException(
            403,
            f"The '{category}' graphics layer requires a higher subscription plan (current plan: {ent['plan_name']}).",
        )


def assert_cms_allowed(db: Prisma, tenant_id: int, category: str | None = None, status: str | None = None):
    ent = get_tenant_entitlements(db, tenant_id)
    if not ent['cms_enabled']:
        raise HTTPException(
            403,
            f"Editorial CG CMS is not included in the {ent['plan_name']} plan. Upgrade to Growth or higher.",
        )
    if category and category not in ent['cg_categories']:
        raise HTTPException(
            403,
            f"CMS content for category '{category}' is not enabled on the {ent['plan_name']} plan.",
        )


def assert_custom_template_allowed(db: Prisma, tenant_id: int, category: str | None = None):
    ent = get_tenant_entitlements(db, tenant_id)
    if not ent['custom_templates']:
        raise HTTPException(
            403,
            f"Custom CG template creation requires News Pro or higher (current plan: {ent['plan_name']}).",
        )
    if category and category not in ent['cg_categories']:
        raise HTTPException(
            403,
            f"CG template category '{category}' is not enabled on the {ent['plan_name']} plan.",
        )


def assert_music_cg_allowed(db: Prisma, tenant_id: int):
    ent = get_tenant_entitlements(db, tenant_id)
    if not ent.get('music_now_playing') or not ent.get('music_metadata_cms'):
        raise HTTPException(
            403,
            f"Music Now Playing CG & Music Metadata CMS require the Graphics Automation Pro plan (NPR 60,000/month). Current plan: {ent['plan_name']}.",
        )


def assert_programme_cg_allowed(db: Prisma, tenant_id: int):
    ent = get_tenant_entitlements(db, tenant_id)
    if not ent.get('program_now_next_auto'):
        raise HTTPException(
            403,
            f"Automatic Programme Now/Next CG requires the Graphics Automation Pro plan (NPR 60,000/month). Current plan: {ent['plan_name']}.",
        )


def assert_visual_designer_allowed(db: Prisma, tenant_id: int):
    ent = get_tenant_entitlements(db, tenant_id)
    if not ent.get('visual_cg_designer'):
        raise HTTPException(
            403,
            f"The 1920x1080 Drag-and-Drop Visual CG Studio requires the Graphics Automation Pro plan (NPR 60,000/month). Current plan: {ent['plan_name']}.",
        )


def assert_schedule_allowed(db: Prisma, tenant_id: int, kind: str, target_id: int | None = None):
    ent = get_tenant_entitlements(db, tenant_id)
    if kind in ('cg', 'cg_content'):
        if not ent['cg_scheduling']:
            raise HTTPException(
                403,
                f"CG event scheduling is not included in the {ent['plan_name']} plan. Upgrade to Growth or higher.",
            )
        if target_id is not None:
            if kind == 'cg':
                layer = db.cg.find_unique(where={'id': int(target_id)})
                if layer and layer.category not in ent['cg_categories']:
                    raise HTTPException(
                        403,
                        f"Cannot schedule '{layer.category}' CG on the {ent['plan_name']} plan.",
                    )
            elif kind == 'cg_content':
                content = db.cgcontent.find_unique(where={'id': int(target_id)})
                if content and content.category not in ent['cg_categories']:
                    raise HTTPException(
                        403,
                        f"Cannot schedule '{content.category}' CMS item on the {ent['plan_name']} plan.",
                    )


def assert_output_allowed(
    db: Prisma,
    tenant_id: int,
    channel_id: int,
    protocol: str,
    url: str,
    enabling: bool = False,
    output_id: int | None = None,
):
    ent = get_tenant_entitlements(db, tenant_id)
    allowed_protocols = set(ent['protocols'])
    if protocol not in allowed_protocols:
        raise HTTPException(
            403,
            f"Protocol '{protocol.upper()}' is not included in the {ent['plan_name']} plan. Allowed: {', '.join(p.upper() for p in ent['protocols'])}.",
        )

    existing = db.output.find_many(where={'tenant_id': tenant_id, 'channel_id': channel_id})
    max_outputs = min(8, int(ent['max_outputs']))

    if output_id is None and len(existing) >= max_outputs:
        raise HTTPException(
            409,
            f"Plan output limit reached ({max_outputs} destinations on {ent['plan_name']}). Upgrade your plan to add more outputs.",
        )

    if enabling:
        active_others = sum(1 for o in existing if o.enabled and o.id != output_id)
        if active_others >= max_outputs:
            raise HTTPException(
                409,
                f"Active output limit reached ({max_outputs} simultaneous outputs on {ent['plan_name']}).",
            )


def validate_feature_or_limit(
    db: Prisma,
    tenant_id: int,
    channel_id: int,
    feature: str,
    context: dict | None = None,
) -> dict:
    ctx = context or {}
    ent = get_tenant_entitlements(db, tenant_id)
    usage = compute_resource_usage(db, tenant_id, channel_id)
    allowed = True
    reason = 'Allowed'

    if feature == 'output_create':
        proto = ctx.get('protocol', 'rtmp')
        if proto not in ent['protocols']:
            allowed = False
            reason = f"Protocol '{proto.upper()}' requires News Pro or higher."
        elif usage['total_outputs'] >= ent['max_outputs']:
            allowed = False
            reason = f"Output limit ({ent['max_outputs']}) reached for {ent['plan_name']}."
    elif feature == 'cg_category':
        cat = ctx.get('category', '')
        if cat not in ent['cg_categories']:
            allowed = False
            reason = f"CG category '{cat}' is not enabled in {ent['plan_name']}."
    elif feature == 'cms':
        if not ent['cms_enabled']:
            allowed = False
            reason = f"Editorial CMS is not enabled in {ent['plan_name']}."
    elif feature == 'custom_templates':
        if not ent['custom_templates']:
            allowed = False
            reason = f"Custom CG templates require News Pro or higher."
    elif feature == 'cg_scheduling':
        if not ent['cg_scheduling']:
            allowed = False
            reason = f"CG event scheduling requires Growth or higher."
    elif feature == 'embed_player':
        if not ent['embed_player']:
            allowed = False
            reason = f"Website HTML embed player requires Digital 360 or Broadcast Plus."
    elif feature in PREMIUM_MUSIC_PRO_FLAGS_TRUE:
        allowed = bool(ent.get(feature))
        if not allowed:
            reason = f"Feature '{feature}' requires Graphics Automation Pro (NPR 60,000/month)."
    else:
        val = ent.get(feature)
        allowed = bool(val)
        if not allowed:
            reason = f"Feature '{feature}' is not enabled on {ent['plan_name']}."

    return {
        'allowed': allowed,
        'feature': feature,
        'reason': reason,
        'plan_id': ent['plan_id'],
        'plan_name': ent['plan_name'],
        'entitlements': ent,
        'usage': usage,
    }
