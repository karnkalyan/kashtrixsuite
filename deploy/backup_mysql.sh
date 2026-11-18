#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
OUT="backups/kashtrix-$(date +%Y%m%d-%H%M%S).sql"
docker compose --env-file .env exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --single-transaction --routines kashtrix' > "$OUT"
echo "Saved $OUT. Also back up the app_data Docker volume holding media files."
