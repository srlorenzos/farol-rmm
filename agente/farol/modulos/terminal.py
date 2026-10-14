"""Terminal interativo remoto: sessão de relay (tipo 'terminal', ver servidor/src/modulos/terminal/index.js)
que spawna um shell de verdade (PowerShell/cmd no Windows, bash/sh em Linux/macOS) e liga stdin/stdout ao
painel pelo canal em tempo real já existente. Permissão, 2FA/modo elevado, auditoria e gravação opcional já
são genéricos do núcleo e do módulo do servidor — aqui só a execução de verdade.

Sem PTY de verdade (evita a dependência extra de `pywinpty`/`pty` com build nativo): o processo não tem uma
TTY, então não ecoa o que é digitado nem suporta aplicativos de tela cheia (vim, htop, less). O painel faz
"local echo" e manda a linha inteira ao apertar Enter — funciona bem para o uso normal de console (rodar um
comando, ver a saída), documentado como limitação conhecida.

Protocolo sobre o campo `d` do relay (sempre JSON em texto):
  painel -> agente: {"tipo":"dados","texto":"..."} | {"tipo":"sinal","nome":"SIGINT"} | {"tipo":"redimensionar","cols":N,"linhas":N}
  agente -> painel: texto cru da saída do processo (sem envelope: é sempre o que o shell imprimiu)
Uma mensagem que não é um JSON válido (ou não é um desses tipos) é tratada como texto digitado puro, por
compatibilidade/defesa.
"""
from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import threading

import psutil

from farol.config import WINDOWS
from farol.registro import Sessao, sessao

log = logging.getLogger("farol")

LEITURA_BLOCO = 4096


def _escolher_shell() -> list[str] | None:
    """PowerShell (pwsh ou o powershell.exe de sistema) é preferido; cai pro cmd/bash conforme o SO."""
    import shutil
    if WINDOWS:
        pwsh = shutil.which("pwsh")
        if pwsh:
            return [pwsh, "-NoLogo", "-NoProfile"]
        return [os.environ.get("ComSpec", "cmd.exe")]
    sh = shutil.which("bash") or shutil.which("sh")
    return [sh] if sh else None


def _matar_arvore(proc: subprocess.Popen) -> None:
    """Mesma ideia de agente/farol/execucao.py: mata o processo e todos os filhos (o usuário pode ter
    rodado qualquer coisa dentro do shell)."""
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


@sessao("terminal")
class Terminal(Sessao):
    def iniciar(self, args: dict) -> None:
        cmd = _escolher_shell()
        if not cmd:
            self.enviar("Nenhum interpretador de shell (pwsh/cmd/bash/sh) disponível nesta máquina.\r\n")
            self.encerrar("sem shell disponível")
            return
        cols = str(int(args.get("cols") or 120))
        linhas = str(int(args.get("linhas") or 30))
        env = {**os.environ, "PYTHONIOENCODING": "utf-8", "COLUMNS": cols, "LINES": linhas}
        kwargs: dict = {}
        if WINDOWS:
            # grupo de processo próprio: só assim dá pra mandar CTRL_C_EVENT sem afetar o próprio agente.
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | getattr(subprocess, "CREATE_NO_WINDOW", 0)
        else:
            kwargs["preexec_fn"] = os.setsid  # idem no Linux/macOS, via grupo de sessão (pra matar a árvore)
        try:
            self.proc = subprocess.Popen(
                cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                env=env, cwd=os.path.expanduser("~") or None, bufsize=0, **kwargs,
            )
        except Exception as e:
            log.exception("terminal %s: falha ao iniciar shell", self.id)
            self.enviar(f"Não foi possível iniciar o shell: {e}\r\n")
            self.encerrar("falha ao iniciar shell")
            return
        if WINDOWS and os.path.basename(cmd[0]).lower() == "cmd.exe":
            # cmd.exe começa na code page OEM da máquina (850/437...): sem isso, acento sai como "?" na
            # saída (o próprio banner inicial já sai errado, mas daqui pra frente fica certo em UTF-8).
            try:
                self.proc.stdin.write("chcp 65001>nul\r\n".encode("ascii"))
                self.proc.stdin.flush()
            except Exception:
                pass
        self._parar = threading.Event()
        self._leitor = threading.Thread(target=self._ler_saida, name=f"farol-terminal-{self.id}", daemon=True)
        self._leitor.start()
        log.info("terminal %s: shell iniciado (pid %s)", self.id, self.proc.pid)

    def _ler_saida(self) -> None:
        try:
            while not self._parar.is_set():
                pedaco = self.proc.stdout.read(LEITURA_BLOCO)
                if not pedaco:
                    break
                self.enviar(pedaco.decode("utf-8", "replace"))
        except Exception:
            if not self._parar.is_set():
                log.exception("terminal %s: erro lendo a saída do shell", self.id)
        finally:
            if not self._parar.is_set():
                self.encerrar("o shell terminou")

    def receber(self, dados: str) -> None:
        if not getattr(self, "proc", None) or self.proc.poll() is not None:
            return
        try:
            msg = json.loads(dados)
            if not isinstance(msg, dict):
                raise ValueError
        except ValueError:
            msg = {"tipo": "dados", "texto": dados}

        tipo = msg.get("tipo")
        if tipo == "sinal" and msg.get("nome") == "SIGINT":
            self._sigint()
        elif tipo == "redimensionar":
            pass  # sem PTY não há como refletir no processo já rodando; cols/linhas iniciais já foram usados
        else:
            texto = msg.get("texto", "")
            if not isinstance(texto, str) or not texto:
                return
            try:
                self.proc.stdin.write(texto.encode("utf-8", "replace"))
                self.proc.stdin.flush()
            except Exception:
                log.exception("terminal %s: erro escrevendo na entrada do shell", self.id)

    def _sigint(self) -> None:
        try:
            if WINDOWS:
                self.proc.send_signal(signal.CTRL_C_EVENT)
            else:
                os.killpg(self.proc.pid, signal.SIGINT)
        except Exception:
            log.exception("terminal %s: erro mandando SIGINT", self.id)

    def fechar(self) -> None:
        if not getattr(self, "proc", None):
            return
        self._parar.set()
        if self.proc.poll() is None:
            _matar_arvore(self.proc)
        for fluxo in (self.proc.stdin, self.proc.stdout):
            try:
                fluxo.close()
            except Exception:
                pass
        log.info("terminal %s: sessão encerrada", self.id)
