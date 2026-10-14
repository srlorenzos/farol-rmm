"""Cliente WebSocket mínimo (RFC 6455) só com a biblioteca padrão.

Suporta ws:// e wss:// (TLS verificado), cabeçalhos extras no handshake (Authorization), mensagens de texto,
fragmentação na leitura, ping/pong automático e fechamento limpo. Não suporta extensões (permessage-deflate).
"""
from __future__ import annotations

import base64
import hashlib
import os
import socket
import ssl
import struct
import threading
import urllib.parse

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
TEXTO, BINARIO, FECHAR, PING, PONG, CONTINUACAO = 0x1, 0x2, 0x8, 0x9, 0xA, 0x0
MAX_MENSAGEM = 16 * 1024 * 1024


class ErroWS(Exception):
    """Falha no WebSocket (handshake recusado, conexão perdida, protocolo)."""

    def __init__(self, msg: str, status: int | None = None):
        super().__init__(msg)
        self.status = status


class ConexaoFechada(ErroWS):
    pass


def codificar_frame(opcode: int, dados: bytes, mascara: bytes | None = None, fin: bool = True) -> bytes:
    """Monta um frame. Cliente → servidor sempre mascarado (mascara de 4 bytes)."""
    cab = bytearray([(0x80 if fin else 0) | opcode])
    bit = 0x80 if mascara is not None else 0
    n = len(dados)
    if n < 126:
        cab.append(bit | n)
    elif n < 65536:
        cab.append(bit | 126)
        cab += struct.pack("!H", n)
    else:
        cab.append(bit | 127)
        cab += struct.pack("!Q", n)
    if mascara is None:
        return bytes(cab) + dados
    corpo = bytes(b ^ mascara[i % 4] for i, b in enumerate(dados)) if n < 4096 else _mascarar(dados, mascara)
    return bytes(cab) + mascara + corpo


