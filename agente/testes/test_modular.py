"""Testes da parte modular do agente: registro de módulos, WebSocket mínimo e canal em tempo real."""
import base64
import hashlib
import json
import os
import socket
import struct
import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from farol import registro, ws  # noqa: E402
from farol.tempo_real import CanalTempoReal, url_ws  # noqa: E402


class TestRegistro(unittest.TestCase):
    def test_descobre_modulos_e_capacidades(self):
        r = registro.descobrir()
        self.assertIn("farol.modulos.basico", r.modulos)
        self.assertIn("ping", r.comandos)
        self.assertIn("energia.reiniciar", r.comandos)
        self.assertIn("eco", r.sessoes)
        self.assertIn("sessao:eco", r.capacidades())
        self.assertEqual(r.erros, {})

    def test_executar_comando(self):
        registro.descobrir()

        class Ctx:
            versao = "x"
        self.assertTrue(registro.executar_comando(Ctx(), "ping", {"ts": 1})["dados"]["pong"])
        r = registro.executar_comando(Ctx(), "nao.existe", {})
        self.assertFalse(r["ok"])
        self.assertIn("desconhecido", r["erro"])

    def test_tipo_invalido(self):
        with self.assertRaises(ValueError):
            registro.comando("Tipo Inválido")


class TestFrames(unittest.TestCase):
    @staticmethod
    def leitor(dados):
        buf = bytearray(dados)

        def ler(n):
            parte = bytes(buf[:n])
            del buf[:n]
            return parte
        return ler

    def test_ida_e_volta(self):
        for tamanho in (0, 5, 125, 126, 70000):
            dados = os.urandom(tamanho)
            frame = ws.codificar_frame(ws.BINARIO, dados, os.urandom(4))
            fin, op, volta = ws.decodificar_frame(self.leitor(frame))
            self.assertTrue(fin)
            self.assertEqual(op, ws.BINARIO)
            self.assertEqual(volta, dados)

    def test_url_ws(self):
        self.assertEqual(url_ws("https://farol.x.com"), "wss://farol.x.com/api/agente/ws")
        self.assertEqual(url_ws("http://127.0.0.1:8420"), "ws://127.0.0.1:8420/api/agente/ws")


def servidor_eco(porta, recebidos):
    """Servidor WS mínimo: handshake, devolve o 1º texto, manda ping, espera pong e fecha."""
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    porta.append(srv.getsockname()[1])

    def rodar():
        c, _ = srv.accept()
        dados = b""
        while b"\r\n\r\n" not in dados:
            dados += c.recv(4096)
        cab = dict(linha.split(": ", 1) for linha in dados.decode().split("\r\n")[1:] if ": " in linha)
        recebidos.append(cab)
        aceite = base64.b64encode(hashlib.sha1((cab["Sec-WebSocket-Key"] + ws.GUID).encode()).digest()).decode()
        c.sendall(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                   f"Sec-WebSocket-Accept: {aceite}\r\n\r\n").encode())
        arq = c.makefile("rb")
        _, _op, texto = ws.decodificar_frame(arq.read)
        c.sendall(ws.codificar_frame(ws.TEXTO, texto))
        c.sendall(ws.codificar_frame(ws.PING, b"oi"))
        _, op, corpo = ws.decodificar_frame(arq.read)
        recebidos.append((op, corpo))
        c.sendall(ws.codificar_frame(ws.FECHAR, struct.pack("!H", 1000)))
        c.close()
        srv.close()
    threading.Thread(target=rodar, daemon=True).start()


class TestClienteWS(unittest.TestCase):
    def test_handshake_eco_ping_fechar(self):
        porta, recebidos = [], []
        servidor_eco(porta, recebidos)
        c = ws.ClienteWS(f"ws://127.0.0.1:{porta[0]}/api/agente/ws", {"Authorization": "Bearer x:y"}, timeout=5)
        c.conectar()
        self.assertEqual(recebidos[0]["Authorization"], "Bearer x:y")
        c.enviar_texto("olá")
        self.assertEqual(c.receber(), "olá")
        with self.assertRaises(ws.ConexaoFechada):
            c.receber()  # responde o ping sozinho e depois recebe o close
        self.assertEqual(recebidos[1], (ws.PONG, b"oi"))
        self.assertTrue(c.fechado)

    def test_handshake_recusado(self):
        srv = socket.socket()
        srv.bind(("127.0.0.1", 0))
        srv.listen(1)

        def rodar():
            c, _ = srv.accept()
            c.recv(4096)
            c.sendall(b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n")
            c.close()
        threading.Thread(target=rodar, daemon=True).start()
        with self.assertRaises(ws.ErroWS) as e:
            ws.ClienteWS(f"ws://127.0.0.1:{srv.getsockname()[1]}/x", timeout=5).conectar()
        self.assertEqual(e.exception.status, 401)
        srv.close()


class TestCanal(unittest.TestCase):
    def test_comandos_e_sessao_eco(self):
        registro.descobrir()
        enviados = []

        class Ctx:
            versao = "t"
            cfg = {}

        class ExecutorSincrono:
            def submit(self, fn, *a):
                fn(*a)

        acordar = threading.Event()
        canal = CanalTempoReal(Ctx(), ExecutorSincrono(), acordar, threading.Event())
        canal.enviar = lambda m: enviados.append(m) or True
        canal._tratar(json.dumps({"t": "checkin"}))
        self.assertTrue(acordar.is_set())
        canal._tratar(json.dumps({"t": "cmd", "id": 9, "tipo": "ping", "args": {}}))
        self.assertEqual(enviados[-1]["t"], "res")
        self.assertTrue(enviados[-1]["dados"]["pong"])
        canal._tratar(json.dumps({"t": "relay.abrir", "sessao": "s1", "tipo": "eco"}))
        self.assertEqual(enviados[-1], {"t": "relay.aberta", "sessao": "s1"})
        canal._tratar(json.dumps({"t": "relay.dados", "sessao": "s1", "d": "ping"}))
        self.assertEqual(enviados[-1], {"t": "relay.dados", "sessao": "s1", "d": "pong"})
        canal._tratar(json.dumps({"t": "relay.fechar", "sessao": "s1"}))
        self.assertEqual(canal.sessoes, {})
        canal._tratar(json.dumps({"t": "relay.abrir", "sessao": "s2", "tipo": "terminal-inexistente"}))
        self.assertEqual(enviados[-1]["t"], "relay.erro")


if __name__ == "__main__":
    unittest.main()
