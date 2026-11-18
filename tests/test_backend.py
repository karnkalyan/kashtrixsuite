import os
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import pymysql

ROOT = Path(__file__).resolve().parents[1]
TEST_DB_URL = 'mysql://root:@127.0.0.1:3306/kashtrix_test'
os.environ['PRISMA_DATABASE_URL'] = TEST_DB_URL
os.environ['DATABASE_URL'] = TEST_DB_URL
os.environ['DATA_DIR'] = str(Path(tempfile.mkdtemp()) / 'data')
os.environ['PLAYOUT_DRY_RUN'] = '1'
os.environ['SEED_DEMO_MEDIA'] = '0'
os.environ['ALLOW_PRIVATE_OUTPUTS'] = '0'
os.environ['ADMIN_PASSWORD'] = 'TestingSecurePass123!'

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='', autocommit=True)
with conn.cursor() as cur:
    cur.execute('DROP DATABASE IF EXISTS `kashtrix_test`;')
conn.close()

sys.path.insert(0, str(ROOT / 'backend'))
from fastapi.testclient import TestClient
import main

TZ = ZoneInfo('Asia/Kathmandu')


def auth(c, who='admin', password='TestingSecurePass123!'):
    r = c.post('/api/login', json={'username': who, 'password': password})
    assert r.status_code == 200, r.text
    return {'Authorization': 'Bearer ' + r.json()['token']}


def test_auth_tenant_roles_and_bootstrap():
    with TestClient(main.app) as c:
        assert c.get('/api/bootstrap').status_code == 401
        assert c.post('/api/login', json={'password': 'bad'}).status_code == 401
        h = auth(c)
        d = c.get('/api/bootstrap', headers=h).json()
        assert d['tenant']['name'] and len(d['cg']) >= 20 and len(d['cg_templates']) >= 20
        assert len(d['plans']) == 6
        assert d['settings']['resolution'] == '1080p'
        assert c.post('/api/users', headers=h, json={'username': 'newseditor', 'password': 'EditorSecurePass123!', 'role': 'editor'}).status_code == 200
        ed = auth(c, 'newseditor', 'EditorSecurePass123!')
        assert c.post('/api/control', headers=ed, json={'action': 'start'}).status_code == 403
        # Editor cannot switch subscription plans
        assert c.post('/api/subscriptions/activate', headers=ed, json={'plan': 'essential'}).status_code == 403
        assert c.post('/api/cg_content', headers=ed, json={'title': 'News story', 'category': 'ticker', 'text': 'नयाँ अपडेट', 'status': 'draft'}).status_code == 200
        assert c.post('/api/outputs', headers=ed, json={'name': 'Restricted', 'protocol': 'rtmp', 'url': 'rtmp://example.com/live/X'}).status_code == 403
        assert c.post('/api/control', headers=h, json={'action': 'start'}).status_code == 200


