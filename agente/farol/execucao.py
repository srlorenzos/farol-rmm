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

import psutil

from .config import WINDOWS

MAX_SAIDA = 64 * 1024
_NOME_ENV = re.compile(r"^FAROL_[A-Z0-9_]{1,60}$")


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
