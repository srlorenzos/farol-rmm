"""Testes do cliente da bandeja (farol/bandeja/cliente_local.py), de ponta a ponta contra a API local de
verdade (api_local._Handler) com um ctx falso — sem abrir a GUI (pystray/pywebview não entram aqui)."""
from __future__ import annotations

import os
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

from farol.bandeja.cliente_local import ClienteLocal, ErroClienteLocal
from farol.http import ErroHttp
from farol.modulos import api_local


class ClienteFalso:
    def __init__(self):
        self.chamadas = []
        self._respostas = []

    def programar(self, resposta):
        self._respostas.append(resposta)

    def post(self, caminho, corpo):
        self.chamadas.append((caminho, corpo))
        r = self._respostas.pop(0) if self._respostas else {}
        if isinstance(r, Exception):
            raise r
        return r


class ContextoFalso:
    def __init__(self):
        self.cliente = ClienteFalso()
        self.cfg = {"servidor": "https://farol.exemplo", "agente_id": "a-1", "intervalo": 15}


class ClienteLocalTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self._caminho_token = Path(self._tmp.name) / "bandeja.token"
        self._caminho_token.write_text("token-bandeja-teste", encoding="utf-8")
        os.environ["FAROL_BANDEJA_TOKEN_ARQUIVO"] = str(self._caminho_token)

        api_local._estado["token"] = "token-bandeja-teste"
        self.ctx = ContextoFalso()
        api_local._estado["ctx"] = self.ctx
        api_local._estado["ultimo_contato"] = None
        api_local._estado["notificacoes"].clear()

        self.servidor = ThreadingHTTPServer(("127.0.0.1", 0), api_local._Handler)
        threading.Thread(target=self.servidor.serve_forever, daemon=True).start()
        self.cliente = ClienteLocal(porta=self.servidor.server_port, timeout=5)

    def tearDown(self):
        self.servidor.shutdown()
        self.servidor.server_close()
        del os.environ["FAROL_BANDEJA_TOKEN_ARQUIVO"]
        self._tmp.cleanup()

    def test_token_e_lido_do_arquivo(self):
        self.assertEqual(self.cliente.token(), "token-bandeja-teste")

    def test_saude_e_sistema(self):
        self.assertTrue(self.cliente.saude()["ok"])
        s = self.cliente.sistema()
        self.assertIn("hostname", s)
        self.assertIn("farol", s)

    def test_chamados_listar_e_criar(self):
        self.ctx.cliente.programar([{"id": 1}])
        r = self.cliente.chamados_listar(usuario="maria")
        self.assertEqual(r, [{"id": 1}])
        self.assertEqual(self.ctx.cliente.chamadas[-1][1]["usuario"], "maria")

        self.ctx.cliente.programar({"id": 9})
        r2 = self.cliente.chamado_criar(assunto="Teste", descricao="desc")
        self.assertEqual(r2["id"], 9)

    def test_chamado_responder_e_fechar(self):
        self.ctx.cliente.programar({"ok": True})
        self.cliente.chamado_responder(5, texto="obrigado")
        self.assertEqual(self.ctx.cliente.chamadas[-1][0], "/api/agente/chamados/responder")

        self.ctx.cliente.programar({"ok": True})
        self.cliente.chamado_fechar(5)
        self.assertEqual(self.ctx.cliente.chamadas[-1][0], "/api/agente/chamados/fechar")

    def test_erro_do_servidor_vira_erro_cliente_local(self):
        import json
        self.ctx.cliente.programar(ErroHttp(404, json.dumps({"erro": "Chamado não encontrado"})))
        with self.assertRaises(ErroClienteLocal) as ctx:
            self.cliente.chamado_obter(999)
        self.assertEqual(ctx.exception.status, 404)
        self.assertIn("não encontrado", ctx.exception.mensagem)

    def test_token_errado_e_corrigido_automaticamente_na_releitura(self):
        # Simula o agente reiniciando (token novo no arquivo) enquanto o cliente ainda tem o antigo em cache.
        self.cliente._token = "token-antigo-invalido"
        self.assertTrue(self.cliente.saude()["ok"])  # recupera lendo o arquivo de novo após o 401
        self.assertEqual(self.cliente.token(), "token-bandeja-teste")

    def test_sem_arquivo_de_token_da_erro_claro(self):
        self._caminho_token.unlink()
        cliente_sem_token = ClienteLocal(porta=self.servidor.server_port, timeout=5)
        with self.assertRaises(ErroClienteLocal):
            cliente_sem_token.saude()

    def test_anexo_url_inclui_token_na_query(self):
        url = self.cliente.anexo_url(3, 7)
        self.assertIn("/api/chamados/3/anexos/7", url)
        self.assertIn("token=token-bandeja-teste", url)


if __name__ == "__main__":
    unittest.main()