def test_all_six_subscription_plans_entitlements_and_downgrade():
    with TestClient(main.app) as c:
        h = auth(c)
        plans = c.get('/api/subscriptions/plans', headers=h).json()
        prices = {p['id']: p['price_npr'] for p in plans}
        assert prices == {
            'essential': 15000,
            'growth': 20000,
            'news_pro': 25000,
            'digital_360': 30000,
            'broadcast_plus': 45000,
            'music_graphics_pro': 60000,
        }

        cg_list = c.get('/api/cg', headers=h).json()
        breaking_cg = next(x for x in cg_list if x['category'] == 'breaking')
        sponsor_cg = next(x for x in cg_list if x['category'] == 'sponsor')
        promo_cg = next(x for x in cg_list if x['category'] == 'promo')
        music_cg = next(x for x in cg_list if x['category'] in ('music_now', 'music_now_playing'))

        # 1. Switch to Essential (NPR 15,000, 2 outputs, RTMP only, logo+ticker only, no CMS, no CG scheduling)
        r = c.post('/api/subscriptions/activate', headers=h, json={'plan': 'essential'})
        assert r.status_code == 200, r.text
        assert r.json()['max_outputs'] == 2
        assert c.post('/api/cg_content', headers=h, json={'title': 'Blocked CMS', 'category': 'ticker', 'text': 'x'}).status_code == 403
        assert c.put(f"/api/cg/{sponsor_cg['id']}", headers=h, json={**sponsor_cg, 'active': 1}).status_code == 403
        assert c.put(f"/api/cg/{breaking_cg['id']}", headers=h, json={**breaking_cg, 'active': 1}).status_code == 403
        assert c.put('/api/music/cg-settings', headers=h, json={'enabled': 1}).status_code == 403
        assert c.put('/api/programme/cg-settings', headers=h, json={'enabled': 1}).status_code == 403
        assert c.put(f"/api/cg/preview/{breaking_cg['id']}", headers=h, json={'text': 'Blocked preview'}).status_code == 403
        assert c.post('/api/outputs', headers=h, json={'name': 'SRT Feed', 'protocol': 'srt', 'url': 'srt://example.org:9000'}).status_code == 403
        logo_cg = next(x for x in cg_list if x['category'] == 'logo')
        assert c.post('/api/schedules', headers=h, json={
            'name': 'Blocked CG sched', 'kind': 'cg', 'target_id': logo_cg['id'],
            'starts_at': '2026-10-29T21:00:00+05:45', 'duration_sec': 60
        }).status_code == 403
        assert c.get('/api/embed-config', headers=h).status_code == 403

        # 2. Switch to Growth (NPR 20,000, 3 outputs)
        r = c.put('/api/subscriptions/change', headers=h, json={'plan': 'growth'})
        assert r.status_code == 200 and r.json()['max_outputs'] == 3
        assert c.put(f"/api/cg/{sponsor_cg['id']}", headers=h, json={**sponsor_cg, 'active': 1}).status_code == 200
        assert c.put(f"/api/cg/{breaking_cg['id']}", headers=h, json={**breaking_cg, 'active': 1}).status_code == 403
        assert c.put('/api/music/cg-settings', headers=h, json={'enabled': 1}).status_code == 403

        # 3. Switch to News Pro (NPR 25,000, 4 outputs)
        r = c.put('/api/subscriptions/change', headers=h, json={'plan': 'news_pro'})
        assert r.status_code == 200 and r.json()['max_outputs'] == 4
        assert c.put(f"/api/cg/{breaking_cg['id']}", headers=h, json={**breaking_cg, 'active': 1}).status_code == 200
        assert c.post('/api/cg_templates', headers=h, json={'name': 'News Pro Tpl', 'category': 'breaking'}).status_code == 200
        assert c.get('/api/embed-config', headers=h).status_code == 403
        assert c.put('/api/music/cg-settings', headers=h, json={'enabled': 1}).status_code == 403

        # 4. Switch to Digital 360 (NPR 30,000, 5 outputs)
        r = c.put('/api/subscriptions/change', headers=h, json={'plan': 'digital_360'})
        assert r.status_code == 200 and r.json()['max_outputs'] == 5
        assert c.get('/api/embed-config', headers=h).status_code == 200
        assert c.put(f"/api/cg/{promo_cg['id']}", headers=h, json={**promo_cg, 'active': 1}).status_code == 403
        assert c.put('/api/music/cg-settings', headers=h, json={'enabled': 1}).status_code == 403

        # 5. Switch to Broadcast Plus (NPR 45,000, 8 outputs, 14 standard CG categories, Music Pro features STILL LOCKED)
        r = c.put('/api/subscriptions/change', headers=h, json={'plan': 'broadcast_plus'})
        assert r.status_code == 200 and r.json()['max_outputs'] == 8
        assert c.put(f"/api/cg/{promo_cg['id']}", headers=h, json={**promo_cg, 'active': 1}).status_code == 200
        assert c.put(f"/api/cg/{music_cg['id']}", headers=h, json={**music_cg, 'active': 1}).status_code == 403
        assert c.put('/api/music/cg-settings', headers=h, json={'enabled': 1}).status_code == 403
        assert c.put('/api/programme/cg-settings', headers=h, json={'enabled': 1}).status_code == 403
        assert c.put(f"/api/cg/preview/{promo_cg['id']}", headers=h, json={'text': 'Blocked on Broadcast Plus'}).status_code == 403

        # 6. Switch to Music & Graphics Pro (NPR 60,000, 8 outputs, all 20 CG categories + Music CG + Programme CG + Visual CG Designer)
        r = c.put('/api/subscriptions/change', headers=h, json={'plan': 'music_graphics_pro'})
        assert r.status_code == 200 and r.json()['max_outputs'] == 8
        assert r.json()['price_npr'] == 60000
        assert c.put(f"/api/cg/{music_cg['id']}", headers=h, json={**music_cg, 'active': 1}).status_code == 200
        assert c.put('/api/music/cg-settings', headers=h, json={'enabled': 1, 'start_delay_sec': 20, 'start_duration_sec': 10, 'end_lead_sec': 30, 'end_duration_sec': 10}).status_code == 200
        assert c.put('/api/programme/cg-settings', headers=h, json={'enabled': 1, 'start_delay_sec': 5, 'start_duration_sec': 12}).status_code == 200
        assert c.put(f"/api/cg/preview/{promo_cg['id']}", headers=h, json={'text': 'Allowed on Music Pro'}).status_code == 200


