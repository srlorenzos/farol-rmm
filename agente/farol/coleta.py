"""Coleta de métricas (a cada check-in) e inventário (a cada hora)."""
from __future__ import annotations

import logging
import platform
import shutil
import socket
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

import psutil

from . import VERSAO
from .config import WINDOWS, _host_local

log = logging.getLogger("farol")


def _ler(caminho: str) -> str | None:
    try:
        return Path(caminho).read_text(encoding="utf-8", errors="replace").strip() or None
    except OSError:
        return None


def _winreg_valor(chave: str, nome: str, raiz=None):
    import winreg
    try:
        with winreg.OpenKey(raiz or winreg.HKEY_LOCAL_MACHINE, chave) as k:
            return winreg.QueryValueEx(k, nome)[0]
    except OSError:
        return None


def versao_so() -> str:
    if WINDOWS:
        base = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion"
        nome = _winreg_valor(base, "ProductName") or f"Windows {platform.release()}"
        build = _winreg_valor(base, "CurrentBuildNumber") or ""
        exibicao = _winreg_valor(base, "DisplayVersion") or ""
        if build.isdigit() and int(build) >= 22000:
            nome = nome.replace("Windows 10", "Windows 11")
        return " ".join(p for p in (nome, exibicao, f"(build {build})" if build else "") if p)
    os_release = _ler("/etc/os-release") or ""
    for linha in os_release.splitlines():
        if linha.startswith("PRETTY_NAME="):
            return linha.split("=", 1)[1].strip('"')
    return f"{platform.system()} {platform.release()}"


def info_basica(capacidades: list[str] | None = None) -> dict:
    info = {
        "hostname": socket.gethostname(),
        "so": platform.system(),
        "so_versao": versao_so()[:255],
        "arquitetura": platform.machine(),
        "versao_agente": VERSAO,
    }
    if capacidades is not None:
        info["capacidades"] = capacidades[:300]
    return info


def ip_local(servidor: str | None = None) -> str | None:
    """Descobre o IP da interface usada para falar com o servidor (UDP não envia pacotes)."""
    host = urllib.parse.urlsplit(servidor).hostname if servidor else None
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect((host if host and not _host_local(host) else "192.0.2.1", 80))
            return s.getsockname()[0]
    except OSError:
        pass
    for enderecos in psutil.net_if_addrs().values():
        for e in enderecos:
            if e.family == socket.AF_INET and not e.address.startswith("127."):
                return e.address
    return None


def coletar_discos() -> list[dict]:
    discos = []
    vistos = set()
    for p in psutil.disk_partitions(all=False):
        if not p.fstype or "cdrom" in p.opts or p.mountpoint in vistos:
            continue
        if p.fstype in ("squashfs", "tmpfs", "devtmpfs", "overlay"):
            continue
        try:
            u = psutil.disk_usage(p.mountpoint)
        except (OSError, PermissionError):
            continue
        vistos.add(p.mountpoint)
        discos.append({"ponto": p.mountpoint, "fs": p.fstype, "total": u.total, "usado": u.used, "pct": round(u.percent, 1)})
    return discos


def coletar_metricas(servidor: str | None = None, intervalo_cpu: float | None = None) -> dict:
    mem = psutil.virtual_memory()
    try:
        usuarios = psutil.users()
        usuario = usuarios[0].name if usuarios else None
    except Exception:  # alguns ambientes (containers) não expõem sessões
        usuario = None
    return {
        "cpu": round(min(100.0, max(0.0, psutil.cpu_percent(interval=intervalo_cpu))), 1),
        "ram_usada": mem.total - mem.available,
        "ram_total": mem.total,
        "discos": coletar_discos(),
        "uptime": int(time.time() - psutil.boot_time()),
        "usuario": usuario,
        "ip": ip_local(servidor),
    }


def _hardware() -> dict:
    hw = {
        "cpu_modelo": None,
        "nucleos_fisicos": psutil.cpu_count(logical=False),
        "nucleos_logicos": psutil.cpu_count(logical=True),
        "ram_total": psutil.virtual_memory().total,
        "fabricante": None,
        "modelo": None,
        "serial": None,
    }
    if WINDOWS:
        hw["cpu_modelo"] = (_winreg_valor(r"HARDWARE\DESCRIPTION\System\CentralProcessor\0", "ProcessorNameString") or "").strip() or None
        bios = r"HARDWARE\DESCRIPTION\System\BIOS"
        hw["fabricante"] = _winreg_valor(bios, "SystemManufacturer")
        hw["modelo"] = _winreg_valor(bios, "SystemProductName")
    else:
        for linha in (_ler("/proc/cpuinfo") or "").splitlines():
            if linha.lower().startswith(("model name", "hardware")):
                hw["cpu_modelo"] = linha.split(":", 1)[1].strip()
                break
        hw["fabricante"] = _ler("/sys/class/dmi/id/sys_vendor")
        hw["modelo"] = _ler("/sys/class/dmi/id/product_name")
        hw["serial"] = _ler("/sys/class/dmi/id/product_serial")  # só legível como root
    hw["cpu_modelo"] = hw["cpu_modelo"] or platform.processor() or None
    return hw


