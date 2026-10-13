"""Instalação do agente no Windows: copia os arquivos, registra o serviço, o autostart da bandeja e remove tudo.

Usado pelo farol-agente.exe empacotado (comandos instalar, desinstalar e status). Só biblioteca padrão + pywin32
(e psutil, que o agente já usa). O código de serviço fica em servico_windows.py.

Modos de execução em segundo plano:
  servico  serviço Windows de verdade ("Farol RMM Agent"). Exige o build em pasta (onedir): o gerenciador de
           serviços fala com o processo que ele iniciou, e no onefile esse processo é só o descompactador.
  tarefa   Tarefa Agendada como SYSTEM na inicialização, com reinício em falha. É o plano B, usado
           automaticamente quando o agente roda a partir do exe de arquivo único.
"""
from __future__ import annotations

import ctypes
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from . import VERSAO
from .config import caminho_config_padrao

log = logging.getLogger("farol")

NOME_SERVICO = "FarolAgente"
NOME_EXIBICAO = "Farol RMM Agent"
DESCRICAO = "Agente de monitoramento e gerenciamento remoto do Farol RMM."
NOME_TAREFA = "Farol RMM Agent"
CHAVE_RUN = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
VALOR_RUN = "FarolBandeja"
EXE_AGENTE = "farol-agente.exe"
EXE_BANDEJA = "farol-bandeja.exe"
SEM_JANELA = 0x08000000  # CREATE_NO_WINDOW


class ErroInstalacao(Exception):
    """Falha esperada da instalação (a mensagem é mostrada ao usuário)."""


# ---------------------------------------------------------------- utilidades

def pasta_programa() -> Path:
    return Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Farol"


def eh_admin() -> bool:
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except (AttributeError, OSError):
        return False


def congelado() -> bool:
    return bool(getattr(sys, "frozen", False))


def eh_onefile() -> bool:
    """True quando o exe é de arquivo único (os arquivos são descompactados numa pasta temporária)."""
    meipass = getattr(sys, "_MEIPASS", None)
    if not congelado() or not meipass:
        return False
    pasta_exe = Path(sys.executable).resolve().parent
    mp = Path(meipass).resolve()
    return mp != pasta_exe and pasta_exe not in mp.parents


def exe_atual() -> Path:
    return Path(sys.executable).resolve()


def _rodar(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, errors="replace", creationflags=SEM_JANELA,
                          timeout=kw.pop("timeout", 60), **kw)


