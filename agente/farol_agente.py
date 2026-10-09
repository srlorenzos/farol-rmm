#!/usr/bin/env python3
"""Farol RMM — agente de monitoramento (Windows e Linux).

Uso:
  python farol_agente.py instalar --servidor https://farol.exemplo.com --token TOKEN
  python farol_agente.py rodar             # loop principal
  python farol_agente.py rodar --uma-vez   # um check-in e sai

Depende apenas da biblioteca padrão + psutil.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import ipaddress
import json
import logging
import os
import platform
import random
import shutil
import signal
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import psutil

VERSAO = "0.1.0"
MAX_SAIDA = 64 * 1024
INTERVALO_INVENTARIO = 3600
WINDOWS = sys.platform == "win32"

log = logging.getLogger("farol")


class ErroConfig(Exception):
    """Configuração inválida (ex.: URL insegura)."""


class ErroRede(Exception):
    """Falha de conexão com o servidor."""


class ErroHttp(Exception):
    def __init__(self, status: int, corpo: str):
        super().__init__(f"HTTP {status}: {corpo[:200]}")
        self.status = status
        self.corpo = corpo


# ---------------------------------------------------------------- configuração

def caminho_config_padrao() -> Path:
    if env := os.environ.get("FAROL_CONFIG"):
        return Path(env)
    if WINDOWS:
        return Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "Farol" / "config.json"
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        return Path("/etc/farol/config.json")
    return Path.home() / ".config" / "farol" / "config.json"


def _host_local(host: str) -> bool:
    if host in ("localhost",):
        return True
    try:
        return ipaddress.ip_address(host.strip("[]")).is_loopback
    except ValueError:
        return False


def validar_url_servidor(url: str, inseguro: bool = False) -> str:
    """Aceita https:// sempre; http:// só para localhost ou com --inseguro explícito."""
    partes = urllib.parse.urlsplit(url.strip())
    if partes.scheme not in ("http", "https") or not partes.hostname:
        raise ErroConfig(f"URL do servidor inválida: {url!r}")
    if partes.scheme == "http" and not _host_local(partes.hostname) and not inseguro:
        raise ErroConfig(
            "Recusando http:// para um host que não é localhost. Use HTTPS "
            "(recomendado) ou passe --inseguro se souber o que está fazendo."
        )
    return f"{partes.scheme}://{partes.netloc}{partes.path.rstrip('/')}"


def _restringir_permissoes(caminho: Path) -> None:
    if not WINDOWS:
        os.chmod(caminho, 0o600)
        return
    # Windows: remove herança e libera só SYSTEM, Administradores e o usuário atual.
    usuario = os.environ.get("USERNAME", "")
    dominio = os.environ.get("USERDOMAIN", "")
    concessoes = ["*S-1-5-18:F", "*S-1-5-32-544:F"]
    if usuario and not usuario.endswith("$"):
        concessoes.append(f"{dominio}\\{usuario}:F" if dominio else f"{usuario}:F")
    try:
        subprocess.run(["icacls", str(caminho), "/inheritance:r", "/grant:r", *concessoes],
                       check=True, capture_output=True, timeout=30)
    except (OSError, subprocess.SubprocessError) as e:
        log.warning("não foi possível restringir permissões de %s: %s", caminho, e)


def salvar_config(caminho: Path, dados: dict) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    temporario = caminho.with_suffix(".tmp")
    fd = os.open(temporario, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=2)
    os.replace(temporario, caminho)
    _restringir_permissoes(caminho)


def carregar_config(caminho: Path) -> dict:
    try:
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ErroConfig(f"Config não encontrada em {caminho}. Rode 'instalar' primeiro.") from None
    for chave in ("servidor", "agente_id", "segredo"):
        if not dados.get(chave):
            raise ErroConfig(f"Config incompleta: falta '{chave}'")
    dados["servidor"] = validar_url_servidor(dados["servidor"], dados.get("inseguro", False))
    return dados


# ---------------------------------------------------------------- HTTP

