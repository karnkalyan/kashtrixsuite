"""Actual host / VPS hardware telemetry and installed system + project font discovery."""

from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
import time
from pathlib import Path

try:
    import psutil  # type: ignore
except ImportError:
    psutil = None

ROOT = Path(__file__).resolve().parent.parent

_STATIC_HW_CACHE: dict | None = None
_FONTS_CACHE: tuple[float, dict] | None = None


def _get_cpu_model() -> str:
    if platform.system() == 'Windows':
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r'HARDWARE\DESCRIPTION\System\CentralProcessor\0',
            )
            val, _ = winreg.QueryValueEx(key, 'ProcessorNameString')
            winreg.CloseKey(key)
            if val:
                return str(val).strip()
        except Exception:
            pass
    else:
        try:
            cpuinfo = Path('/proc/cpuinfo')
            if cpuinfo.exists():
                for line in cpuinfo.read_text('utf-8', errors='ignore').splitlines():
                    if 'model name' in line:
                        return line.split(':', 1)[1].strip()
        except Exception:
            pass
    return platform.processor() or platform.machine() or 'x86_64 Processor'


def _get_gpu_name() -> str:
    try:
        r = subprocess.run(
            ['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'],
            capture_output=True, text=True, timeout=2,
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip().splitlines()[0].strip()
    except Exception:
        pass
    if platform.system() == 'Windows':
        try:
            r = subprocess.run(
                ['powershell', '-NoProfile', '-Command', '(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join ", "'],
                capture_output=True, text=True, timeout=3,
            )
            if r.returncode == 0 and r.stdout.strip():
                return r.stdout.strip()
        except Exception:
            pass
    return 'Integrated / Virtual Display Adapter'


def get_hardware_info() -> dict:
    global _STATIC_HW_CACHE
    if _STATIC_HW_CACHE is None:
        _STATIC_HW_CACHE = {
            'hostname': platform.node(),
            'os': f'{platform.system()} {platform.release()} ({platform.machine()})',
            'cpu_model': _get_cpu_model(),
            'gpu': _get_gpu_name(),
            'cpu_cores': (psutil.cpu_count(logical=False) if psutil else None) or os.cpu_count() or 1,
            'cpu_threads': (psutil.cpu_count(logical=True) if psutil else None) or os.cpu_count() or 1,
        }

    disk = shutil.disk_usage(ROOT)
    disk_total_gb = round(disk.total / (1024 ** 3), 1)
    disk_used_gb = round(disk.used / (1024 ** 3), 1)
    disk_free_gb = round(disk.free / (1024 ** 3), 1)
    disk_pct = round((disk.used / disk.total) * 100, 1) if disk.total else 0.0

    if psutil is not None:
        vm = psutil.virtual_memory()
        ram_total_gb = round(vm.total / (1024 ** 3), 1)
        ram_used_gb = round(vm.used / (1024 ** 3), 1)
        ram_free_gb = round(vm.available / (1024 ** 3), 1)
        ram_pct = round(vm.percent, 1)
        cpu_pct = round(psutil.cpu_percent(interval=None), 1)
        freq = psutil.cpu_freq()
        cpu_mhz = round(freq.current, 0) if freq else None
        boot_uptime_sec = int(max(0, time.time() - psutil.boot_time()))
    else:
        ram_total_gb = 8.0
        ram_used_gb = 2.0
        ram_free_gb = 6.0
        ram_pct = 25.0
        cpu_pct = 10.0
        cpu_mhz = None
        boot_uptime_sec = 0

    return {
        **_STATIC_HW_CACHE,
        'cpu_pct': cpu_pct,
        'cpu_mhz': cpu_mhz,
        'ram_total_gb': ram_total_gb,
        'ram_used_gb': ram_used_gb,
        'ram_free_gb': ram_free_gb,
        'ram_pct': ram_pct,
        'disk_total_gb': disk_total_gb,
        'disk_used_gb': disk_used_gb,
        'disk_free_gb': disk_free_gb,
        'disk_pct': disk_pct,
        'boot_uptime_sec': boot_uptime_sec,
        'python_version': platform.python_version(),
    }


def _clean_font_name(raw_name: str) -> str:
    name = re.sub(r'\s*\((TrueType|OpenType|All res)\)\s*$', '', raw_name, flags=re.IGNORECASE).strip()
    name = re.sub(r'\s+(Bold|Italic|Light|Medium|SemiBold|Black|Regular|Thin)(\s+(Italic|Oblique))?$', '', name, flags=re.IGNORECASE).strip()
    return name


def get_available_fonts() -> dict:
    global _FONTS_CACHE
    now = time.monotonic()
    if _FONTS_CACHE is not None and (now - _FONTS_CACHE[0]) < 120:
        return _FONTS_CACHE[1]

    project_folders = [
        str(ROOT / 'cgdemo' / 'fonts'),
        str(ROOT / 'data' / 'fonts'),
    ]
    project_fonts: list[dict] = []
    seen_proj: set[str] = set()
    for folder_str in project_folders:
        folder = Path(folder_str)
        if not folder.exists():
            continue
        for f in sorted(folder.iterdir()):
            if f.suffix.lower() in ('.ttf', '.otf', '.woff', '.woff2'):
                fam = f.stem.replace('_', ' ').replace('-', ' ').strip()
                if fam.lower() not in seen_proj:
                    seen_proj.add(fam.lower())
                    project_fonts.append({'family': fam, 'file': f.name, 'folder': str(folder)})

    system_fonts: list[str] = []
    seen_sys: set[str] = set()
    if platform.system() == 'Windows':
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts',
            )
            idx = 0
            while True:
                try:
                    name, _val, _typ = winreg.EnumValue(key, idx)
                    idx += 1
                    fam = _clean_font_name(name)
                    if fam and not fam.startswith('@') and fam.lower() not in seen_sys:
                        seen_sys.add(fam.lower())
                        system_fonts.append(fam)
                except OSError:
                    break
            winreg.CloseKey(key)
        except Exception:
            pass
        if not system_fonts:
            win_fonts = Path('C:/Windows/Fonts')
            if win_fonts.exists():
                for f in sorted(win_fonts.iterdir()):
                    if f.suffix.lower() in ('.ttf', '.otf', '.ttc'):
                        fam = _clean_font_name(f.stem)
                        if fam and fam.lower() not in seen_sys:
                            seen_sys.add(fam.lower())
                            system_fonts.append(fam)
    else:
        try:
            r = subprocess.run(['fc-list', ':', 'family'], capture_output=True, text=True, timeout=4)
            if r.returncode == 0:
                for line in r.stdout.splitlines():
                    fam = line.split(',')[0].strip()
                    if fam and fam.lower() not in seen_sys:
                        seen_sys.add(fam.lower())
                        system_fonts.append(fam)
        except Exception:
            pass

    system_fonts.sort(key=lambda s: s.lower())
    data = {
        'project_folders': project_folders,
        'system_folder': 'C:\\Windows\\Fonts' if platform.system() == 'Windows' else '/usr/share/fonts',
        'project_fonts': project_fonts,
        'system_fonts': system_fonts,
    }
    _FONTS_CACHE = (now, data)
    return data