def _dizer(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------- elevação (UAC)

def reexecutar_como_admin(argv: list[str]) -> int:
    """Reabre este programa elevado (UAC), espera terminar e devolve o código de saída dele."""
    class INFO(ctypes.Structure):
        _fields_ = [("cbSize", ctypes.c_ulong), ("fMask", ctypes.c_ulong), ("hwnd", ctypes.c_void_p),
                    ("lpVerb", ctypes.c_wchar_p), ("lpFile", ctypes.c_wchar_p), ("lpParameters", ctypes.c_wchar_p),
                    ("lpDirectory", ctypes.c_wchar_p), ("nShow", ctypes.c_int), ("hInstApp", ctypes.c_void_p),
                    ("lpIDList", ctypes.c_void_p), ("lpClass", ctypes.c_wchar_p), ("hkeyClass", ctypes.c_void_p),
                    ("dwHotKey", ctypes.c_ulong), ("hIcon", ctypes.c_void_p), ("hProcess", ctypes.c_void_p)]

    if congelado():
        arquivo, params = str(exe_atual()), subprocess.list2cmdline(argv)
    else:
        arquivo, params = sys.executable, subprocess.list2cmdline([str(Path(sys.argv[0]).resolve()), *argv])
    info = INFO()
    info.cbSize = ctypes.sizeof(INFO)
    info.fMask = 0x40  # SEE_MASK_NOCLOSEPROCESS
    info.lpVerb, info.lpFile, info.lpParameters, info.nShow = "runas", arquivo, params, 1
    if not ctypes.windll.shell32.ShellExecuteExW(ctypes.byref(info)):
        raise ErroInstalacao("A elevação (administrador) foi recusada ou falhou.")
    ctypes.windll.kernel32.WaitForSingleObject(info.hProcess, 0xFFFFFFFF)
    codigo = ctypes.c_ulong(1)
    ctypes.windll.kernel32.GetExitCodeProcess(info.hProcess, ctypes.byref(codigo))
    ctypes.windll.kernel32.CloseHandle(info.hProcess)
    return int(codigo.value)


def _pausar_se_elevado(args) -> None:
    """A janela do processo elevado some ao terminar; segura para o usuário ler o resultado."""
    if getattr(args, "elevado", False) and not getattr(args, "silencioso", False):
        try:
            input("\nPressione Enter para fechar...")
        except (EOFError, OSError):
            time.sleep(5)


# ---------------------------------------------------------------- serviço e tarefa

def _servico_existe(nome: str) -> bool:
    return _rodar(["sc.exe", "query", nome]).returncode == 0


def _estado_servico(nome: str) -> str | None:
    r = _rodar(["sc.exe", "query", nome])
    if r.returncode != 0:
        return None
    for linha in r.stdout.splitlines():
        if "STATE" in linha or "ESTADO" in linha:
            return linha.split()[-1]
    return "?"


def _parar_servico(nome: str, espera: float = 30) -> None:
    if not _servico_existe(nome):
        return
    _rodar(["sc.exe", "stop", nome])
    fim = time.time() + espera
    while time.time() < fim and _estado_servico(nome) not in (None, "STOPPED"):
        time.sleep(0.5)


def _remover_servico(nome: str) -> None:
    if not _servico_existe(nome):
        return
    _parar_servico(nome)
    r = _rodar(["sc.exe", "delete", nome])
    if r.returncode not in (0, 1060, 1072):
        raise ErroInstalacao(f"não foi possível remover o serviço {nome}: {r.stdout.strip() or r.stderr.strip()}")


def _instalar_servico(nome: str, exe: Path, config: Path | None) -> None:
    import win32service
    import win32serviceutil

    args = "servico" + (f' --config "{config}"' if config else "") + f" --nome-servico {nome}"
    if _servico_existe(nome):
        _remover_servico(nome)
        time.sleep(1)
    win32serviceutil.InstallService(
        None, nome, NOME_EXIBICAO, startType=win32service.SERVICE_AUTO_START,
        exeName=str(exe), exeArgs=args, description=DESCRICAO)
    # Recuperação: reinicia em 5 s, 5 s e 30 s; zera o contador depois de 1 dia; vale também para saída com erro.
    _rodar(["sc.exe", "failure", nome, "reset=", "86400", "actions=", "restart/5000/restart/5000/restart/30000"])
    _rodar(["sc.exe", "failureflag", nome, "1"])
    r = _rodar(["sc.exe", "start", nome])
    if r.returncode not in (0, 1056):
        raise ErroInstalacao(f"o serviço foi criado mas não iniciou: {r.stdout.strip() or r.stderr.strip()}")


def _xml_tarefa(exe: Path, config: Path | None) -> str:
    args = "rodar" + (f' --config "{config}"' if config else "")

    def esc(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    return f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>{esc(DESCRICAO)}</Description></RegistrationInfo>
  <Triggers><BootTrigger><Enabled>true</Enabled></BootTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author"><Exec><Command>{esc(str(exe))}</Command><Arguments>{esc(args)}</Arguments></Exec></Actions>
</Task>"""


def _instalar_tarefa(exe: Path, config: Path | None) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".xml", delete=False, encoding="utf-16") as f:
        f.write(_xml_tarefa(exe, config))
        xml = f.name
    try:
        r = _rodar(["schtasks.exe", "/Create", "/TN", NOME_TAREFA, "/XML", xml, "/F"])
        if r.returncode != 0:
            raise ErroInstalacao(f"não foi possível criar a tarefa agendada: {r.stdout.strip() or r.stderr.strip()}")
    finally:
        os.unlink(xml)
    _rodar(["schtasks.exe", "/Run", "/TN", NOME_TAREFA])


def _tarefa_existe() -> bool:
    return _rodar(["schtasks.exe", "/Query", "/TN", NOME_TAREFA]).returncode == 0


def _remover_tarefa() -> None:
    if _tarefa_existe():
        _rodar(["schtasks.exe", "/End", "/TN", NOME_TAREFA])
        _rodar(["schtasks.exe", "/Delete", "/TN", NOME_TAREFA, "/F"])


# ---------------------------------------------------------------- bandeja: autostart e processo

def _chave_run(escrita: bool = False):
    import winreg
    return winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, CHAVE_RUN, 0,
                          winreg.KEY_SET_VALUE if escrita else winreg.KEY_READ)


def registrar_autostart(exe_bandeja: Path) -> None:
    import winreg
    with _chave_run(True) as k:
        winreg.SetValueEx(k, VALOR_RUN, 0, winreg.REG_SZ, f'"{exe_bandeja}"')


def remover_autostart() -> bool:
    import winreg
    try:
        with _chave_run(True) as k:
            winreg.DeleteValue(k, VALOR_RUN)
        return True
    except FileNotFoundError:
        return False


def autostart_registrado() -> str | None:
    import winreg
    try:
        with _chave_run() as k:
            return winreg.QueryValueEx(k, VALOR_RUN)[0]
    except FileNotFoundError:
        return None


def _processos_bandeja():
    import psutil
    return [p for p in psutil.process_iter(["name"]) if (p.info["name"] or "").lower() == EXE_BANDEJA]


def _encerrar_bandeja() -> None:
    for p in _processos_bandeja():
        try:
            p.terminate()
        except Exception:  # noqa: BLE001
            pass
    time.sleep(1)


def _iniciar_bandeja(exe_bandeja: Path) -> bool:
    """Abre a bandeja na sessão do usuário (e sem privilégio elevado) pelo explorer.exe.
    Sem usuário logado (instalação via GPO/SYSTEM) não há o que abrir: ela sobe no próximo logon."""
    import psutil
    if not any((p.info["name"] or "").lower() == "explorer.exe" for p in psutil.process_iter(["name"])):
        return False
    subprocess.Popen(["explorer.exe", str(exe_bandeja)], creationflags=SEM_JANELA)
    return True


# ---------------------------------------------------------------- comandos

def _localizar_bandeja() -> Path | None:
    for pasta in (exe_atual().parent, pasta_programa()):
        if (pasta / EXE_BANDEJA).exists():
            return pasta / EXE_BANDEJA
    return None


def _copiar_arquivos(destino: Path) -> tuple[Path, Path | None]:
    """Copia o agente (e a pasta _internal no build onedir) e a bandeja para o destino."""
    origem = exe_atual()
    destino.mkdir(parents=True, exist_ok=True)
    exe_destino = destino / EXE_AGENTE
    if origem.parent.resolve() != destino.resolve():
        shutil.copy2(origem, exe_destino)
        interna = origem.parent / "_internal"
        if interna.is_dir():
            alvo = destino / "_internal"
            if alvo.exists():
                shutil.rmtree(alvo)
            shutil.copytree(interna, alvo)
    bandeja = _localizar_bandeja()
    bandeja_destino = None
    if bandeja:
        bandeja_destino = destino / EXE_BANDEJA
        if bandeja.resolve() != bandeja_destino.resolve():
            shutil.copy2(bandeja, bandeja_destino)
        # a bandeja em onedir também traz a sua _internal
        interna_b = bandeja.parent / "_internal"
        if interna_b.is_dir() and not (destino / "_internal").exists():
            shutil.copytree(interna_b, destino / "_internal")
    return exe_destino, bandeja_destino


def instalar_completo(args, registrar) -> int:
    """registrar(args) -> int faz o registro no servidor e grava a config (vem de cli.cmd_instalar)."""
    if not eh_admin():
        _dizer("Esta instalação precisa de permissão de administrador; pedindo elevação (UAC)...")
        argv = ["instalar", "--elevado"] + _repassar(args)
        try:
            return reexecutar_como_admin(argv)
        except ErroInstalacao as e:
            log.error("%s", e)
            return 5
    config = Path(args.config) if args.config else caminho_config_padrao()
    nome = args.nome_servico or NOME_SERVICO
    destino = Path(args.pasta) if args.pasta else pasta_programa()
    try:
        if args.token:
            codigo = registrar(args)
            if codigo != 0:
                return codigo
        elif not config.exists():
            raise ErroInstalacao("Informe --servidor e --token (gerados no painel) para registrar este computador.")
        else:
            _dizer(f"Configuração existente mantida ({config}); atualizando os arquivos e o serviço.")

        _dizer(f"Copiando arquivos para {destino} ...")
        modo_tarefa = eh_onefile() or args.modo == "tarefa"
        if modo_tarefa:
            _remover_tarefa()
        else:
            _parar_servico(nome)
        _encerrar_bandeja()
        exe, bandeja = _copiar_arquivos(destino)
        cfg_arg = config if args.config else None

        if modo_tarefa:
            _dizer("Registrando a tarefa agendada (SYSTEM, na inicialização) ...")
            _instalar_tarefa(exe, cfg_arg)
            modo = "Tarefa Agendada"
        else:
            _dizer(f'Registrando o serviço "{NOME_EXIBICAO}" ({nome}) ...')
            _instalar_servico(nome, exe, cfg_arg)
            modo = "serviço do Windows"

        if bandeja:
            registrar_autostart(bandeja)
            aberta = _iniciar_bandeja(bandeja)
            _dizer("Bandeja registrada para todos os usuários" + (" e iniciada." if aberta else
                   " (abre no próximo logon; não há sessão de usuário agora)."))
        else:
            _dizer(f"Aviso: {EXE_BANDEJA} não foi encontrado ao lado do agente; instalado sem bandeja.")
        _dizer(f"\nFarol instalado como {modo}. Arquivos em {destino}.")
        return 0
    except ErroInstalacao as e:
        log.error("%s", e)
        return 5
    finally:
        _pausar_se_elevado(args)


def _repassar(args) -> list[str]:
    """Reconstrói os argumentos de 'instalar' para o processo elevado."""
    r: list[str] = []
    for flag, valor in (("--servidor", args.servidor), ("--token", args.token), ("--config", args.config),
                        ("--nome-servico", args.nome_servico), ("--pasta", args.pasta)):
        if valor:
            r += [flag, valor]
    if args.inseguro:
        r.append("--inseguro")
    if args.modo:
        r += ["--modo", args.modo]
    if getattr(args, "silencioso", False):
        r.append("--silencioso")
    return r


def _confirmar(pergunta: str) -> bool:
    if not sys.stdin or not sys.stdin.isatty():
        return False
    try:
        return input(pergunta + " [s/N] ").strip().lower() in ("s", "sim", "y", "yes")
    except EOFError:
        return False


def desinstalar_completo(args) -> int:
    if not eh_admin():
        _dizer("A remoção precisa de permissão de administrador; pedindo elevação (UAC)...")
        argv = ["desinstalar", "--elevado"]
        for flag, v in (("--config", args.config), ("--nome-servico", args.nome_servico), ("--pasta", args.pasta)):
            if v:
                argv += [flag, v]
        for flag, ligado in (("--manter-config", args.manter_config), ("--remover-config", args.remover_config),
                             ("--sem-arquivos", args.sem_arquivos), ("--silencioso", args.silencioso)):
            if ligado:
                argv.append(flag)
        try:
            return reexecutar_como_admin(argv)
        except ErroInstalacao as e:
            log.error("%s", e)
            return 5
    nome = args.nome_servico or NOME_SERVICO
    destino = Path(args.pasta) if args.pasta else pasta_programa()
    config = Path(args.config) if args.config else caminho_config_padrao()
    try:
        _dizer("Parando e removendo o serviço e a tarefa agendada ...")
        _remover_servico(nome)
        _remover_tarefa()
        _encerrar_bandeja()
        if remover_autostart():
            _dizer("Autostart da bandeja removido.")

        pasta_dados = config.parent
        if args.manter_config:
            apagar_dados = False
        elif args.remover_config:
            apagar_dados = True
        else:
            apagar_dados = _confirmar(f"Apagar também a configuração e os dados em {pasta_dados}? "
                                      "(o computador precisará de um novo token para voltar ao painel)")
        if apagar_dados:
            shutil.rmtree(pasta_dados, ignore_errors=True)
            _dizer(f"Removido {pasta_dados}")
        else:
            _dizer(f"Configuração mantida em {pasta_dados}")

        if not args.sem_arquivos and destino.exists():
            _remover_pasta_depois(destino)
            _dizer(f"Arquivos de {destino} serão apagados em instantes.")
        _dizer("\nFarol removido deste computador. (O dispositivo continua listado no painel até ser revogado lá.)")
        return 0
    except ErroInstalacao as e:
        log.error("%s", e)
        return 5
    finally:
        _pausar_se_elevado(args)


def _remover_pasta_depois(pasta: Path) -> None:
    """O próprio exe está em uso; um cmd destacado apaga a pasta alguns segundos depois."""
    if pasta.parent == pasta or str(pasta).lower() in (os.environ.get("ProgramFiles", "").lower(),
                                                       os.environ.get("SystemRoot", "").lower()):
        return  # nunca apaga uma pasta-raiz por engano
    subprocess.Popen(["cmd.exe", "/c", f'ping -n 4 127.0.0.1 >nul & rmdir /s /q "{pasta}"'],
                     creationflags=SEM_JANELA | 0x00000008, close_fds=True)  # DETACHED_PROCESS


def status_completo(args) -> int:
    nome = args.nome_servico or NOME_SERVICO
    destino = Path(args.pasta) if args.pasta else pasta_programa()
    config = Path(args.config) if args.config else caminho_config_padrao()

    def sim(b: bool) -> str:
        return "sim" if b else "não"

    tipo = "exe de arquivo único" if eh_onefile() else "exe em pasta" if congelado() else "python"
    _dizer(f"Farol agente {VERSAO}  ({tipo})")
    _dizer(f"Administrador:       {sim(eh_admin())}")
    _dizer(f"Pasta {destino}: {'presente' if (destino / EXE_AGENTE).exists() else 'ausente'}"
           f"{'  (bandeja presente)' if (destino / EXE_BANDEJA).exists() else ''}")
    _dizer(f'Serviço "{NOME_EXIBICAO}" ({nome}): {_estado_servico(nome) or "não instalado"}')
    _dizer(f'Tarefa agendada "{NOME_TAREFA}": {"instalada" if _tarefa_existe() else "não instalada"}')
    _dizer(f"Autostart da bandeja: {autostart_registrado() or 'não registrado'}")
    try:
        _dizer(f"Bandeja em execução: {sim(bool(_processos_bandeja()))}")
    except Exception:  # noqa: BLE001
        pass
    if config.exists():
        try:
            c = json.loads(config.read_text(encoding="utf-8"))
            _dizer(f"Configuração:        {config}\n  servidor {c.get('servidor')}  agente {c.get('agente_id')}")
        except (OSError, ValueError) as e:
            _dizer(f"Configuração:        {config} (ilegível: {e})")
    else:
        _dizer(f"Configuração:        {config} (não encontrada)")
    return 0