def test_output_caps_across_all_plans_and_safe_downgrade():
    with TestClient(main.app) as c:
        h = auth(c)
        for plan_id, cap in [
            ('essential', 2),
            ('growth', 3),
            ('news_pro', 4),
            ('digital_360', 5),
            ('broadcast_plus', 8),
            ('music_graphics_pro', 8),
        ]:
            assert c.put('/api/tenant/plan', headers=h, json={'plan': plan_id}).status_code == 200
            for out in c.get('/api/outputs', headers=h).json():
                c.delete('/api/outputs/' + str(out['id']), headers=h)
            for idx in range(1, cap + 1):
                r = c.post('/api/outputs', headers=h, json={
                    'name': f'Out {idx}', 'protocol': 'rtmp',
                    'url': f'rtmps://example.org/live/key-{idx}', 'enabled': 1
                })
                assert r.status_code == 200, f'{plan_id} failed at {idx}: {r.text}'
            denied = c.post('/api/outputs', headers=h, json={
                'name': 'Overflow', 'protocol': 'rtmp', 'url': 'rtmps://example.org/live/overflow'
            })
            assert denied.status_code == 409

        # Downgrade from Music & Graphics Pro (8 enabled outputs) to Essential (2 max outputs):
        # All 8 output records are preserved, but only 2 remain enabled!
        down = c.put('/api/tenant/plan', headers=h, json={'plan': 'essential'})
        assert down.status_code == 200
        outputs_after = c.get('/api/outputs', headers=h).json()
        assert len(outputs_after) == 8
        assert sum(1 for o in outputs_after if o['enabled']) == 2
        for out in outputs_after:
            c.delete('/api/outputs/' + str(out['id']), headers=h)
        c.put('/api/tenant/plan', headers=h, json={'plan': 'music_graphics_pro'})


