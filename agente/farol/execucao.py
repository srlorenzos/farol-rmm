"""Execução de scripts (jobs): arquivo temporário, tempo limite que mata a árvore de processos, saída truncada."""
from __future__ import annotations

import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import psutil

from .config import WINDOWS

MAX_SAIDA = 64 * 1024
_NOME_ENV = re.compile(r"^FAROL_[A-Z0-9_]{1,60}$")


def _os_release() -> dict[str, str]:
    """Lê /etc/os-release num dict (ID, ID_LIKE, ...). Vazio se não existir (ex.: macOS)."""
    try:
        texto = Path("/etc/os-release").read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}
    dados = {}
    for linha in texto.splitlines():
        if "=" in linha:
            chave, _, valor = linha.partition("=")
            dados[chave.strip()] = valor.strip().strip('"')
    return dados


def _comando_instalar_pwsh() -> str:
    """Comando de instalação do PowerShell (pwsh) certo para a distro/SO detectado, para a mensagem de erro."""
    if sys.platform == "darwin":
        return "brew install --cask powershell"
    info = _os_release()
    id_ = (info.get("ID") or "").lower()
    like = (info.get("ID_LIKE") or "").lower()
    if id_ in ("ubuntu", "debian") or "debian" in like:
        return "sudo apt-get update && sudo apt-get install -y powershell (veja https://aka.ms/pwsh; ou: sudo snap install powershell --classic)"
    if id_ in ("fedora", "rhel", "centos", "rocky", "almalinux") or "rhel" in like or "fedora" in like:
        return "sudo dnf install -y powershell (veja https://aka.ms/pwsh)"
    if id_ in ("opensuse", "opensuse-leap", "opensuse-tumbleweed", "sles") or "suse" in like:
        return "sudo zypper install -y powershell"
    if id_ == "arch" or "arch" in like:
        return "sudo pacman -S powershell  (ou pelo AUR: powershell-bin)"
    return "sudo snap install powershell --classic  (ou veja https://aka.ms/pwsh para a sua distro)"


def _interpretador_ausente(shell: str) -> str:
    """Mensagem específica e acionável para quando o interpretador do shell pedido não existe nesta máquina."""
    if shell == "powershell":
        return (f"pwsh (PowerShell) não está instalado neste {'macOS' if sys.platform == 'darwin' else 'Linux'}; "
                f"instale com: {_comando_instalar_pwsh()} — ou troque o script por um equivalente em bash.")
    if shell == "cmd":
        return "cmd só existe no Windows; neste sistema, use um script PowerShell ou bash equivalente."
    if shell == "bash":
        if WINDOWS:
            return ("bash não encontrado neste Windows; instale o Git for Windows (inclui bash) ou o WSL "
                     "(wsl --install), ou troque o script por um equivalente em PowerShell/CMD.")
        return "bash não encontrado nesta máquina; instale com o gerenciador de pacotes da distro (ex.: apt/dnf/zypper/pacman install bash)."
    return f"interpretador não encontrado para o shell '{shell}'"


def interpretadores_disponiveis() -> list[str]:
    """Interpretadores de fato presentes nesta máquina (não só o que o SO sugere) — relatado no check-in como
    capacidades `interpretador:<nome>`, para o servidor e o painel avisarem antes de mandar um script incompatível."""
    nomes = []
    if WINDOWS:
        nomes += ["cmd", "powershell"]  # cmd.exe e powershell.exe vêm com o Windows
    elif shutil.which("pwsh"):
        nomes.append("powershell")
    if shutil.which("bash"):
        nomes.append("bash")
    if shutil.which("sh"):
        nomes.append("sh")
    if shutil.which("python3") or shutil.which("python") or sys.executable:
        nomes.append("python3")
    return [f"interpretador:{n}" for n in nomes]


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

    # Falha rápida e com mensagem acionável *antes* de gravar qualquer arquivo: evita o erro genérico de
    # "interpretador não encontrado" que o subprocess.Popen daria (e que não dizia o que fazer a respeito).
    if shell == "powershell":
        exe = "powershell.exe" if WINDOWS else shutil.which("pwsh")
        if not exe:
            raise FileNotFoundError(_interpretador_ausente("powershell"))
        cabecalho = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$OutputEncoding = [System.Text.Encoding]::UTF8\n$ProgressPreference = 'SilentlyContinue'\n"
        arq = gravar("script.ps1", cabecalho + conteudo, "utf-8-sig")
        return [exe, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", arq]
    if shell == "cmd":
        if not WINDOWS:
            raise FileNotFoundError(_interpretador_ausente("cmd"))
        arq = gravar("script.cmd", "@echo off\nchcp 65001 >nul\n" + conteudo + "\n")
        return [os.environ.get("ComSpec", "cmd.exe"), "/d", "/c", arq]
    if shell == "bash":
        exe = shutil.which("bash")
        if not exe:
            raise FileNotFoundError(_interpretador_ausente("bash"))
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
        # Variáveis do script chegam prontas do servidor como FAROL_<NOME>; nunca são interpoladas no texto.
        for chave, valor in (job.get("env") or {}).items():
            if not _NOME_ENV.match(str(chave)) or not isinstance(valor, str) or "\0" in valor:
                resultado["erro"] = f"variável de ambiente inválida: {chave!r}"
                return resultado
            env[chave] = valor
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