class _SemRedirecionamento(urllib.request.HTTPRedirectHandler):
    """O agente só conversa com o servidor configurado: redirecionamentos são recusados."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401
        raise ErroRede(f"redirecionamento recusado para {newurl}")


class Cliente:
    def __init__(self, servidor: str, agente_id: str | None = None, segredo: str | None = None, timeout: float = 30):
        self.servidor = servidor
        self.agente_id = agente_id
        self.segredo = segredo
        self.timeout = timeout
        contexto = ssl.create_default_context()  # verificação de certificado sempre ligada
        self._abridor = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=contexto), _SemRedirecionamento()
        )

    def post(self, caminho: str, corpo: dict) -> dict:
        dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(self.servidor + caminho, data=dados, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", f"farol-agente/{VERSAO}")
        if self.agente_id and self.segredo:
            req.add_header("Authorization", f"Bearer {self.agente_id}:{self.segredo}")
        try:
            with self._abridor.open(req, timeout=self.timeout) as r:
                return json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            raise ErroHttp(e.code, e.read().decode("utf-8", "replace")) from None
        except (urllib.error.URLError, OSError, TimeoutError) as e:
            raise ErroRede(str(getattr(e, "reason", e))) from None


# ---------------------------------------------------------------- coleta

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


def info_basica() -> dict:
    return {
        "hostname": socket.gethostname(),
        "so": platform.system(),
        "so_versao": versao_so()[:255],
        "arquitetura": platform.machine(),
        "versao_agente": VERSAO,
    }


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


def montar_checkin(servidor: str | None, com_inventario: bool, intervalo_cpu: float | None = None) -> dict:
    payload = {"metricas": coletar_metricas(servidor, intervalo_cpu), "info": info_basica()}
    if com_inventario:
        payload["inventario"] = coletar_inventario()
    return payload


# ---------------------------------------------------------------- execução de scripts

def _truncar(dados: bytes) -> str:
    if len(dados) > MAX_SAIDA:
        return dados[:MAX_SAIDA].decode("utf-8", "replace") + "\n[... saída truncada em 64 KB]"
    return dados.decode("utf-8", "replace")


def _matar_arvore(proc: subprocess.Popen) -> None:
    try:
        pai = psutil.Process(proc.pid)
        filhos = pai.children(recursive=True)
    except psutil.Error:
        filhos = []
    if not WINDOWS:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except OSError:
            pass
    for p in [*filhos]:
        try:
            p.kill()
        except psutil.Error:
            pass
    try:
        proc.kill()
    except OSError:
        pass
    psutil.wait_procs(filhos, timeout=5)


def _preparar(shell: str, conteudo: str, pasta: str) -> list[str]:
    """Grava o script num arquivo temporário e devolve a linha de comando."""
    def gravar(nome, texto, codificacao="utf-8"):
        caminho = os.path.join(pasta, nome)
        with open(caminho, "w", encoding=codificacao, newline="\r\n" if nome.endswith((".ps1", ".cmd")) else "\n") as f:
            f.write(texto)
        return caminho

    if shell == "powershell":
        cabecalho = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$OutputEncoding = [System.Text.Encoding]::UTF8\n$ProgressPreference = 'SilentlyContinue'\n"
        arq = gravar("script.ps1", cabecalho + conteudo, "utf-8-sig")
        exe = "powershell.exe" if WINDOWS else (shutil.which("pwsh") or "pwsh")
        return [exe, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", arq]
    if shell == "cmd":
        if not WINDOWS:
            raise FileNotFoundError("cmd só está disponível no Windows")
        arq = gravar("script.cmd", "@echo off\nchcp 65001 >nul\n" + conteudo + "\n")
        return [os.environ.get("ComSpec", "cmd.exe"), "/d", "/c", arq]
    if shell == "bash":
        exe = shutil.which("bash")
        if not exe:
            raise FileNotFoundError("bash não encontrado nesta máquina")
        return [exe, gravar("script.sh", conteudo + "\n")]
    if shell == "python":
        return [sys.executable, "-X", "utf8", gravar("script.py", conteudo + "\n")]
    raise ValueError(f"shell não suportado: {shell}")


def executar_job(job: dict) -> dict:
    """Executa um job e devolve o payload de resultado para o servidor."""
    timeout = max(1, int(job.get("timeout") or 60))
    resultado = {"job_id": job["id"], "codigo_saida": None, "stdout": "", "stderr": "",
                 "duracao_ms": 0, "erro": None, "timeout": False}
    inicio = time.monotonic()
    pasta = tempfile.mkdtemp(prefix="farol-")
    try:
        try:
            cmd = _preparar(job.get("shell", ""), job.get("conteudo", ""), pasta)
        except (ValueError, FileNotFoundError) as e:
            resultado["erro"] = str(e)
            return resultado
        env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
        opcoes = {"cwd": pasta, "env": env, "stdin": subprocess.DEVNULL,
                  "stdout": subprocess.PIPE, "stderr": subprocess.PIPE}
        if WINDOWS:
            opcoes["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
        else:
            opcoes["start_new_session"] = True
        try:
            proc = subprocess.Popen(cmd, **opcoes)
        except FileNotFoundError:
            resultado["erro"] = f"interpretador não encontrado: {cmd[0]}"
            return resultado
        try:
            saida, erro = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            _matar_arvore(proc)
            try:
                saida, erro = proc.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                saida, erro = b"", b""
            resultado["timeout"] = True
            resultado["erro"] = f"tempo limite de {timeout} s excedido; processo encerrado"
        resultado["codigo_saida"] = None if resultado["timeout"] else proc.returncode
        resultado["stdout"] = _truncar(saida or b"")
        resultado["stderr"] = _truncar(erro or b"")
        return resultado
    finally:
        resultado["duracao_ms"] = int((time.monotonic() - inicio) * 1000)
        shutil.rmtree(pasta, ignore_errors=True)


# ---------------------------------------------------------------- comandos

def cmd_instalar(args) -> int:
    servidor = validar_url_servidor(args.servidor, args.inseguro)
    caminho = Path(args.config) if args.config else caminho_config_padrao()
    cliente = Cliente(servidor)
    try:
        resp = cliente.post("/api/agente/registrar", {"token": args.token, "info": info_basica()})
    except ErroHttp as e:
        try:
            msg = json.loads(e.corpo).get("erro", e.corpo)
        except ValueError:
            msg = e.corpo
        log.error("registro recusado (HTTP %s): %s", e.status, msg)
        return 2
    except ErroRede as e:
        log.error("não foi possível falar com %s: %s", servidor, e)
        return 3
    salvar_config(caminho, {
        "servidor": servidor,
        "agente_id": resp["id"],
        "segredo": resp["segredo"],
        "intervalo": int(resp.get("intervalo") or 15),
        "inseguro": bool(args.inseguro),
    })
    print(f"Agente registrado: {resp['id']}\nConfiguração salva em {caminho}\nAgora rode: python farol_agente.py rodar"
          + (f" --config \"{caminho}\"" if args.config else ""))
    return 0


def _enviar_resultado(cliente: Cliente, resultado: dict) -> None:
    for tentativa in range(5):
        try:
            cliente.post("/api/agente/resultado", resultado)
            return
        except ErroHttp as e:
            log.error("servidor recusou resultado do job %s: %s", resultado["job_id"], e)
            return
        except ErroRede as e:
            log.warning("falha ao enviar resultado do job %s (%s); tentando de novo", resultado["job_id"], e)
            time.sleep(min(60, 2 ** tentativa))


def _processar_job(cliente: Cliente, job: dict) -> None:
    log.info("executando job %s (%s, timeout %ss)", job["id"], job.get("shell"), job.get("timeout"))
    r = executar_job(job)
    log.info("job %s terminou: código %s%s", job["id"], r["codigo_saida"], " (timeout)" if r["timeout"] else "")
    _enviar_resultado(cliente, r)


def cmd_rodar(args) -> int:
    caminho = Path(args.config) if args.config else caminho_config_padrao()
    cfg = carregar_config(caminho)
    cliente = Cliente(cfg["servidor"], cfg["agente_id"], cfg["segredo"])
    intervalo = int(cfg.get("intervalo") or 15)
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="job")
    parar = threading.Event()
    for sinal in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sinal, lambda *_: parar.set())
        except (ValueError, OSError):
            pass

    psutil.cpu_percent(interval=None)  # primeira leitura serve só de referência
    ultimo_inventario = 0.0
    pedir_inventario = False
    falhas = 0
    log.info("agente %s falando com %s (intervalo %ss)", cfg["agente_id"], cfg["servidor"], intervalo)

    while not parar.is_set():
        espera = intervalo
        try:
            com_inv = pedir_inventario or time.time() - ultimo_inventario >= INTERVALO_INVENTARIO
            payload = montar_checkin(cfg["servidor"], com_inv, intervalo_cpu=1.0 if args.uma_vez else None)
            resp = cliente.post("/api/agente/checkin", payload)
            if com_inv:
                ultimo_inventario = time.time()
            pedir_inventario = bool(resp.get("pedirInventario"))
            intervalo = int(resp.get("intervalo") or intervalo)
            espera = intervalo
            falhas = 0
            jobs = resp.get("jobs") or []
            futuros = [executor.submit(_processar_job, cliente, j) for j in jobs]
            if args.uma_vez:
                concurrent.futures.wait(futuros)
            log.debug("check-in ok, %d job(s)", len(jobs))
        except ErroHttp as e:
            if e.status == 401:
                log.error("credencial recusada: o agente foi revogado ou a config está errada")
                if args.uma_vez:
                    return 4
                espera = 300
            else:
                falhas += 1
                log.warning("servidor respondeu %s", e)
                espera = min(300, intervalo * 2 ** falhas)
        except ErroRede as e:
            falhas += 1
            espera = min(300, intervalo * 2 ** min(falhas, 6)) * random.uniform(0.8, 1.2)
            log.warning("sem conexão com o servidor (%s); nova tentativa em %.0fs", e, espera)
            if args.uma_vez:
                return 3
        if args.uma_vez:
            break
        parar.wait(espera)
    executor.shutdown(wait=True)
    return 0


def _ajustar_saida() -> None:
    """Evita UnicodeEncodeError quando a saída é redirecionada num console com codepage legado."""
    for fluxo in (sys.stdout, sys.stderr):
        try:
            if fluxo and not fluxo.isatty():
                fluxo.reconfigure(encoding="utf-8", errors="replace")
            elif fluxo:
                fluxo.reconfigure(errors="replace")
        except (AttributeError, ValueError, OSError):
            pass


def main(argv=None) -> int:
    _ajustar_saida()
    p = argparse.ArgumentParser(prog="farol_agente", description="Agente do Farol RMM")
    p.add_argument("-v", "--verbose", action="store_true", help="log detalhado")
    sub = p.add_subparsers(dest="comando", required=True)

    pi = sub.add_parser("instalar", help="registra este computador no servidor")
    pi.add_argument("--servidor", required=True, help="URL do servidor, ex.: https://farol.exemplo.com")
    pi.add_argument("--token", required=True, help="token de instalação gerado no painel")
    pi.add_argument("--config", help="caminho do arquivo de configuração")
    pi.add_argument("--inseguro", action="store_true", help="permite http:// para hosts que não são localhost")

    pr = sub.add_parser("rodar", help="loop principal de check-in")
    pr.add_argument("--config", help="caminho do arquivo de configuração")
    pr.add_argument("--uma-vez", action="store_true", help="faz um check-in (e executa jobs) e sai")

    sub.add_parser("versao", help="mostra a versão")

    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    try:
        if args.comando == "instalar":
            return cmd_instalar(args)
        if args.comando == "rodar":
            return cmd_rodar(args)
        print(VERSAO)
        return 0
    except ErroConfig as e:
        log.error("%s", e)
        return 2


if __name__ == "__main__":
    sys.exit(main())
