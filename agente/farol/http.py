"""Cliente HTTP do agente (stdlib): só fala com o servidor configurado, sem redirecionamentos, TLS verificado."""
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request

from . import VERSAO


class ErroRede(Exception):
    """Falha de conexão com o servidor."""


class ErroHttp(Exception):
    def __init__(self, status: int, corpo: str):
        super().__init__(f"HTTP {status}: {corpo[:200]}")
        self.status = status
        self.corpo = corpo


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
