#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .env ]]; then echo "Copy ../.env.example to .env and configure your secrets."; exit 1; fi
docker compose --env-file .env up -d --build
docker compose ps
