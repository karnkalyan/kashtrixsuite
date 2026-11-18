# Verification Report — Kashtrix Broadcast Suite v2 (Subscriptions, APScheduler, Prisma ORM, MySQL & Local MediaMTX)

Date: 29 October 2026

## Results

- ✅ **Prisma ORM + MySQL 8 Persistence (19 Models)**: `prisma/schema.prisma` defines all 19 MySQL models (`Tenant`, `SubscriptionPlan`, `PlanEntitlement`, `TenantSubscription`, `SubscriptionHistory`, `ResourceUsage`, `User`, `SessionToken`, `Channel`, `Media`, `Playlist`, `PlaylistItem`, `CGTemplate`, `CGContent`, `CG`, `Schedule`, `Output`, `Setting`, `Audit`) pushed to `mysql://root:@127.0.0.1:3306/kashtrix` (`prisma db push`).
- ✅ **Five NPR Subscription Plans & Centralized Backend Entitlements**:
  - **Essential** (NPR 15,000/mo — 4 vCPU, 8 GB RAM, 150 GB NVMe, 2 RTMP/RTMPS outputs, logo + ticker, video scheduling)
  - **Growth** (NPR 20,000/mo — 4 vCPU, 8 GB RAM, 150 GB NVMe, 3 RTMP/RTMPS outputs, sponsor + crawl + lower third + name strap, basic CMS, CG scheduling)
  - **News Pro** (NPR 25,000/mo — 6 vCPU, 12 GB RAM, 300 GB NVMe, 4 outputs incl. SRT/UDP, breaking/flash/update/clock/quote/headline, full CMS + workflow + custom templates)
  - **Digital 360** (NPR 30,000/mo — 6 vCPU, 12 GB RAM, 300 GB NVMe, 5 outputs incl. YouTube/Facebook/HLS origin, now_next, website HTML iframe embed player)
  - **Broadcast Plus** (NPR 45,000/mo — 8 vCPU, 24 GB RAM, 450 GB NVMe, 8 outputs, all 14 CG categories incl. promo, enterprise CMS, advanced scheduling)
  - Safe plan downgrade preserves user configuration while disabling excess outputs and unentitled active CG layers without restarting the main programme encoder.
- ✅ **APScheduler Integration (`Asia/Kathmandu`)**: `backend/scheduler_service.py` replaces the 1-second MySQL polling loop with a single `BackgroundScheduler`, supporting one-time, daily, and weekly video/playlist and CG schedules, pause/resume, automatic restoration after restart, and non-interrupting timed CG overlays (`duration_sec` auto-cut via `reload=1`).
- ✅ **Realtime WebSocket Events**: Emits scoped, authenticated events (`subscription.changed`, `entitlements.updated`, `playout.status`, `playlist.updated`, `schedule.created`, `schedule.updated`, `schedule.triggered`, `cg.activated`, `cg.updated`, `cg.deactivated`, `stream.status`, `media.uploaded`, `system.health`, and `state`).
- ✅ **Enhanced Media Library & Quick Play/Stop Graphics**:
  - Upload Media modal with multi-file drag-and-drop, progress bar, folder & category organization, FFprobe metadata extraction, inline preview, rename, `+ Playlist`, and `Schedule` actions.
  - Direct **Play / Stop** buttons inside every row of the Graphics layers list in both **Overview** and **CG Studio**.
  - Normal/medium live video preview container sizing (`max-width: 560px; max-height: 315px`).
- ✅ **Automated Test Suite (`pytest`)**: `tests/test_backend.py` passed (`6 passed in 26.01s`) covering all 5 plans, 2/3/4/5/8 output limits, safe downgrade, unauthorized feature rejection, APScheduler video & CG execution, WebSocket subscription notifications, 360p FFmpeg filtergraph, and real media ingest/folders/rename.
- ✅ **Frontend Build (`vite build`)**: Built cleanly in `frontend/dist` with zero errors.
