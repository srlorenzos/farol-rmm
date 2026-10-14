"""Tela remota: captura a tela (mss, JPEG comprimido) e manda pelo relay a uma taxa configurável; recebe
controle de mouse/teclado de volta. Mesma base do terminal (farol/modulos/terminal.py): uma sessão de
relay — permissão, 2FA/elevação, limite de 1 sessão por agente e auditoria já são genéricos do núcleo e do
módulo do servidor (servidor/src/modulos/tela/index.js); aqui só a captura e o controle de verdade.

Limitação importante (isolamento de sessão do Windows, não é bug): um serviço rodando como SYSTEM
(Session 0) não enxerga a área de trabalho interativa do usuário — é exatamente por isso que a bandeja
(agente/farol/bandeja/janela.py), e não o agente principal, tira print de chamado. `_area_trabalho_ok()`
detecta isso antes de tentar capturar e devolve um erro claro em vez de travar ou mandar tela preta.
Funciona normalmente quando o agente roda numa sessão interativa (`farol-agente.exe rodar` como o próprio
usuário) — é como este recurso foi testado nesta versão.

Protocolo sobre o campo `d` do relay:
  agente -> painel: sempre um quadro (JPEG em base64, sem envelope — quadro é o caso comum, não vale
                     gastar bytes com JSON a cada frame)
  painel -> agente: sempre JSON: {"tipo":"config","fps":N,"qualidade":N} ·
                     {"tipo":"mouse_mover"|"mouse_descer"|"mouse_subir","x":0..1,"y":0..1,"botao":"esquerdo"|"direito"|"meio"} ·
                     {"tipo":"mouse_scroll","delta":N} · {"tipo":"tecla","codigo":N,"acao":"descer"|"subir"}
                     (x/y normalizados pelo tamanho do quadro no painel; o agente converte pro tamanho real
                     da tela aqui. "codigo" é o keyCode do navegador, que já corresponde ao VK do Windows.)

Controle de mouse/teclado só está implementado no Windows por ora (ctypes + user32); em outros sistemas a
sessão funciona só como visualização (documentado no README).
"""
from __future__ import annotations

import base64
import ctypes
import io
import json
import logging
import threading
import time

from farol.config import WINDOWS
from farol.registro import Sessao, sessao

log = logging.getLogger("farol")

LARGURA_MAX_PADRAO = 1024
QUALIDADE_PADRAO = 45
FPS_PADRAO = 6
FPS_MIN, FPS_MAX = 1, 15
QUALIDADE_MIN, QUALIDADE_MAX = 10, 85
LARGURA_MIN, LARGURA_MAX = 320, 1920
TAMANHO_MAX_QUADRO = 170_000  # bytes já em base64 (limite do relay é 192 KiB; folga de sobra)

DESKTOP_READOBJECTS = 0x0001


def _limitar(v: float, minimo: float, maximo: float) -> float:
    return max(minimo, min(maximo, v))


def _area_trabalho_ok() -> tuple[bool, str]:
    """True se este processo consegue abrir a área de trabalho interativa — False (com o motivo) quando
    roda como serviço SYSTEM em Session 0, onde captura de tela não é possível (limite do Windows)."""
    if not WINDOWS:
        return True, ""
    try:
        h = ctypes.windll.user32.OpenInputDesktop(0, False, DESKTOP_READOBJECTS)
        if not h:
            return False, ("sem acesso à área de trabalho interativa (o agente está rodando como serviço "
                            "SYSTEM, Session 0 — é um limite do próprio Windows, não um bug: rode o agente "
                            "numa sessão de usuário interativa pra usar a tela remota)")
        ctypes.windll.user32.CloseDesktop(h)
        return True, ""
    except Exception as e:  # noqa: BLE001
        return False, f"não foi possível verificar a área de trabalho interativa: {e}"


def _capturar_jpeg(largura_max: int, qualidade: int) -> tuple[bytes, int, int]:
    import mss
    from PIL import Image
    with mss.mss() as sct:
        monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
        bruto = sct.grab(monitor)
        img = Image.frombytes("RGB", bruto.size, bruto.bgra, "raw", "BGRX")
    if img.width > largura_max:
        escala = largura_max / img.width
        img = img.resize((largura_max, max(1, int(img.height * escala))))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=qualidade)
    return buf.getvalue(), img.width, img.height


