"""
Real-time HTML5/React CG Overlay Compositor for Live Broadcast Streams.

Renders the exact 1920x1080 React CG overlays (templates, rich HTML, inline logos,
gradients, animations, breaking/flash/ticker bars) in headless Chrome/Playwright
with alpha transparency and streams PNG frames over a localhost TCP image2pipe
to FFmpeg so the streaming output matches the HTML5 broadcast monitor 1:1.
"""

from __future__ import annotations

import io
import json
import logging
import os
import shutil
import socket
import threading
import time
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image

log = logging.getLogger('kashtrix.cg_compositor')

ANIMATED_CATS = {
    'ticker', 'crawl', 'clock', 'flash_premium',
    'hebron_breaking', 'hebron_flash', 'hebron_crawl', 'hebron_ticker',
    'breaking', 'flash', 'breaking_full', 'breaking_split', 'breaking_3win',
    'logo_anim', 'live_anim',
}


def _make_blank_png() -> bytes:
    buf = io.BytesIO()
    Image.new('RGBA', (1280, 720), (0, 0, 0, 0)).save(buf, format='PNG', compress_level=1)
    return buf.getvalue()


BLANK_PNG = _make_blank_png()


def _find_browser_exe() -> str | None:
    for candidate in (
        os.getenv('CG_BROWSER_EXE', '').strip(),
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
        shutil.which('google-chrome') or '',
        shutil.which('chromium') or '',
        shutil.which('msedge') or '',
    ):
        if candidate and Path(candidate).exists():
            return candidate
    return None


def _pick_frontend_url(tenant_id: int, channel_id: int) -> str:
    for base in ('http://127.0.0.1:8000', 'http://127.0.0.1:5173'):
        try:
            with urllib.request.urlopen(base, timeout=1.0) as resp:
                if resp.status < 500:
                    return f'{base}/?cg_render=1&tenant={tenant_id}&channel={channel_id}'
        except Exception:
            continue
    return f'http://127.0.0.1:8000/?cg_render=1&tenant={tenant_id}&channel={channel_id}'


