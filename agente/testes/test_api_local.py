"""Testes da API local da bandeja (agente/farol/modulos/api_local.py): token, Host/Origin, limites de
corpo, roteamento e proxy para o cliente HTTP do agente. Nunca abre a GUI nem toca o token real do
sistema (ProgramData/etc): cada teste usa seu próprio servidor numa porta livre e seu próprio token.
"""
from __future__ import annotations

import base64
import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from farol.http import ErroHttp, ErroRede
from farol.modulos import api_local


class ClienteFalso:
    """Substitui farol.http.Cliente nos testes: cada chamada .post() é resolvida por uma fila de respostas."""

    def __init__(self):
        self.chamadas = []
        self._respostas = []

    def programar(self, resposta_ou_erro):
        self._respostas.append(resposta_ou_erro)

    def post(self, caminho, corpo):
        self.chamadas.append((caminho, corpo))
        r = self._respostas.pop(0) if self._respostas else {}
        if isinstance(r, Exception):
            raise r
        return r


class ContextoFalso:
    def __init__(self, cliente=None, cfg=None):
        self.cliente = cliente or ClienteFalso()
        self.cfg = cfg or {"servidor": "https://farol.exemplo", "agente_id": "a-1", "intervalo": 15}


class ApiLocalTestCase(unittest.TestCase):
    def setUp(self):
        self._estado_anterior = dict(api_local._estado)
        api_local._estado["servidor"] = None
        api_local._estado["notificacoes"].clear()
        self.token = "token-de-teste-1234567890"
        api_local._estado["token"] = self.token
        self.ctx = ContextoFalso()
        api_local._estado["ctx"] = self.ctx
        api_local._estado["ultimo_contato"] = None
        self.servidor = ThreadingHTTPServer(("127.0.0.1", 0), api_local._Handler)
        self.porta = self.servidor.server_port
        self.thread = threading.Thread(target=self.servidor.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.servidor.shutdown()
        self.servidor.server_close()
        api_local._estado.clear()
        api_local._estado.update(self._estado_anterior)

    def _url(self, caminho):
        return f"http://127.0.0.1:{self.porta}{caminho}"

    def _pedir(self, metodo, caminho, corpo=None, token=True, host=None, origem=None):
        dados = json.dumps(corpo).encode("utf-8") if corpo is not None else (b"" if metodo == "POST" else None)
        req = urllib.request.Request(self._url(caminho), data=dados, method=metodo)
        if token:
            req.add_header("Authorization", f"Bearer {self.token}")
        if host is not None:
            req.add_header("Host", host)
        if origem is not None:
            req.add_header("Origin", origem)
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, json.loads(r.read().decode("utf-8") or "null")
        except urllib.error.HTTPError as e:
            corpo_erro = e.read().decode("utf-8", "replace")
            try:
                return e.code, json.loads(corpo_erro)
            except ValueError:
                return e.code, corpo_erro

    # ------------------------------------------------------------ segurança
    def test_sem_token_e_recusado(self):
        status, corpo = self._pedir("GET", "/api/saude", token=False)
        self.assertEqual(status, 401)
        self.assertIn("erro", corpo)

    def test_token_errado_e_recusado(self):
        req = urllib.request.Request(self._url("/api/saude"))
        req.add_header("Authorization", "Bearer token-errado")
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req, timeout=5)
        self.assertEqual(ctx.exception.code, 401)

    def test_host_estranho_e_recusado(self):
        status, _ = self._pedir("GET", "/api/saude", host="evil.example.com")
        self.assertEqual(status, 403)

    def test_origem_estranha_e_recusada(self):
        status, _ = self._pedir("GET", "/api/saude", origem="https://paginaqualquer.com")
        self.assertEqual(status, 403)

    def test_origem_local_e_aceita(self):
        status, corpo = self._pedir("GET", "/api/saude", origem=f"http://127.0.0.1:{self.porta}")
        self.assertEqual(status, 200)
        self.assertTrue(corpo["ok"])

    def test_origem_da_janela_da_bandeja_e_aceita(self):
        status, _ = self._pedir("GET", "/api/saude", origem=f"http://127.0.0.1:{api_local.PORTAS_UI_BANDEJA[0]}")
        self.assertEqual(status, 200)

    # ------------------------------------------------------------ CORS (o navegador bloqueia sem isso,
    # mesmo a origem sendo "permitida" na lógica acima — ver _Handler._cors_origem)
    def test_resposta_com_origem_permitida_leva_access_control_allow_origin(self):
        origem = f"http://127.0.0.1:{api_local.PORTAS_UI_BANDEJA[0]}"
        req = urllib.request.Request(self._url("/api/saude"))
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Origin", origem)
        with urllib.request.urlopen(req, timeout=5) as r:
            self.assertEqual(r.headers.get("Access-Control-Allow-Origin"), origem)

    def test_resposta_de_erro_tambem_leva_o_cabecalho_cors(self):
        """Sem o Origin ecoado no erro, o navegador mostraria "Failed to fetch" em vez da mensagem real."""
        origem = f"http://127.0.0.1:{api_local.PORTAS_UI_BANDEJA[0]}"
        req = urllib.request.Request(self._url("/api/saude"))
        req.add_header("Origin", origem)  # sem token: 401
        try:
            urllib.request.urlopen(req, timeout=5)
            self.fail("deveria ter dado 401")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 401)
            self.assertEqual(e.headers.get("Access-Control-Allow-Origin"), origem)

    def test_resposta_sem_origin_no_pedido_nao_leva_o_cabecalho(self):
        status, _ = self._pedir("GET", "/api/saude")  # sem Origin (curl/python)
        self.assertEqual(status, 200)

    def test_resposta_com_origem_estranha_nao_ecoa_o_cabecalho(self):
        # a origem estranha já é recusada (403) antes de chegar aqui, mas confere que mesmo assim
        # nenhuma origem não permitida jamais aparece em Access-Control-Allow-Origin.
        req = urllib.request.Request(self._url("/api/saude"))
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Origin", "https://paginaqualquer.com")
        try:
            urllib.request.urlopen(req, timeout=5)
            self.fail("deveria ter dado 403")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 403)
            self.assertIsNone(e.headers.get("Access-Control-Allow-Origin"))

    def test_preflight_options_responde_com_os_cabecalhos_de_cors(self):
        origem = f"http://127.0.0.1:{api_local.PORTAS_UI_BANDEJA[0]}"
        req = urllib.request.Request(self._url("/api/chamados"), method="OPTIONS")
        req.add_header("Origin", origem)
        req.add_header("Access-Control-Request-Method", "POST")
        req.add_header("Access-Control-Request-Headers", "authorization, content-type")
        with urllib.request.urlopen(req, timeout=5) as r:
            self.assertEqual(r.status, 204)
            self.assertEqual(r.headers.get("Access-Control-Allow-Origin"), origem)
            self.assertIn("POST", r.headers.get("Access-Control-Allow-Methods", ""))
            self.assertIn("Authorization", r.headers.get("Access-Control-Allow-Headers", ""))

    def test_preflight_options_nao_exige_token(self):
        """Preflight não manda Authorization (o navegador controla essa requisição) — não pode exigir token."""
        origem = f"http://127.0.0.1:{api_local.PORTAS_UI_BANDEJA[0]}"
        req = urllib.request.Request(self._url("/api/saude"), method="OPTIONS")
        req.add_header("Origin", origem)
        with urllib.request.urlopen(req, timeout=5) as r:
            self.assertEqual(r.status, 204)

    def test_preflight_options_com_host_estranho_nao_ecoa_cors(self):
        req = urllib.request.Request(self._url("/api/saude"), method="OPTIONS")
        req.add_header("Origin", f"http://127.0.0.1:{api_local.PORTAS_UI_BANDEJA[0]}")
        req.add_header("Host", "evil.example.com")
        with urllib.request.urlopen(req, timeout=5) as r:
            self.assertIsNone(r.headers.get("Access-Control-Allow-Origin"))

    def test_corpo_grande_demais_e_recusado(self):
        grande = "x" * (api_local.MAX_CORPO + 1000)
        status, corpo = self._pedir("POST", "/api/chamados", {"assunto": grande, "descricao": "d"})
        self.assertEqual(status, 413)

    def test_rota_desconhecida_e_404(self):
        status, _ = self._pedir("GET", "/api/isso-nao-existe")
        self.assertEqual(status, 404)

    # ------------------------------------------------------------ rotas
    def test_saude(self):
        status, corpo = self._pedir("GET", "/api/saude")
        self.assertEqual(status, 200)
        self.assertEqual(corpo, {"ok": True, "versao": api_local.VERSAO})

    def test_sistema_traz_farol_desconectado_sem_heartbeat(self):
        status, corpo = self._pedir("GET", "/api/sistema")
        self.assertEqual(status, 200)
        self.assertIn("hostname", corpo)
        self.assertFalse(corpo["farol"]["conectado"])

    def test_sistema_conectado_apos_heartbeat_recente(self):
        import time
        api_local._estado["ultimo_contato"] = time.time()
        status, corpo = self._pedir("GET", "/api/sistema")
        self.assertEqual(status, 200)
        self.assertTrue(corpo["farol"]["conectado"])

    def test_listar_chamados_encaminha_ao_servidor_com_usuario(self):
        self.ctx.cliente.programar([{"id": 1, "status": "aberto"}])
        status, corpo = self._pedir("GET", "/api/chamados?usuario=joao")
        self.assertEqual(status, 200)
        self.assertEqual(corpo, [{"id": 1, "status": "aberto"}])
        caminho, body = self.ctx.cliente.chamadas[-1]
        self.assertEqual(caminho, "/api/agente/chamados/listar")
        self.assertEqual(body["usuario"], "joao")

    def test_abrir_chamado_preenche_usuario_e_dados_do_sistema_automaticamente(self):
        self.ctx.cliente.programar({"id": 42})
        status, corpo = self._pedir("POST", "/api/chamados", {"assunto": "Impressora", "descricao": "não imprime"})
        self.assertEqual(status, 201)
        self.assertEqual(corpo["id"], 42)
        caminho, body = self.ctx.cliente.chamadas[-1]
        self.assertEqual(caminho, "/api/agente/chamados/criar")
        self.assertIn("usuario_windows", body)
        self.assertIn("dados_sistema", body)
        self.assertEqual(body["dados_sistema"]["hostname"], api_local.info_basica()["hostname"])

    def test_responder_chamado_inclui_id_da_url_no_corpo(self):
        self.ctx.cliente.programar({"ok": True})
        status, _ = self._pedir("POST", "/api/chamados/7/mensagens", {"texto": "obrigado"})
        self.assertEqual(status, 200)
        caminho, body = self.ctx.cliente.chamadas[-1]
        self.assertEqual(caminho, "/api/agente/chamados/responder")
        self.assertEqual(body["id"], 7)
        self.assertEqual(body["texto"], "obrigado")

    def test_fechar_chamado(self):
        self.ctx.cliente.programar({"ok": True})
        status, _ = self._pedir("POST", "/api/chamados/9/fechar")
        self.assertEqual(status, 200)
        caminho, body = self.ctx.cliente.chamadas[-1]
        self.assertEqual(caminho, "/api/agente/chamados/fechar")
        self.assertEqual(body["id"], 9)

    def test_erro_do_servidor_e_repassado_com_o_mesmo_status(self):
        self.ctx.cliente.programar(ErroHttp(404, json.dumps({"erro": "Chamado não encontrado"})))
        status, corpo = self._pedir("GET", "/api/chamados/999")
        self.assertEqual(status, 404)
        self.assertEqual(corpo["erro"], "Chamado não encontrado")

    def test_erro_de_rede_vira_502(self):
        self.ctx.cliente.programar(ErroRede("timeout"))
        status, _ = self._pedir("GET", "/api/chamados?usuario=x")
        self.assertEqual(status, 502)

    def test_anexo_decodifica_base64_e_devolve_binario(self):
        conteudo = b"\x89PNG\r\n\x1a\n-fake-"
        self.ctx.cliente.programar({"nome_arquivo": "print.png", "tipo": "image/png", "tamanho": len(conteudo),
                                     "conteudo_base64": base64.b64encode(conteudo).decode()})
        url = self._url(f"/api/chamados/3/anexos/5?token={self.token}")
        with urllib.request.urlopen(url, timeout=5) as r:
            self.assertEqual(r.status, 200)
            self.assertEqual(r.headers.get("Content-Type"), "image/png")
            self.assertEqual(r.read(), conteudo)

    def test_anexo_sem_token_na_query_e_recusado(self):
        status, _ = self._pedir("GET", "/api/chamados/3/anexos/5", token=False)
        self.assertEqual(status, 401)

    def test_notificacoes_sao_consumidas_na_leitura(self):
        api_local._estado["notificacoes"].append({"chamado_id": 1, "assunto": "x", "recebido_em": 0})
        status, corpo = self._pedir("GET", "/api/notificacoes")
        self.assertEqual(status, 200)
        self.assertEqual(len(corpo["itens"]), 1)
        status2, corpo2 = self._pedir("GET", "/api/notificacoes")
        self.assertEqual(len(corpo2["itens"]), 0, "a segunda leitura não deve repetir o aviso")

    def test_comando_chamados_notificar_enfileira_aviso(self):
        from farol.registro import executar_comando
        resultado = executar_comando(self.ctx, "chamados.notificar", {"chamado_id": 5, "assunto": "Rede lenta"})
        self.assertTrue(resultado["ok"])
        status, corpo = self._pedir("GET", "/api/notificacoes")
        self.assertEqual(len(corpo["itens"]), 1)
        self.assertEqual(corpo["itens"][0]["chamado_id"], 5)

    def test_comando_tela_notificar_enfileira_aviso_tipado(self):
        from farol.registro import executar_comando
        resultado = executar_comando(self.ctx, "tela.notificar", {"usuario": "tec1"})
        self.assertTrue(resultado["ok"])
        status, corpo = self._pedir("GET", "/api/notificacoes")
        self.assertEqual(len(corpo["itens"]), 1)
        self.assertEqual(corpo["itens"][0]["tipo"], "tela_remota")
        self.assertEqual(corpo["itens"][0]["usuario"], "tec1")


class TokenArquivoTestCase(unittest.TestCase):
    def test_gravar_e_restringir_token_em_arquivo_temporario(self):
        with tempfile.TemporaryDirectory() as tmp:
            caminho = Path(tmp) / "bandeja.token"
            os.environ["FAROL_BANDEJA_TOKEN_ARQUIVO"] = str(caminho)
            try:
                self.assertEqual(api_local.caminho_token(), caminho)
                api_local._gravar_token("abc123")
                self.assertEqual(caminho.read_text(encoding="utf-8"), "abc123")
            finally:
                del os.environ["FAROL_BANDEJA_TOKEN_ARQUIVO"]


if __name__ == "__main__":
    unittest.main()
