"""Reiniciar e desligar o computador (comandos energia.reiniciar / energia.desligar).

O desligamento é agendado com alguns segundos de atraso para que a resposta chegue ao servidor antes.
"""
from __future__ import annotations

import subprocess
import sys
import threading

from farol.registro import ErroComando, comando

WINDOWS = sys.platform == "win32"


def _linha(acao: str, atraso: int) -> list[str]:
    if WINDOWS:
        return ["shutdown", "/r" if acao == "reiniciar" else "/s", "/t", str(atraso), "/c", "Farol RMM"]
    return ["shutdown", "-r" if acao == "reiniciar" else "-h", "now"]


def _agendar(acao: str, args: dict) -> dict:
    atraso = max(5, min(600, int(args.get("atraso_s") or 10)))
    cmd = _linha(acao, atraso)

    def executar():
        try:
            subprocess.run(cmd, check=False, capture_output=True, timeout=30)
        except OSError:
            pass

    if WINDOWS:
        # o próprio shutdown do Windows aceita atraso
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        except OSError as e:
            raise ErroComando(f"não foi possível chamar o shutdown: {e}") from None
        if r.returncode != 0:
            raise ErroComando((r.stderr or r.stdout or "shutdown falhou").strip()[:300])
    else:
        threading.Timer(atraso, executar).start()
    return {"agendado": True, "acao": acao, "em_segundos": atraso}


@comando("energia.reiniciar")
def reiniciar(args: dict, _ctx) -> dict:
    return _agendar("reiniciar", args)


@comando("energia.desligar")
def desligar(args: dict, _ctx) -> dict:
    return _agendar("desligar", args)
