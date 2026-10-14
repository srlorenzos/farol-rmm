"""Janela da bandeja: um servidor HTTP local (só 127.0.0.1) serve a página única (ui.montar_html) e a
captura de print da tela — a bandeja roda na sessão do usuário, então só ela (não o agente, que é
SYSTEM) consegue tirar um print da área de trabalho interativa.

A mesma URL é usada tanto pelo pywebview (janela nativa, WebView2) quanto pelo fallback (navegador
padrão) quando o pywebview não está disponível: um único HTML, dois jeitos de mostrar.
"""
from __future__ import annotations

import base64
import ctypes
import io
import json
import logging
import secrets
import sys
import threading
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from farol.modulos.api_local import PORTAS_UI_BANDEJA

from . import ui

log = logging.getLogger("farol.bandeja")

LARGURA, ALTURA = 420, 640
MAX_LADO_PRINT = 1600
WINDOWS = sys.platform == "win32"


def _capturar_tela() -> tuple[bytes, str]:
    """mss primeiro (mais rápido); PIL.ImageGrab como alternativa. Redimensiona e comprime em JPEG."""
    try:
        import mss
        from PIL import Image
        with mss.mss() as sct:
            shot = sct.grab(sct.monitors[0])
            img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
    except Exception:
        from PIL import ImageGrab
        img = ImageGrab.grab().convert("RGB")
    if max(img.size) > MAX_LADO_PRINT:
        escala = MAX_LADO_PRINT / max(img.size)
        img = img.resize((max(1, int(img.width * escala)), max(1, int(img.height * escala))))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=72)
    return buf.getvalue(), "image/jpeg"


class _HandlerUI(BaseHTTPRequestHandler):
    server_version = "FarolBandejaUI/1"
    protocol_version = "HTTP/1.1"
    # Preenchido por iniciar_servidor() antes do serve_forever; uma só janela por processo.
    contexto: dict = {"html": "", "token": ""}

    def log_message(self, fmt, *args):
        log.debug("bandeja-ui %s - " + fmt, self.address_string(), *args)

    def _host_ok(self) -> bool:
        host = (self.headers.get("Host") or "").strip()
        porta = self.server.server_port
        return host in (f"127.0.0.1:{porta}", f"localhost:{porta}")

    def _json(self, status: int, dados: dict) -> None:
        corpo = json.dumps(dados).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        if not self._host_ok():
            self.send_response(HTTPStatus.FORBIDDEN)
            self.end_headers()
            return
        if self.path not in ("/", "/index.html"):
            self.send_response(HTTPStatus.NOT_FOUND)
            self.end_headers()
            return
        corpo = self.contexto["html"].encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def do_POST(self):
        if not self._host_ok():
            self.send_response(HTTPStatus.FORBIDDEN)
            self.end_headers()
            return
        if self.path != "/_bandeja/print":
            self.send_response(HTTPStatus.NOT_FOUND)
            self.end_headers()
            return
        auth = self.headers.get("Authorization", "")
        tok = self.contexto.get("token") or ""
        if not (auth.startswith("Bearer ") and tok and secrets.compare_digest(auth[7:].strip(), tok)):
            self._json(HTTPStatus.UNAUTHORIZED, {"erro": "token inválido"})
            return
        try:
            dados, tipo = _capturar_tela()
        except Exception as e:
            log.exception("falha ao capturar a tela")
            self._json(500, {"erro": f"não foi possível capturar a tela: {e}"})
            return
        self._json(200, {"base64": base64.b64encode(dados).decode("ascii"), "tipo": tipo})


def iniciar_servidor(*, porta_api: int, token_api: str, empresa: str, cor: str) -> tuple[ThreadingHTTPServer, str]:
    """Sobe o servidor da UI na primeira porta livre de PORTAS_UI_BANDEJA. Devolve (servidor, url)."""
    html = ui.montar_html(porta_api=porta_api, token=token_api, empresa=empresa, cor_marca=cor)
    token_print = secrets.token_hex(16)
    _HandlerUI.contexto = {"html": html, "token": token_print}
    ultimo_erro = None
    for porta in PORTAS_UI_BANDEJA:
        try:
            servidor = ThreadingHTTPServer(("127.0.0.1", porta), _HandlerUI)
        except OSError as e:
            ultimo_erro = e
            continue
        servidor.daemon_threads = True
        threading.Thread(target=servidor.serve_forever, name="farol-bandeja-ui", daemon=True).start()
        log.info("janela da bandeja servida em http://127.0.0.1:%d/", porta)
        return servidor, f"http://127.0.0.1:{porta}/"
    raise OSError(f"nenhuma porta livre entre {PORTAS_UI_BANDEJA} para a janela da bandeja: {ultimo_erro}")


def _posicao_proxima_ao_relogio(largura: int, altura: int) -> tuple[int, int] | None:
    """Canto inferior direito da tela principal, acima da barra de tarefas — melhor esforço."""
    if not WINDOWS:
        return None
    try:
        user32 = ctypes.windll.user32
        largura_tela = user32.GetSystemMetrics(0)
        altura_tela = user32.GetSystemMetrics(1)
        return (max(0, largura_tela - largura - 16), max(0, altura_tela - altura - 64))
    except Exception:
        return None


def pywebview_disponivel() -> bool:
    try:
        import webview  # noqa: F401
        return True
    except Exception:
        return False


class JanelaWebview:
    """Mantém uma janela pywebview oculta e alterna mostrar/ocultar (evita recriar o runtime da GUI)."""

    def __init__(self, url: str, titulo: str, icone_pil=None):
        import webview
        self._webview = webview
        x, y = _posicao_proxima_ao_relogio(LARGURA, ALTURA) or (None, None)
        self.janela = webview.create_window(
            titulo, url, width=LARGURA, height=ALTURA, x=x, y=y, hidden=True, on_top=False, resizable=True,
        )
        self.janela.events.closing += self._ao_fechar

    def _ao_fechar(self):
        self.janela.hide()
        return False  # cancela o fechamento real: só esconde (o agente continua, a bandeja também)

    def iniciar_loop(self) -> None:
        """Bloqueia a thread atual (deve ser a thread principal do processo)."""
        self._webview.start()

    def mostrar(self) -> None:
        try:
            self.janela.show()
            self.janela.restore()
        except Exception:
            log.exception("falha ao mostrar a janela da bandeja")

    def ocultar(self) -> None:
        try:
            self.janela.hide()
        except Exception:
            pass


def abrir_no_navegador(url: str) -> None:
    webbrowser.open(url)