def test_music_metadata_and_automatic_now_playing_timing_and_seek():
    with TestClient(main.app) as c:
        h = auth(c)
        c.put('/api/tenant/plan', headers=h, json={'plan': 'music_graphics_pro'})

        # Upload a music video asset
        f = ROOT / 'assets' / 'demo-nepal-playout.mp4'
        with f.open('rb') as src:
            up = c.post(
                '/api/media/upload',
                headers=h,
                data={'folder': 'Music', 'category': 'music'},
                files={'file': ('nepali_song.mp4', src, 'video/mp4')},
            )
        assert up.status_code == 200, up.text
        mid = up.json()['id']

        # Save rich Nepali/English Music Metadata
        meta_res = c.put(f'/api/music/metadata/{mid}', headers=h, json={
            'song_title': 'सम्झनाको फूल (Samjhanako Phool)',
            'artist': 'नारायण गोपाल (Narayan Gopal)',
            'album': 'स्वर्णिम सन्ध्या',
            'music_director': 'गोपाल योञ्जन',
            'composer': 'गोपाल योञ्जन',
            'lyricist': 'चाँदनी शाह',
            'record_label': 'Music Nepal',
            'release_year': '2045',
            'genre': 'Adhunik',
            'language': 'Nepali',
            'copyright_text': '© Music Nepal',
            'override_enabled': 0,
            'start_delay_sec': 20,
            'start_duration_sec': 10,
            'end_lead_sec': 30,
            'end_duration_sec': 10,
        })
        assert meta_res.status_code == 200, meta_res.text
        assert meta_res.json()['song_title'] == 'सम्झनाको फूल (Samjhanako Phool)'

        # Test bulk music metadata update
        bulk_res = c.post('/api/music/metadata/bulk', headers=h, json={
            'items': [{'media_id': mid, 'song_title': 'सम्झनाको फूल', 'artist': 'नारायण गोपाल', 'album': 'स्वर्णिम सन्ध्या', 'genre': 'Adhunik'}]
        })
        assert bulk_res.status_code == 200 and bulk_res.json()['updated'] == 1

        # Preview formatted Music Now Playing payload
        prev = c.post('/api/music/cg-preview', headers=h, json={'media_id': mid})
        assert prev.status_code == 200
        assert 'सम्झनाको फूल' in prev.json()['preview']['text']
        assert 'नारायण गोपाल' in prev.json()['preview']['subtext']

        # Simulate a 120-second music video on the engine to verify:
        # 1) Start graphic triggers at 20s and hides at 30s (10s duration)
        # 2) End graphic triggers at 90s (30s before 120s end) and hides at 100s (10s duration)
        # 3) No duplicate trigger during the same window; seek resets cleanly
        from db import SessionLocal
        with SessionLocal() as db:
            db.media.update(where={'id': mid}, data={'duration': 120.0, 'category': 'music'})
        main.engine.current_media = mid
        main.engine.current_duration = 120.0
        main.engine.current_category = 'music'
        main.engine._music_start_shown_for_run = False
        main.engine._music_end_shown_for_run = False
        main.engine._music_cg_currently_active = False

        # At 10s (before 20s delay): inactive
        r10 = c.post('/api/music/cg-evaluate', headers=h, json={'position_sec': 10.0}).json()
        assert r10['active'] is False

        # At 22s (within [20s, 30s) start window): ACTIVE in 'start' phase
        r22 = c.post('/api/music/cg-evaluate', headers=h, json={'position_sec': 22.0}).json()
        assert r22['active'] is True and r22['phase'] == 'start'
        assert 'सम्झनाको फूल' in r22['text']

        # At 35s (after 10s start duration ends): automatically deactivated
        r35 = c.post('/api/music/cg-evaluate', headers=h, json={'position_sec': 35.0}).json()
        assert r35['active'] is False

        # Re-evaluating at 25s WITHOUT a seek does not duplicate the already-shown start window
        r25_dup = c.post('/api/music/cg-evaluate', headers=h, json={'position_sec': 25.0}).json()
        assert r25_dup['active'] is False

        # At 92s (within [90s, 100s) end window, 30s before 120s end): ACTIVE in 'end' phase
        r92 = c.post('/api/music/cg-evaluate', headers=h, json={'position_sec': 92.0}).json()
        assert r92['active'] is True and r92['phase'] == 'end'

        # At 105s (after 10s end duration completes): automatically deactivated
        r105 = c.post('/api/music/cg-evaluate', headers=h, json={'position_sec': 105.0}).json()
        assert r105['active'] is False

        # Seek back to 15s resets the run flags so reaching 21s triggers cleanly again
        c.post('/api/control', headers=h, json={'action': 'seek', 'position_sec': 15.0})
        r21_after_seek = c.post('/api/music/cg-evaluate', headers=h, json={'position_sec': 21.0}).json()
        assert r21_after_seek['active'] is True and r21_after_seek['phase'] == 'start'