@sessao("tela")
class Tela(Sessao):
    def iniciar(self, args: dict) -> None:
        ok, motivo = _area_trabalho_ok()
        if not ok:
            self.enviar(json.dumps({"tipo": "erro", "mensagem": motivo}))
            self.encerrar(motivo)
            return
        self._qualidade = int(_limitar(float(args.get("qualidade") or QUALIDADE_PADRAO), QUALIDADE_MIN, QUALIDADE_MAX))
        self._fps = int(_limitar(float(args.get("fps") or FPS_PADRAO), FPS_MIN, FPS_MAX))
        self._largura_max = int(_limitar(float(args.get("largura_max") or LARGURA_MAX_PADRAO), LARGURA_MIN, LARGURA_MAX))
        self._parar = threading.Event()
        self._thread = threading.Thread(target=self._capturar_loop, name=f"farol-tela-{self.id}", daemon=True)
        self._thread.start()
        log.info("tela %s: captura iniciada (fps=%s qualidade=%s largura_max=%s)", self.id, self._fps, self._qualidade, self._largura_max)

    def _capturar_loop(self) -> None:
        falhas_seguidas = 0
        while not self._parar.is_set():
            inicio = time.monotonic()
            try:
                qualidade = self._qualidade
                dados, _w, _h = _capturar_jpeg(self._largura_max, qualidade)
                # Quadro grande demais pro limite do relay: baixa a qualidade até caber, em vez de descartar.
                while len(dados) > TAMANHO_MAX_QUADRO and qualidade > QUALIDADE_MIN:
                    qualidade = max(QUALIDADE_MIN, qualidade - 15)
                    dados, _w, _h = _capturar_jpeg(self._largura_max, qualidade)
                if len(dados) <= TAMANHO_MAX_QUADRO:
                    self.enviar(base64.b64encode(dados).decode("ascii"))
                falhas_seguidas = 0
            except Exception:
                falhas_seguidas += 1
                log.exception("tela %s: falha ao capturar um quadro", self.id)
                if falhas_seguidas >= 10:
                    self.encerrar("falhas seguidas ao capturar a tela")
                    return
            espera = (1.0 / self._fps) - (time.monotonic() - inicio)
            if espera > 0:
                self._parar.wait(espera)

    def receber(self, dados: str) -> None:
        try:
            msg = json.loads(dados)
            if not isinstance(msg, dict):
                return
        except ValueError:
            return
        tipo = msg.get("tipo")
        try:
            if tipo == "config":
                if "fps" in msg:
                    self._fps = int(_limitar(float(msg["fps"]), FPS_MIN, FPS_MAX))
                if "qualidade" in msg:
                    self._qualidade = int(_limitar(float(msg["qualidade"]), QUALIDADE_MIN, QUALIDADE_MAX))
            elif tipo in ("mouse_mover", "mouse_descer", "mouse_subir", "mouse_scroll"):
                _controlar_mouse(tipo, msg)
            elif tipo == "tecla":
                _controlar_teclado(msg)
        except Exception:
            log.exception("tela %s: falha processando controle %r", self.id, tipo)

    def fechar(self) -> None:
        if getattr(self, "_parar", None) is not None:
            self._parar.set()
        log.info("tela %s: sessão encerrada", self.id)


# ---------------------------------------------------------------- controle (só Windows por ora)
MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP = 0x0002, 0x0004
MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP = 0x0008, 0x0010
MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP = 0x0020, 0x0040
MOUSEEVENTF_WHEEL = 0x0800
KEYEVENTF_KEYUP = 0x0002

_BOTOES_DOWN = {"esquerdo": MOUSEEVENTF_LEFTDOWN, "direito": MOUSEEVENTF_RIGHTDOWN, "meio": MOUSEEVENTF_MIDDLEDOWN}
_BOTOES_UP = {"esquerdo": MOUSEEVENTF_LEFTUP, "direito": MOUSEEVENTF_RIGHTUP, "meio": MOUSEEVENTF_MIDDLEUP}

_avisou_sem_controle = False


def _avisar_sem_controle() -> None:
    global _avisou_sem_controle
    if not _avisou_sem_controle:
        _avisou_sem_controle = True
        log.warning("tela: controle de mouse/teclado só está implementado no Windows por ora (esta sessão é só visualização)")


def _tamanho_tela() -> tuple[int, int]:
    u = ctypes.windll.user32
    return u.GetSystemMetrics(0), u.GetSystemMetrics(1)


def _controlar_mouse(tipo: str, msg: dict) -> None:
    if not WINDOWS:
        _avisar_sem_controle()
        return
    u = ctypes.windll.user32
    if tipo in ("mouse_mover", "mouse_descer", "mouse_subir"):
        largura, altura = _tamanho_tela()
        x = _limitar(float(msg.get("x", 0)), 0.0, 1.0)
        y = _limitar(float(msg.get("y", 0)), 0.0, 1.0)
        u.SetCursorPos(int(x * (largura - 1)), int(y * (altura - 1)))
    if tipo == "mouse_descer":
        u.mouse_event(_BOTOES_DOWN.get(msg.get("botao", "esquerdo"), MOUSEEVENTF_LEFTDOWN), 0, 0, 0, 0)
    elif tipo == "mouse_subir":
        u.mouse_event(_BOTOES_UP.get(msg.get("botao", "esquerdo"), MOUSEEVENTF_LEFTUP), 0, 0, 0, 0)
    elif tipo == "mouse_scroll":
        u.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, int(-float(msg.get("delta", 0)) * 40), 0)


def _controlar_teclado(msg: dict) -> None:
    if not WINDOWS:
        _avisar_sem_controle()
        return
    try:
        vk = int(msg.get("codigo"))
    except (TypeError, ValueError):
        return
    if not (0 < vk < 256):
        return
    flags = KEYEVENTF_KEYUP if msg.get("acao") == "subir" else 0
    ctypes.windll.user32.keybd_event(vk, 0, flags, 0)
