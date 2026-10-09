"""Canal em tempo real agente ⇄ servidor (WebSocket persistente, opcional).

Uma thread mantém a conexão com /api/agente/ws; se cair, tenta de novo com espera crescente. O check-in HTTP
continua funcionando sem ele (fallback). Mensagens tratadas:
  servidor → agente: ola · checkin (faça check-in agora) · cmd {id,tipo,args} · relay.abrir/dados/fechar
  agente → servidor: res {id,ok,dados|erro} · relay.aberta/erro/dados/fechar
"""
from __future__ import annotations

import json
import logging
import random
import threading
import urllib.parse

from . import VERSAO
from .registro import REGISTRO, executar_comando
from .ws import ClienteWS, ErroWS

log = logging.getLogger("farol")


def url_ws(servidor: str, caminho: str = "/api/agente/ws") -> str:
    p = urllib.parse.urlsplit(servidor)
    esquema = "wss" if p.scheme == "https" else "ws"
    return f"{esquema}://{p.netloc}{p.path.rstrip('/')}{caminho}"


class CanalTempoReal:
    def __init__(self, ctx, executor, acordar: threading.Event, parar: threading.Event):
        self.ctx = ctx
        self.executor = executor
        self.acordar = acordar
        self.parar = parar
        self.ws: ClienteWS | None = None
        self.sessoes: dict[str, object] = {}
        self.caminho = "/api/agente/ws"
        self.conectado = threading.Event()
        self.thread = threading.Thread(target=self._loop, name="tempo-real", daemon=True)

    def iniciar(self, caminho: str | None = None) -> None:
        if caminho:
            self.caminho = caminho
        if not self.thread.is_alive():
            self.thread.start()

    # ------------------------------------------------------------ envio
    def enviar(self, msg: dict) -> bool:
        ws = self.ws
        if not ws or ws.fechado:
            return False
        try:
            ws.enviar_texto(json.dumps(msg, ensure_ascii=False, default=str))
            return True
        except ErroWS:
            return False

    # ------------------------------------------------------------ loop
    def _loop(self) -> None:
        espera = 5.0
        cfg = self.ctx.cfg
        while not self.parar.is_set():
            self.ws = ClienteWS(url_ws(cfg["servidor"], self.caminho), {
                "Authorization": f"Bearer {cfg['agente_id']}:{cfg['segredo']}",
                "User-Agent": f"farol-agente/{VERSAO}",
            })
            try:
                self.ws.conectar()
                self.conectado.set()
                log.info("canal em tempo real conectado")
                espera = 5.0
                while not self.parar.is_set():
                    texto = self.ws.receber()
                    if isinstance(texto, str):
                        self._tratar(texto)
            except ErroWS as e:
                if e.status in (401, 4403):
                    log.error("canal em tempo real recusado (credencial inválida)")
                    espera = 300
                elif e.status == 404:
                    log.info("servidor sem canal em tempo real; seguindo só com check-in")
                    espera = 600
                else:
                    log.debug("canal em tempo real caiu: %s", e)
            except OSError as e:
                log.debug("canal em tempo real indisponível: %s", e)
            finally:
                self.conectado.clear()
                self._fechar_sessoes("conexão perdida")
                if self.ws:
                    self.ws.fechar()
            self.parar.wait(espera * random.uniform(0.8, 1.2))
            espera = min(espera * 2, 120)

    def encerrar(self) -> None:
        self._fechar_sessoes("agente parando")
        if self.ws:
            self.ws.fechar()

    def _tratar(self, texto: str) -> None:
        try:
            msg = json.loads(texto)
        except ValueError:
            return
        t = msg.get("t")
        if t == "checkin":
            self.acordar.set()
        elif t == "cmd":
            self.executor.submit(self._comando, msg)
        elif t == "relay.abrir":
            self._abrir_sessao(msg)
        elif t == "relay.dados":
            s = self.sessoes.get(msg.get("sessao"))
            if s and isinstance(msg.get("d"), str):
                self.executor.submit(self._sessao_receber, s, msg["d"])
        elif t == "relay.fechar":
            s = self.sessoes.pop(msg.get("sessao"), None)
            if s:
                self._sessao_fechar(s)

    def _comando(self, msg: dict) -> None:
        log.info("comando %s (%s)", msg.get("tipo"), msg.get("id"))
        r = executar_comando(self.ctx, str(msg.get("tipo")), msg.get("args") or {})
        if not self.enviar({"t": "res", "id": msg.get("id"), **r}):
            # canal caiu no meio: entrega pelo HTTP
            self.ctx.responder_comando_http(msg.get("id"), r)

    # ------------------------------------------------------------ relay
    def _abrir_sessao(self, msg: dict) -> None:
        sid, tipo = msg.get("sessao"), msg.get("tipo")
        cls = REGISTRO.sessoes.get(tipo)
        if not cls or not isinstance(sid, str):
            self.enviar({"t": "relay.erro", "sessao": sid, "erro": f"sessão não suportada: {tipo}"})
            return

        def enviar(dados: str) -> None:
            self.enviar({"t": "relay.dados", "sessao": sid, "d": dados})

        def encerrar(motivo: str = "encerrada pelo agente") -> None:
            if self.sessoes.pop(sid, None) is not None:
                self.enviar({"t": "relay.fechar", "sessao": sid, "motivo": motivo})

        try:
            s = cls(self.ctx, sid, enviar, encerrar)
            s.iniciar(msg.get("args") or {})
        except Exception as e:
            log.exception("falha ao abrir sessão %s", tipo)
            self.enviar({"t": "relay.erro", "sessao": sid, "erro": str(e)})
            return
        self.sessoes[sid] = s
        self.enviar({"t": "relay.aberta", "sessao": sid})
        log.info("sessão %s aberta (%s)", tipo, sid)

    @staticmethod
    def _sessao_receber(s, dados: str) -> None:
        try:
            with s.trava:
                s.receber(dados)
        except Exception:
            log.exception("erro na sessão %s", s.id)
            s.encerrar("erro no agente")

    @staticmethod
    def _sessao_fechar(s) -> None:
        try:
            s.fechar()
        except Exception:
            log.exception("erro ao fechar sessão %s", s.id)

    def _fechar_sessoes(self, motivo: str) -> None:
        for sid in list(self.sessoes):
            s = self.sessoes.pop(sid, None)
            if s:
                self._sessao_fechar(s)
