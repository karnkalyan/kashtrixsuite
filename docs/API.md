# REST + realtime API overview

Base `/api`, bearer token after `POST /api/login`.

| Endpoint | Method | Purpose / role |
|---|---|---|
| `/api/login` | POST | username/password login |
| `/api/logout`, `/api/me`, `/api/bootstrap` | POST/GET | account session, role, snapshot |
| `/api/users` | GET/POST | team list/new user, admin |
| `/api/plans` | GET | plan definitions |
| `/api/tenant/plan` | PUT | change max outputs/storage, superadmin |
| `/api/media/upload` | POST | multipart video/image upload, editor |
| `/api/media/file/{id}` | GET | authorized media |
| `/api/media/thumb/{id}` | GET | authorized thumbnail |
| `/api/playlists`, `/api/playlist_items` | GET/POST/PUT/DELETE | playlist CMS, operator write |
| `/api/playlist-items/reorder` | POST | atomic reorder `{playlist_id, ids:[]}` |
| `/api/cg`, `/api/cg_templates`, `/api/cg_content` | GET/POST/PUT/DELETE | CG layers, reusable styles, editorial copy |
| `/api/schedules` | GET/POST/PUT/DELETE | programme, playlist, CG, CG-content events |
| `/api/outputs` | GET/POST/PUT/DELETE | credentials-masked RTMP/SRT/UDP destinations, admin |
| `/api/settings` | POST | resolution, FPS, bitrate, preset, fallback playlist, admin |
| `/api/control` | POST | start, stop, next, take, auto, restart; operator |
| `/ws?token=...` | WebSocket | realtime scoped snapshot updates |

Sample schedule:

```json
{"name":"Evening news","kind":"playlist","target_id":1,"starts_at":"2026-10-29T19:00:00+05:45","duration_sec":3600,"repeat":"daily","priority":80,"enabled":1}
```

Sample CG content:

```json
{"title":"Evening breaking headline","category":"breaking","text":"मुख्य समाचार","subtext":"काठमाडौँ","status":"draft"}
```

Sample encoder update:

```json
{"values":{"resolution":"720p","fps":"25","video_bitrate":"3500k","preset":"veryfast","base_playlist":"1"}}
```

Presets: 360p (640×360), 480p (854×480), 720p (1280×720), 1080p (1920×1080). Encoded layer design uses FFmpeg filter expressions and live text files; HTML preview is not equivalent to encoded pixels.