def _rede() -> list[dict]:
    estados = psutil.net_if_stats()
    interfaces = []
    for nome, enderecos in psutil.net_if_addrs().items():
        item = {"nome": nome, "mac": None, "ipv4": [], "ipv6": [], "ativa": False, "velocidade_mbps": None}
        for e in enderecos:
            if e.family == socket.AF_INET:
                item["ipv4"].append(e.address)
            elif e.family == getattr(socket, "AF_INET6", None):
                item["ipv6"].append(e.address.split("%")[0])
            elif e.family == psutil.AF_LINK:
                item["mac"] = e.address.replace("-", ":").upper()
        if st := estados.get(nome):
            item["ativa"] = st.isup
            item["velocidade_mbps"] = st.speed or None
        interfaces.append(item)
    return interfaces[:128]


def _softwares_windows() -> list[dict]:
    import winreg
    caminho = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
    origens = [
        (winreg.HKEY_LOCAL_MACHINE, winreg.KEY_WOW64_64KEY),
        (winreg.HKEY_LOCAL_MACHINE, winreg.KEY_WOW64_32KEY),
        (winreg.HKEY_CURRENT_USER, 0),
    ]
    vistos, lista = set(), []
    for raiz, vista in origens:
        try:
            chave = winreg.OpenKey(raiz, caminho, 0, winreg.KEY_READ | vista)
        except OSError:
            continue
        with chave:
            for i in range(winreg.QueryInfoKey(chave)[0]):
                try:
                    sub = winreg.EnumKey(chave, i)
                    with winreg.OpenKey(chave, sub) as k:
                        def valor(n):
                            try:
                                return winreg.QueryValueEx(k, n)[0]
                            except OSError:
                                return None
                        nome = valor("DisplayName")
                        if not nome or valor("SystemComponent") == 1 or valor("ParentKeyName"):
                            continue
                        item = {
                            "nome": str(nome).strip(),
                            "versao": str(valor("DisplayVersion") or "").strip() or None,
                            "fabricante": str(valor("Publisher") or "").strip() or None,
                            "instalado_em": str(valor("InstallDate") or "").strip() or None,
                        }
                except OSError:
                    continue
                if (item["nome"], item["versao"]) not in vistos:
                    vistos.add((item["nome"], item["versao"]))
                    lista.append(item)
    return lista


def _softwares_linux() -> list[dict]:
    comandos = []
    if shutil.which("dpkg-query"):
        comandos.append(["dpkg-query", "-W", "-f=${Package}\t${Version}\t${Maintainer}\n"])
    if shutil.which("rpm"):
        comandos.append(["rpm", "-qa", "--qf", "%{NAME}\t%{VERSION}-%{RELEASE}\t%{VENDOR}\n"])
    lista = []
    for cmd in comandos:
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.SubprocessError):
            continue
        for linha in r.stdout.splitlines():
            partes = linha.split("\t")
            if partes and partes[0]:
                lista.append({"nome": partes[0], "versao": partes[1] if len(partes) > 1 else None,
                              "fabricante": (partes[2] if len(partes) > 2 else None) or None, "instalado_em": None})
        if lista:
            break
    return lista


def coletar_inventario() -> dict:
    try:
        softwares = _softwares_windows() if WINDOWS else _softwares_linux()
    except Exception as e:  # inventário nunca deve derrubar o check-in
        log.warning("falha ao listar softwares: %s", e)
        softwares = []
    softwares.sort(key=lambda s: s["nome"].lower())
    return {
        "sistema": {
            "so": platform.system(),
            "versao": versao_so(),
            "release": platform.release(),
            "hostname": socket.gethostname(),
            "arquitetura": platform.machine(),
            "boot": int(psutil.boot_time()),
            "python": platform.python_version(),
        },
        "hardware": _hardware(),
        "rede": _rede(),
        "discos": [
            {"dispositivo": p.device, "ponto": p.mountpoint, "fs": p.fstype}
            for p in psutil.disk_partitions(all=False) if p.fstype
        ][:64],
        "softwares": softwares[:5000],
    }
