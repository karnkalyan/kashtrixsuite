# Build React assets on an image that has access to npm registry.
FROM node:22-bookworm-slim AS frontend
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 CG_BROWSER_EXE=/usr/bin/chromium HOME=/app XDG_CACHE_HOME=/app/.cache
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg chromium fontconfig fonts-noto-core fonts-freefont-ttf ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY prisma/ ./prisma/
RUN mkdir -p /app/.cache && prisma generate --schema=./prisma/schema.prisma
COPY backend/ ./backend/
COPY assets/ ./assets/
COPY cgdemo/ ./cgdemo/
COPY --from=frontend /web/dist ./frontend/dist
RUN useradd -r -u 10001 -d /app -s /usr/sbin/nologin broadcaster && mkdir -p /app/data /app/.cache && chown -R broadcaster:broadcaster /app/data /app/.cache
USER broadcaster
EXPOSE 8000
CMD ["uvicorn","main:app","--app-dir","backend","--host","0.0.0.0","--port","8000","--workers","1"]
