# Kashtrix Broadcast Suite v2 — MySQL Edition

React + Vite control room • FastAPI backend • MySQL 8.4 • FFmpeg • MediaMTX • WebSocket • Caddy.

**This is runnable application source, intended as a full-stack engineering baseline for one channel on one VPS. It is not a broadcaster-certified, seamless 24/7 automation product.** It was tested using SQLite as the isolated test database because a MySQL service and external registries are not available in the authoring environment. Docker/MySQL production integration, React's actual Vite build and uninterrupted 24/7 streaming must be verified on your machine. Do not put it directly on air before acceptance testing.

## Modules and capabilities

| Module | What is in this codebase |
|---|---|
| Identity | Tenants, tenant-associated users, admin/editor/operator/viewer role checks, hashed passwords, revocable session tokens |
| Media CMS | Media upload (validated by ffprobe), files and metadata in MySQL, storage quotas, protected file retrieval |
| Playlists | Create/edit/delete, drag/reorder API, automatic rotation, fallback slate |
| Playout | Start/stop/next/TAKE/AUTO, scheduled programmes override rotation, FFmpeg H.264/AAC encoder |
| Scheduler | One-off, daily, weekly media/playlist and CG/CMS events, priorities and Asia/Kathmandu local-time interpretation |
| CG overlays | Logo, sponsor, scroll, ticker, lower-third, name strap, breaking, flash, update, clock, quote, headline, promo, now-next |
| CG editor | Live text changes, color, scroll speed, basic animations, image logo/sponsor, reusable template records |
| Editorial CMS | Draft, approved, published and live content records, editorial categories, link published content to live CG layers |
| Outputs | Up to 8 RTMP/RTMPS, SRT or UDP destinations from a single encode, independent stream-copy workers and retries |
| Profiles | 360p, 480p, 720p, 1080p; 24/25/30 FPS; bitrate and libx264 presets, adjustable by admin |
| Web embed | Static HLS player at `/embed.html` and shareable iframe markup; external CDN recommended for viewers |
| Observability | Realtime WebSocket snapshots, playout state, audit log and encoder PID |
| VPS deployment | 4-service Compose stack, MySQL volume, app volume, internal MediaMTX, HTTP reverse proxy |

### Architecture

```
  Browser / React UI -------- HTTPS proxy ---------- FastAPI API / WebSocket
                                                       |
                                                     MySQL
                                                       |
                                       playlist + CG scheduler + FFmpeg
                                                       |
                                             RTMP local origin
                                                       |
                                                    MediaMTX
                                  +--------------------+--------------------+
                                  |                    |                    |
                               HLS player       FFmpeg stream copy     (up to 8)
                                                     RTMP / SRT / UDP
```

> **SaaS design note:** All important tables are tenant-scoped and users have scoped roles; the included broadcast worker is **one active channel per deployment**. Real multi-tenant, concurrent-channel SaaS hosting requires a separate worker/media pipeline and process lifecycle for every active channel, billing/subscriptions, per-tenant storage isolation, and distributed orchestration. Those are **not fully implemented** in v2.

## VPS deployment, with MySQL

**Prerequisites:** Ubuntu 22.04/24.04, Docker Engine + Docker Compose plugin, Internet access to pull images and npm/pip dependencies; a 6–8 performant-vCPU / 12–16 GB VPS recommended for first 1080p testing. Confirm CPU encoder speed and bandwidth with a real CG and schedule workload. The 8 destinations copy the same encoded stream, but output bandwidth scales with count.

```bash
# In the extracted project root:
cp .env.example deploy/.env
# EDIT deploy/.env: strong unique MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, ADMIN_PASSWORD.
# Keep MYSQL_PASSWORD URL-safe (letters, numbers, underscore, hyphen) for the database URL.

cd deploy
./start.sh
# Browser: http://YOUR_SERVER_IP:8080 (development / trusted access only)
# Login: admin + ADMIN_PASSWORD
```

The first boot seeds the tenant/channel, 14 CG templates/layers, 24/7 rotation playlist, and admin user. MySQL credentials and admin credentials live **only** in `deploy/.env`. The system runs in **dry-run mode by default**, so it does not stream to external destinations immediately.

To switch to real output (only after readiness tests), modify `PLAYOUT_DRY_RUN=0` in `deploy/.env` and recreate the `app` service. **The engine automatically starts on boot** (including any previously enabled relays); do not enable live mode until destination keys and test streams are ready. FFmpeg will publish to MediaMTX, which serves `/hls/channel1/index.m3u8`. Configure a stream destination in the UI (RTMP/RTMPS, SRT caller, UDP unicast) and enable it. Website player: `http://YOUR_SERVER_IP:8080/embed.html`.

**Security:** HTTP :8080 is a development example. Put HTTPS in front of Caddy with a real domain and secure the operator UI using VPN, restricted IPs or SSO. Do not expose MySQL or MediaMTX ports publicly. Rotate tokens/passwords and back up the MySQL database and `app_data` media volume. Disable public `/embed.html` if distribution is not required.

