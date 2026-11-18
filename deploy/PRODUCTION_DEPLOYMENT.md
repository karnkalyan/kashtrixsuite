# Kashtrix Broadcast Suite — Production VPS Deployment Guide

This guide deploys **Kashtrix Broadcast Suite** on your Linux VPS using Docker, reusing your existing `kisan-mysql` (`mysql:8.0`) container with a dedicated `kashtrix_broadcast` database.

> **Why `kashtrix_broadcast` (underscore)?** MySQL, SQLAlchemy, and Prisma accept underscores in database names without backtick quoting in connection URLs.

---

## 1. SSH into your VPS & Clone the Repository

```bash
ssh root@YOUR_VPS_IP
git clone https://github.com/karnkalyan/kashtrixsuite.git /opt/kashtrixsuite
cd /opt/kashtrixsuite
```

*(If Docker is not installed yet:)*
```bash
apt update && apt install -y git curl
curl -fsSL https://get.docker.com | sh
```

---

## 2. Create the `kashtrix_broadcast` Database in `kisan-mysql`

Run this on your VPS to create the database inside your existing `kisan-mysql` container:

```bash
docker exec -it kisan-mysql mysql -uroot -p'!sP!ssw0rd#!2323#$' -e "CREATE DATABASE IF NOT EXISTS kashtrix_broadcast CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Verify the database exists:
```bash
docker exec -it kisan-mysql mysql -uroot -p'!sP!ssw0rd#!2323#$' -e "SHOW DATABASES;"
```

---

## 3. Find Your Existing `kisan-mysql` Docker Network Name

```bash
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' kisan-mysql
```

Copy the exact network name printed (for example: `kisan_app-network` or `app-network`). You will use it in Step 5.

---

## 4. Create `deploy/.env`

```bash
cat > /opt/kashtrixsuite/deploy/.env <<'EOF'
ADMIN_USERNAME=admin
ADMIN_PASSWORD=KashtrixAdmin2026!
TENANT_NAME=Hebron TV Broadcast
TENANT_PLAN=broadcast_plus
PLAYOUT_DRY_RUN=0
WEB_PORT=8080
ALLOWED_ORIGINS=http://YOUR_VPS_IP:8080,https://yourdomain.com
MAX_UPLOAD_GB=10
ALLOW_PRIVATE_OUTPUTS=1
EOF
```

> Replace `YOUR_VPS_IP` / `yourdomain.com` and set a strong `ADMIN_PASSWORD` (minimum 12 characters).

---

## 5. Configure `deploy/docker-compose.yml` to Use `kisan-mysql`

Replace `YOUR_KISAN_NETWORK_NAME` below with the network name from Step 3:

```bash
cat > /opt/kashtrixsuite/deploy/docker-compose.yml <<'EOF'
name: kashtrix-broadcast
services:
  mediamtx:
    image: bluenviron/mediamtx:1
    restart: unless-stopped
    volumes:
      - ./mediamtx.yml:/mediamtx.yml:ro
    networks: [internal]

  app:
    build:
      context: ..
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: "mysql+pymysql://root:%21sP%21ssw0rd%23%212323%23%24@kisan-mysql:3306/kashtrix_broadcast?charset=utf8mb4"
      PRISMA_DATABASE_URL: "mysql://root:%21sP%21ssw0rd%23%212323%23%24@kisan-mysql:3306/kashtrix_broadcast"
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?Set ADMIN_PASSWORD in .env}
      TENANT_NAME: ${TENANT_NAME:-My TV Channel}
      TENANT_PLAN: ${TENANT_PLAN:-broadcast_plus}
      PLAYOUT_DRY_RUN: ${PLAYOUT_DRY_RUN:-0}
      DATA_DIR: /app/data
      INGEST_URL: rtmp://mediamtx:1935/channel1
      SOURCE_URL: rtmp://mediamtx:1935/channel1
      HLS_ORIGIN: http://mediamtx:8888
      BROADCAST_TZ: Asia/Kathmandu
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-http://localhost:8080}
      MAX_UPLOAD_GB: ${MAX_UPLOAD_GB:-10}
      ALLOW_PRIVATE_OUTPUTS: ${ALLOW_PRIVATE_OUTPUTS:-1}
    volumes:
      - app_data:/app/data
    depends_on:
      mediamtx: { condition: service_started }
    networks: [internal, kisan_net]

  caddy:
    image: caddy:2.9
    restart: unless-stopped
    ports:
      - '${WEB_PORT:-8080}:80'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    depends_on: [app, mediamtx]
    networks: [internal]

volumes:
  app_data:

networks:
  internal:
  kisan_net:
    external: true
    name: YOUR_KISAN_NETWORK_NAME
EOF
```

---

## 6. Build, Push Database Schema & Start

```bash
cd /opt/kashtrixsuite/deploy
docker compose --env-file .env up -d --build
```

Push the Prisma schema into `kashtrix_broadcast` and restart `app` once so initial tenant, admin user, and CG templates seed cleanly:

```bash
docker compose exec app prisma db push --schema=./prisma/schema.prisma
docker compose restart app
```

---

## 7. Open Firewall & Verify

```bash
ufw allow 8080/tcp
# If using port 80 / 443 with a domain:
# ufw allow 80/tcp
# ufw allow 443/tcp
```

Verify all containers and health endpoint:
```bash
docker compose ps
curl http://127.0.0.1:8080/api/health
docker compose logs -f app
```

Open `http://YOUR_VPS_IP:8080/` in your browser and sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

---

## 8. Optional: Custom Domain + Automatic HTTPS (SSL)

1. Point your domain's DNS `A` record to `YOUR_VPS_IP`.
2. In `deploy/.env`, set `WEB_PORT=80` and add `https://yourdomain.com` to `ALLOWED_ORIGINS`.
3. In `deploy/docker-compose.yml` under `caddy.ports`, add `- '443:443'` and mount `- caddy_data:/data` under `caddy.volumes` (and `caddy_data:` under top-level `volumes:`).
4. In `deploy/Caddyfile`, replace `:80 {` with `yourdomain.com {`.
5. Restart Caddy:
   ```bash
   cd /opt/kashtrixsuite/deploy
   docker compose --env-file .env up -d
   ```

---

## 9. Updating from GitHub Later

```bash
cd /opt/kashtrixsuite
git pull origin main
cd deploy
docker compose --env-file .env up -d --build
```
