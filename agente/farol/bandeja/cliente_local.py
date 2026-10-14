"""Cliente da API local do agente (127.0.0.1), usado pela bandeja. Só biblioteca padrão.

Reaproveita de propósito `caminho_token`/`PORTA_PADRAO` de farol.modulos.api_local (mesmo pacote, fonte
única da verdade do caminho do token e da porta padrão) — importar esse módulo não tem efeito: ele só
*registra* um comando e um coletor (farol.registro), não inicia nada sozinho.
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from farol.modulos.api_local import PORTA_PADRAO, caminho_token

log = logging.getLogger("farol.bandeja")


class ErroClienteLocal(Exception):
    """Falha ao falar com a API local do agente (sem conexão, token ausente, erro repassado do servidor)."""

    def __init__(self, status: int, mensagem: str):
        super().__init__(mensagem)
        self.status = status
        self.mensagem = mensagem


class ClienteLocal:
    def __init__(self, porta: int = PORTA_PADRAO, timeout: float = 8.0):
        self.porta = porta
        self.timeout = timeout
        self._token: str | None = None

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.porta}"

    def token(self, forcar: bool = False) -> str | None:
        if self._token is None or forcar:
            try:
                self._token = caminho_token().read_text(encoding="utf-8").strip() or None
            except OSError:
                self._token = None
        return self._token

    def _pedir(self, metodo: str, caminho: str, corpo: dict | None = None, _retentar: bool = True) -> dict:
        tok = self.token()
        if not tok:
            raise ErroClienteLocal(0, "Token da bandeja não encontrado (o agente já iniciou nesta máquina?)")
        dados = None
        if metodo == "POST":
            dados = json.dumps(corpo or {}).encode("utf-8")
        req = urllib.request.Request(self.base_url + caminho, data=dados, method=metodo)
        req.add_header("Authorization", f"Bearer {tok}")
        if dados is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                corpo_resp = r.read()
                return json.loads(corpo_resp.decode("utf-8")) if corpo_resp else {}
        except urllib.error.HTTPError as e:
            corpo_erro = e.read().decode("utf-8", "replace")
            if e.code == 401 and _retentar:
                # o agente pode ter reiniciado e trocado o token; relê o arquivo e tenta mais uma vez
                self.token(forcar=True)
                return self._pedir(metodo, caminho, corpo, _retentar=False)
            try:
                msg = json.loads(corpo_erro).get("erro", corpo_erro)
            except ValueError:
                msg = corpo_erro or f"HTTP {e.code}"
            raise ErroClienteLocal(e.code, str(msg)) from None
        except urllib.error.URLError as e:
            raise ErroClienteLocal(0, f"sem conexão com o agente local: {getattr(e, 'reason', e)}") from None

    # ------------------------------------------------------------ rotas
    def saude(self) -> dict:
        return self._pedir("GET", "/api/saude")

    def sistema(self) -> dict:
        return self._pedir("GET", "/api/sistema")

    def notificacoes(self) -> list:
        return self._pedir("GET", "/api/notificacoes").get("itens", [])

    def bandeja_config(self) -> dict:
        return self._pedir("GET", "/api/bandeja/config")

    def chamados_listar(self, usuario: str | None = None) -> list:
        qs = f"?usuario={urllib.parse.quote(usuario)}" if usuario else ""
        return self._pedir("GET", f"/api/chamados{qs}")

    def chamado_obter(self, chamado_id: int) -> dict:
        return self._pedir("GET", f"/api/chamados/{int(chamado_id)}")

    def chamado_criar(self, **campos) -> dict:
        return self._pedir("POST", "/api/chamados", campos)

    def chamado_responder(self, chamado_id: int, **campos) -> dict:
        return self._pedir("POST", f"/api/chamados/{int(chamado_id)}/mensagens", campos)

    def chamado_fechar(self, chamado_id: int) -> dict:
        return self._pedir("POST", f"/api/chamados/{int(chamado_id)}/fechar")

    def reiniciar_agente(self) -> dict:
        return self._pedir("POST", "/api/sistema/reiniciar")

    def anexo_url(self, chamado_id: int, anexo_id: int) -> str:
        """URL para <img src>: a bandeja não pode mandar cabeçalhos num <img>, então o token vai na query
        (só essa rota aceita isso — ver api_local._Handler._token_ok)."""
        tok = self.token() or ""
        return f"{self.base_url}/api/chamados/{int(chamado_id)}/anexos/{int(anexo_id)}?token={urllib.parse.quote(tok)}"