## Local development (MySQL required for actual operation)

```bash
# Run MySQL separately, create UTF8MB4 database/user, set DATABASE_URL
export DATABASE_URL='mysql+pymysql://kashtrix:URL_SAFE_PASSWORD@127.0.0.1:3306/kashtrix?charset=utf8mb4'
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD='REPLACE-WITH-SECURE-PASSWORD'
export PLAYOUT_DRY_RUN=1
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --workers 1
# second terminal
cd frontend && npm install && npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api`, `/ws`, and `/hls` to the backend/MediaMTX.

## Operational conventions

1. Upload a media clip from **Media Library** and add it to a playlist.
2. In **Settings**, assign that playlist as the 24/7 fallback, choose resolution/fps/bitrate.
3. In **Scheduler**, add daily/weekly playlist or programme blocks. A schedule takes precedence over the normal rotation.
4. In **Content CMS**, create news copy, approve it, then **Publish & TAKE** to link to a category layer.
5. In **CG Studio**, edit animated layers, template style, speed and logo media. CG schedule events can activate overlays independently of video playback.
6. In **Streaming**, add URLs and enable only the desired remote destinations. Sensitive stream keys are masked in responses.
7. Verify the actual HLS output, not just the HTML design preview, and check CPU, bitrate, video/audio synchronization and continuity.

### Streaming bandwidth example

At 5 Mbps per output, 8 continuously active streams consume approximately 40 Mbps outgoing, or **12.96 TB per 30 days**, before audio and overhead. This is **not** the total audience CDN traffic. Do not assume an advertised "unlimited" VPS port permits that volume under fair-use rules. Streaming relays are remote destination URL publishers, not browser viewer fan-out.

## Backend verification

The test suite uses an isolated temporary **SQLite database exclusively for tests**. This avoids requiring MySQL for unit/HTTP tests; it does **not** prove production MySQL operation.

```bash
python -m pytest -q tests/test_backend.py
python -m py_compile backend/*.py
```

The frontend uses React 19, Vite 6 and HLS.js. Dependencies are not included in the ZIP. `npm install` on an Internet-connected host (or Docker build) is required. Source JSX syntax was parsed using TypeScript's TSX parser; a production npm/Vite build was not possible in the current offline environment.

## Known engineering limitations before commercial on-air use

- **Non-seamless source switching.** FFmpeg publisher restarts between files/forced transitions; outputs can briefly drop/reconnect. For zero-gap broadcast, replace this with a continuous media switching pipeline (e.g., GStreamer/CasparCG-compatible renderer or dedicated playout compositor), normalized source timing and audio format, a proper ingest queue and end-to-end soak tests.
- **HTML/CSS artwork is the operator preview.** Encoded output uses FFmpeg text and image filters, basic motion, simple rectangular graphic zones, not pixel-identical 3D glossy reference CG. Complex HTML CG compositing needs a renderer with alpha/key and testing under CPU-only VPS.
- **Animation control limitations.** Text reload is live. Changes in image/position/animation/filter parameters may restart the encoder. Video frame-perfect TAKE/CUT is not provided.
- **SaaS lifecycle incomplete.** Plan records/quotas and roles exist, but payment subscriptions, tenant self-service signup and multi-channel orchestration are future integrations.
- **No automatic database migration framework.** SQLAlchemy creates initial tables at boot; upgrade an existing schema with reviewed migrations. Reference DDL is included under `deploy/mysql_schema_reference.sql`.
- **HA not included.** No active-standby playout, offsite replication, dual origin, 24/7 NOC integration, or transcoding ladder.
- **MySQL/React build not executed here.** The environment has no MySQL server, Docker daemon or npm/PyPI registry connectivity.

## Project layout

```
backend/db.py        SQLAlchemy models and MySQL engine
backend/security.py  Login/session/role handling
backend/engine.py    Scheduler, CG textfiles, encoder and relay processes
backend/main.py      FastAPI routes / WebSocket / SPA hosting
frontend/src/        Modern React control room and CG CMS
frontend/public/     Broadcast styling assets and website player
deploy/              Docker Compose, MediaMTX, Caddy, MySQL DDL
assets/              Reference artwork, official Simulcast logo, demo clip
tests/               Auth, roles, CMS, schedules, encoder tests
```

Simulcast Technologies Pvt. Ltd. • Kashtrix Broadcast Suite • October 2026

Additional references: `docs/API.md`, `docs/VERIFICATION.md`, `docs/design/` (7 separate application UI mockups), and `assets/cg-template-reference.png` (the user-provided broadcast graphics design reference). These images are visual references; the runtime CG implementation uses FFmpeg filters.

Use `cd deploy && ./backup_mysql.sh` for a database backup. Media files live separately in Docker's `app_data` volume and must also be backed up.