def test_programme_now_next_eligibility_and_missing_next():
    with TestClient(main.app) as c:
        h = auth(c)
        c.put('/api/tenant/plan', headers=h, json={'plan': 'music_graphics_pro'})

        # Enable Programme CG for 'news' and 'talk_show'
        c.put('/api/programme/cg-settings', headers=h, json={
            'enabled': 1,
            'show_at_start': 1,
            'start_delay_sec': 5,
            'start_duration_sec': 15,
            'show_before_end': 1,
            'end_lead_sec': 30,
            'end_duration_sec': 15,
            'template_kind': 'now_next',
            'allowed_categories': ['news', 'talk_show'],
            'show_next_programme': 1,
        })

        # 1) When playing default fallback playlist (source == 'playlist', no active schedule): NEVER show Programme CG
        main.engine.source = 'playlist'
        main.engine.active_schedule = None
        res_default = c.post('/api/programme/cg-evaluate', headers=h).json()
        assert res_default['active'] is False and res_default['reason'] == 'not_scheduled_programme'

        # 2) Schedule a current 'news' programme without any upcoming programme -> NEXT field is hidden!
        now_ktm = datetime.now(TZ).replace(microsecond=0)
        from db import SessionLocal
        with SessionLocal() as db:
            db.schedule.delete_many(where={'tenant_id': 1})
            s1 = db.schedule.create(
                data={
                    'tenant_id': 1,
                    'name': 'साँझ समाचार (Evening News)',
                    'kind': 'media',
                    'target_id': 1,
                    'starts_at': (now_ktm - timedelta(seconds=10)).isoformat(),
                    'duration_sec': 1800,
                    'repeat': 'none',
                    'priority': 50,
                    'enabled': True,
                    'status': 'active',
                    'programme_category': 'news',
                    'enable_programme_cg': True,
                }
            )
            s1_id = s1.id

        main.engine.source = 'schedule:साँझ समाचार (Evening News)'
        main.engine.active_schedule = s1_id
        main.engine.started_at = datetime.now(TZ).timestamp() - 8.0  # 8s into programme (within [5s, 20s) start window)

        res_single = c.post('/api/programme/cg-evaluate', headers=h).json()
        assert res_single['active'] is True
        assert 'साँझ समाचार' in res_single['text']
        assert res_single['has_next'] is False
        assert 'NEXT' not in res_single['subtext']

        # 3) Add a valid next programme -> NEXT field is populated!
        with SessionLocal() as db:
            db.schedule.create(
                data={
                    'tenant_id': 1,
                    'name': 'विशेष संवाद (Special Dialogue)',
                    'kind': 'media',
                    'target_id': 1,
                    'starts_at': (now_ktm + timedelta(minutes=30)).isoformat(),
                    'duration_sec': 1800,
                    'repeat': 'none',
                    'priority': 50,
                    'enabled': True,
                    'status': 'scheduled',
                    'programme_category': 'talk_show',
                    'enable_programme_cg': True,
                }
            )

        res_with_next = c.post('/api/programme/cg-evaluate', headers=h).json()
        assert res_with_next['active'] is True
        assert res_with_next['has_next'] is True
        assert 'विशेष संवाद' in res_with_next['subtext']


def test_visual_cg_preview_vs_onair_take_presets_and_scaling():
    with TestClient(main.app) as c:
        h = auth(c)
        c.put('/api/tenant/plan', headers=h, json={'plan': 'music_graphics_pro'})

        cg_list = c.get('/api/cg', headers=h).json()
        lt = next(x for x in cg_list if x['category'] == 'lower_third')
        orig_x = lt['position_x']
        orig_text = lt['text']

        # 1) Updating Preview state does NOT overwrite live on-air CG layer until TAKE is clicked
        prev_res = c.put(f"/api/cg/preview/{lt['id']}", headers=h, json={
            'text': 'PREVIEW ONLY HEADLINE',
            'subtext': 'Preview Subheading',
            'position_x': 240,
            'position_y': 760,
            'width': 880,
            'height': 110,
            'z_index': 25,
            'color': '#06b6d4',
        })
        assert prev_res.status_code == 200, prev_res.text

        live_before_take = next(x for x in c.get('/api/cg', headers=h).json() if x['id'] == lt['id'])
        assert live_before_take['text'] == orig_text
        assert live_before_take['position_x'] == orig_x

        # 2) Clicking TAKE pushes Preview state to On-Air CG layer and activates it
        take_res = c.post(f"/api/cg/{lt['id']}/take", headers=h, json={})
        assert take_res.status_code == 200, take_res.text
        live_after_take = next(x for x in c.get('/api/cg', headers=h).json() if x['id'] == lt['id'])
        assert live_after_take['text'] == 'PREVIEW ONLY HEADLINE'
        assert live_after_take['position_x'] == 240
        assert live_after_take['active'] == 1

        # 3) Clicking CUT takes the layer off air
        cut_res = c.post(f"/api/cg/{lt['id']}/cut", headers=h)
        assert cut_res.status_code == 200 and cut_res.json()['active'] == 0

        # 4) Save & apply a CG Layout Preset
        preset_res = c.post('/api/cg/layout-presets', headers=h, json={'name': 'Music Prime Layout', 'description': 'Saved in test'})
        assert preset_res.status_code == 200
        pid = preset_res.json()['id']
        assert c.post(f'/api/cg/layout-presets/{pid}/apply', headers=h).status_code == 200

        # 5) Duplicate a CG layer and reset default layout
        dup_res = c.post(f"/api/cg/{lt['id']}/duplicate", headers=h)
        assert dup_res.status_code == 200
        dup_id = dup_res.json()['id']
        assert c.delete(f'/api/cg/{dup_id}', headers=h).status_code == 200
        assert c.post('/api/cg/layout/reset', headers=h).status_code == 200

        # 6) Verify adaptive collision avoidance and scaling across 360p, 480p, 720p, and 1080p
        from cg_templates_catalog import resolve_cg_collisions
        sample_layers = [
            {'id': 1, 'category': 'crawl', 'position_x': 0, 'position_y': 1034, 'width': 1920, 'height': 46, 'z_index': 21, 'effective_active': True},
            {'id': 2, 'category': 'ticker', 'position_x': 0, 'position_y': 982, 'width': 1920, 'height': 52, 'z_index': 20, 'effective_active': True},
            {'id': 3, 'category': 'lower_third', 'position_x': 80, 'position_y': 856, 'width': 820, 'height': 96, 'z_index': 15, 'effective_active': True},
            {'id': 4, 'category': 'music_now', 'position_x': 80, 'position_y': 856, 'width': 760, 'height': 108, 'z_index': 18, 'effective_active': True},
        ]
        for target_w, target_h in [(640, 360), (854, 480), (1280, 720), (1920, 1080)]:
            placed = resolve_cg_collisions(sample_layers, target_w, target_h)
            assert len(placed) == 4
            by_id = {p['id']: p for p in placed}
            lt_box = by_id[3]
            mus_box = by_id[4]
            assert lt_box['scaled_y'] + lt_box['scaled_h'] <= mus_box['scaled_y'] or mus_box['scaled_y'] + mus_box['scaled_h'] <= lt_box['scaled_y']