def _mascarar(dados: bytes, mascara: bytes) -> bytes:
    # XOR rápido usando inteiros grandes
    n = len(dados)
    chave = (mascara * (n // 4 + 1))[:n]
    return (int.from_bytes(dados, "big") ^ int.from_bytes(chave, "big")).to_bytes(n, "big")


def decodificar_frame(ler) -> tuple[bool, int, bytes]:
    """Lê um frame usando ler(n) -> bytes exatos. Devolve (fin, opcode, dados)."""
    b1, b2 = ler(2)
    fin, opcode = bool(b1 & 0x80), b1 & 0x0F
    if b1 & 0x70:
        raise ErroWS("bits reservados ligados (extensão não negociada)")
    mascarado, n = bool(b2 & 0x80), b2 & 0x7F
    if n == 126:
        (n,) = struct.unpack("!H", ler(2))
    elif n == 127:
        (n,) = struct.unpack("!Q", ler(8))
    if n > MAX_MENSAGEM:
        raise ErroWS("frame grande demais")
    mascara = ler(4) if mascarado else None
    dados = ler(n) if n else b""
    if mascara:
        dados = _mascarar(dados, mascara)
    return fin, opcode, dados


class ClienteWS:
    def __init__(self, url: str, cabecalhos: dict | None = None, timeout: float = 30, contexto_ssl: ssl.SSLContext | None = None):
        partes = urllib.parse.urlsplit(url)
        if partes.scheme not in ("ws", "wss"):
            raise ErroWS(f"esquema inválido: {partes.scheme}")
        self.seguro = partes.scheme == "wss"
        self.host = partes.hostname
        self.porta = partes.port or (443 if self.seguro else 80)
        self.caminho = (partes.path or "/") + (f"?{partes.query}" if partes.query else "")
        self.netloc = partes.netloc
        self.cabecalhos = cabecalhos or {}
        self.timeout = timeout
        self.contexto = contexto_ssl or ssl.create_default_context()
        self.sock: socket.socket | None = None
        self._buffer = b""
        self._trava_envio = threading.Lock()
        self.fechado = True

    # ------------------------------------------------------------ conexão
    def conectar(self) -> None:
        bruto = socket.create_connection((self.host, self.porta), timeout=self.timeout)
        try:
            self.sock = self.contexto.wrap_socket(bruto, server_hostname=self.host) if self.seguro else bruto
            chave = base64.b64encode(os.urandom(16)).decode()
            linhas = [f"GET {self.caminho} HTTP/1.1", f"Host: {self.netloc}", "Upgrade: websocket", "Connection: Upgrade",
                      f"Sec-WebSocket-Key: {chave}", "Sec-WebSocket-Version: 13"]
            linhas += [f"{k}: {v}" for k, v in self.cabecalhos.items()]
            self.sock.sendall(("\r\n".join(linhas) + "\r\n\r\n").encode("utf-8"))
            resposta = self._ler_ate(b"\r\n\r\n", 16384).decode("iso-8859-1")
            status_linha, *resto = resposta.split("\r\n")
            partes = status_linha.split(" ", 2)
            status = int(partes[1]) if len(partes) > 1 and partes[1].isdigit() else 0
            if status != 101:
                raise ErroWS(f"handshake recusado: {status_linha}", status)
            cab = {k.strip().lower(): v.strip() for k, v in (l.split(":", 1) for l in resto if ":" in l)}
            esperado = base64.b64encode(hashlib.sha1((chave + GUID).encode()).digest()).decode()
            if cab.get("sec-websocket-accept") != esperado:
                raise ErroWS("handshake inválido (Sec-WebSocket-Accept)")
            self.sock.settimeout(None)
            self.fechado = False
        except BaseException:
            bruto.close()
            raise

    def _ler_ate(self, marcador: bytes, limite: int) -> bytes:
        while marcador not in self._buffer:
            if len(self._buffer) > limite:
                raise ErroWS("resposta do handshake grande demais")
            parte = self.sock.recv(4096)
            if not parte:
                raise ConexaoFechada("conexão fechada durante o handshake")
            self._buffer += parte
        i = self._buffer.index(marcador) + len(marcador)
        cab, self._buffer = self._buffer[:i], self._buffer[i:]
        return cab

    def _ler(self, n: int) -> bytes:
        while len(self._buffer) < n:
            try:
                parte = self.sock.recv(max(65536, n - len(self._buffer)))
            except OSError as e:
                raise ConexaoFechada(str(e)) from None
            if not parte:
                raise ConexaoFechada("conexão fechada pelo servidor")
            self._buffer += parte
        dados, self._buffer = self._buffer[:n], self._buffer[n:]
        return dados

    # ------------------------------------------------------------ envio
    def _enviar(self, opcode: int, dados: bytes) -> None:
        if self.fechado or not self.sock:
            raise ConexaoFechada("conexão fechada")
        frame = codificar_frame(opcode, dados, os.urandom(4))
        with self._trava_envio:
            try:
                self.sock.sendall(frame)
            except OSError as e:
                self.fechado = True
                raise ConexaoFechada(str(e)) from None

    def enviar_texto(self, texto: str) -> None:
        self._enviar(TEXTO, texto.encode("utf-8"))

    def ping(self, dados: bytes = b"") -> None:
        self._enviar(PING, dados)

    # ------------------------------------------------------------ leitura
    def receber(self) -> str | bytes:
        """Bloqueia até chegar uma mensagem completa (texto → str, binária → bytes). Responde pings sozinho."""
        partes: list[bytes] = []
        tipo = None
        while True:
            fin, opcode, dados = decodificar_frame(self._ler)
            if opcode == PING:
                self._enviar(PONG, dados)
                continue
            if opcode == PONG:
                continue
            if opcode == FECHAR:
                codigo = struct.unpack("!H", dados[:2])[0] if len(dados) >= 2 else 1005
                motivo = dados[2:].decode("utf-8", "replace")
                try:
                    self._enviar(FECHAR, dados[:2])
                except ErroWS:
                    pass
                self._encerrar()
                raise ConexaoFechada(f"fechada pelo servidor ({codigo} {motivo})".strip(), codigo)
            if opcode in (TEXTO, BINARIO):
                tipo = opcode
                partes = [dados]
            elif opcode == CONTINUACAO and tipo is not None:
                partes.append(dados)
            else:
                raise ErroWS(f"opcode inesperado {opcode}")
            if sum(len(p) for p in partes) > MAX_MENSAGEM:
                raise ErroWS("mensagem grande demais")
            if fin:
                corpo = b"".join(partes)
                return corpo.decode("utf-8") if tipo == TEXTO else corpo

    def fechar(self, codigo: int = 1000) -> None:
        if not self.fechado:
            try:
                self._enviar(FECHAR, struct.pack("!H", codigo))
            except ErroWS:
                pass
        self._encerrar()

    def _encerrar(self) -> None:
        self.fechado = True
        if self.sock:
            try:
                self.sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            self.sock.close()
