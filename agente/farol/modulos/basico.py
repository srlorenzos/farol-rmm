"""Módulo de exemplo (modelo para novos módulos): ping (comando tipado) e eco (sessão de relay)."""
from __future__ import annotations

import time

from farol.registro import Sessao, comando, sessao


@comando("ping")
def ping(args: dict, ctx) -> dict:
    return {"pong": True, "ts_agente": int(time.time() * 1000), "eco": args.get("ts"), "versao": ctx.versao}


@comando("agente.info")
def info(_args: dict, ctx) -> dict:
    from farol.registro import REGISTRO
    return {"versao": ctx.versao, "modulos": REGISTRO.modulos, "capacidades": REGISTRO.capacidades()}


@sessao("eco")
class Eco(Sessao):
    """Devolve tudo o que receber; 'ping' vira 'pong'."""

    def receber(self, dados: str) -> None:
        self.enviar("pong" if dados == "ping" else dados)