def test_websocket_subscription_notifications_and_ffmpeg_360p():
    with TestClient(main.app) as c:
        h = auth(c)
        token = h['Authorization'].replace('Bearer ', '')
        with c.websocket_connect(f'/ws?token={token}') as ws:
            initial = ws.receive_json()
            assert initial['type'] == 'state'
            c.post('/api/subscriptions/activate', headers=h, json={'plan': 'music_graphics_pro'})
            msg1 = ws.receive_json()
            assert msg1['type'] in ('subscription.changed', 'state')

        c.post('/api/settings', headers=h, json={'values': {'resolution': '360p', 'fps': '25', 'video_bitrate': '1500k'}})
        from db import SessionLocal
        with SessionLocal() as db:
            main.engine.sync_cg(db)
            args = main.engine.ffmpeg_args(db, None)
        import subprocess
        args = args[:-3] + ['-t', '0.35', '-f', 'null', '-']
        cp = subprocess.run(args, capture_output=True, text=True, timeout=45)
        assert cp.returncode == 0, cp.stderr[-2200:]


def test_enterprise_live_inputs_cg_timeline_and_protocol_outputs():
    with TestClient(main.app) as c:
        h = auth(c)
        # On Essential plan, live input streaming and cg_timeline are restricted
        c.put('/api/tenant/plan', headers=h, json={'plan': 'essential'})
        b_ess = c.get('/api/bootstrap', headers=h).json()
        assert b_ess['entitlements']['live_input_streaming'] is False
        assert b_ess['entitlements']['cg_timeline'] is False
        assert c.post('/api/inputs', headers=h, json={
            'name': 'Blocked Input',
            'protocol': 'rtmp',
            'url': 'rtmp://ingest.kashtrix.cloud/live/cam1',
        }).status_code == 403

        # Switch to Music & Graphics Pro -> live inputs and CG timeline are unlocked
        c.put('/api/tenant/plan', headers=h, json={'plan': 'music_graphics_pro'})
        b_pro = c.get('/api/bootstrap', headers=h).json()
        assert b_pro['entitlements']['live_input_streaming'] is True
        assert b_pro['entitlements']['cg_timeline'] is True
        assert 'system_telemetry' in b_pro and 'cpu_pct' in b_pro['system_telemetry']

        # Create & take a Live Input stream
        inputs_list = c.get('/api/inputs', headers=h).json()
        assert len(inputs_list) >= 1
        inp_id = inputs_list[0]['id']
        take_inp = c.post(f'/api/inputs/{inp_id}/take', headers=h)
        assert take_inp.status_code == 200 and take_inp.json()['engine']['live_input_id'] == inp_id

        stop_inp = c.post(f'/api/inputs/{inp_id}/stop', headers=h)
        assert stop_inp.status_code == 200 and stop_inp.json()['engine']['live_input_id'] is None