class HtmlCgCompositor:
    def __init__(self, tenant_id: int, channel_id: int):
        self.tenant_id = tenant_id
        self.channel_id = channel_id
        self._lock = threading.Lock()
        self._state_event = threading.Event()
        self._started = False
        self._available = False
        self._port: int | None = None
        self._srv_sock: socket.socket | None = None
        self._current_png: bytes = BLANK_PNG
        self._has_active: bool = False
        self._is_animated: bool = False
        self._state_payload: dict[str, Any] = {'cg': [], 'cg_content': [], 'server_time': ''}
        self._state_sig: str = ''
        self._fps: int = 30
        self._ready_event = threading.Event()

    def set_fps(self, fps: int):
        max_fps = int(os.getenv('CG_MAX_FPS', '15' if os.name != 'nt' else '30'))
        try:
            self._fps = max(12, min(max_fps, int(fps)))
        except (ValueError, TypeError):
            self._fps = min(max_fps, 25)

    def ensure_started(self) -> int | None:
        with self._lock:
            if self._started:
                return self._port if self._available else None
            self._started = True
        exe = _find_browser_exe()
        if not exe:
            log.warning('No Chrome/Edge executable found; falling back to drawtext CG.')
            self._ready_event.set()
            return None
        try:
            from playwright.sync_api import sync_playwright  # noqa: F401
        except Exception:
            log.warning('Playwright not available; falling back to drawtext CG.')
            self._ready_event.set()
            return None

        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(('127.0.0.1', 0))
        srv.listen(4)
        self._srv_sock = srv
        self._port = srv.getsockname()[1]
        self._available = True

        threading.Thread(target=self._tcp_accept_loop, daemon=True, name=f'cg-pipe-{self.tenant_id}-{self.channel_id}').start()
        threading.Thread(target=self._browser_loop, args=(exe,), daemon=True, name=f'cg-chrome-{self.tenant_id}-{self.channel_id}').start()
        self._ready_event.wait(timeout=6.0)
        return self._port if self._available else None

    def update_state(self, layers: list[dict[str, Any]], cg_content: list[dict[str, Any]], server_time: str):
        active = [l for l in layers if l.get('effective_active') and not l.get('hidden')]
        has_active = bool(active)
        is_anim = any(
            (l.get('category') in ANIMATED_CATS)
            or (l.get('animation') and l.get('animation') != 'none')
            for l in active
        )
        payload = {
            'cg': layers,
            'cg_content': cg_content,
            'server_time': server_time,
        }
        sig = json.dumps(
            {
                'active': [(l.get('id'), l.get('category'), l.get('text'), l.get('subtext'), l.get('position_x'), l.get('position_y'), l.get('width'), l.get('height'), l.get('bg_color'), l.get('text_color'), l.get('gradient'), l.get('font_family'), l.get('font_size'), l.get('opacity'), l.get('animation'), l.get('style_json'), l.get('content_id')) for l in active],
                'cnt': [(c.get('id'), c.get('text'), c.get('subtext'), c.get('status')) for c in cg_content],
            },
            sort_keys=True,
            default=str,
        )
        with self._lock:
            self._state_payload = payload
            self._has_active = has_active
            self._is_animated = is_anim
            if not has_active:
                self._current_png = BLANK_PNG
            if sig != self._state_sig:
                self._state_sig = sig
                self._state_event.set()

    def _tcp_accept_loop(self):
        assert self._srv_sock is not None
        while True:
            try:
                conn, _ = self._srv_sock.accept()
                threading.Thread(target=self._stream_client, args=(conn,), daemon=True).start()
            except OSError:
                break

    def _stream_client(self, conn: socket.socket):
        try:
            conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            next_send = time.monotonic()
            while True:
                frame_interval = 1.0 / max(12, self._fps)
                png = self._current_png
                conn.sendall(png)
                next_send += frame_interval
                now = time.monotonic()
                if next_send < now - 0.15:
                    next_send = now
                sleep_for = next_send - now
                if sleep_for > 0:
                    time.sleep(sleep_for)
        except OSError:
            pass
        finally:
            try:
                conn.close()
            except OSError:
                pass

    def _browser_loop(self, exe: str):
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    executable_path=exe,
                    headless=True,
                    args=['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
                )
                page = browser.new_page(viewport={'width': 1280, 'height': 720})
                cdp = page.context.new_cdp_session(page)
                cdp.send('Emulation.setDefaultBackgroundColorOverride', {'color': {'r': 0, 'g': 0, 'b': 0, 'a': 0}})
                url = _pick_frontend_url(self.tenant_id, self.channel_id)
                page.goto(url, wait_until='networkidle', timeout=15000)
                page.wait_for_function('() => typeof window.__setCgRenderState === "function"', timeout=10000)
                self._ready_event.set()
                last_sig = ''
                last_clock_push = 0.0
                import base64
                while True:
                    t0 = time.monotonic()
                    with self._lock:
                        has_active = self._has_active
                        is_anim = self._is_animated
                        payload = self._state_payload
                        sig = self._state_sig
                    if not has_active:
                        self._current_png = BLANK_PNG
                        last_sig = sig
                        self._state_event.wait(timeout=0.5)
                        self._state_event.clear()
                        continue
                    sig_changed = (sig != last_sig)
                    clock_due = (t0 - last_clock_push) >= 1.0
                    if sig_changed or is_anim:
                        try:
                            if sig_changed or clock_due:
                                page.evaluate('(st) => window.__setCgRenderState && window.__setCgRenderState(st)', payload)
                                last_clock_push = t0
                            if sig_changed:
                                page.evaluate('''() => Promise.all(
                                    Array.from(document.images).map(i =>
                                        i.complete ? Promise.resolve() : new Promise(r => { i.onload = r; i.onerror = r; setTimeout(r, 1500); })
                                    )
                                )''')
                                page.wait_for_timeout(60)
                            res = cdp.send('Page.captureScreenshot', {
                                'format': 'png',
                                'fromSurface': True,
                                'optimizeForSpeed': True,
                            })
                            b64 = res.get('data') if isinstance(res, dict) else None
                            if b64:
                                self._current_png = base64.b64decode(b64)
                            last_sig = sig
                        except Exception as exc:
                            log.debug('CG screenshot tick error: %s', exc)
                            time.sleep(0.15)
                    if is_anim:
                        frame_interval = 1.0 / max(12, self._fps)
                        elapsed = time.monotonic() - t0
                        if elapsed < frame_interval:
                            time.sleep(frame_interval - elapsed)
                    else:
                        self._state_event.wait(timeout=0.5)
                        self._state_event.clear()
        except Exception as exc:
            log.warning('HTML5 CG compositor stopped (%s); falling back to drawtext.', exc)
            self._available = False
            self._ready_event.set()


_COMPOSITORS: dict[tuple[int, int], HtmlCgCompositor] = {}
_COMPOSITORS_LOCK = threading.Lock()


def get_cg_compositor(tenant_id: int, channel_id: int) -> HtmlCgCompositor:
    key = (int(tenant_id), int(channel_id))
    with _COMPOSITORS_LOCK:
        comp = _COMPOSITORS.get(key)
        if comp is None:
            comp = HtmlCgCompositor(int(tenant_id), int(channel_id))
            _COMPOSITORS[key] = comp
        return comp

