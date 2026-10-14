"""Testes da tela remota (agente/farol/modulos/tela.py): sessão de relay que captura a tela de verdade
(mss) e aceita controle de mouse/teclado. Roda contra a área de trabalho real desta máquina de teste (não
tem como simular captura de tela sem uma de verdade) — nunca mexe no agente real, cada teste cria sua
própria sessão/thread e encerra.
"""
from __future__ import annotations

import base64
import ctypes
import ctypes.wintypes
import json
import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from farol.config import WINDOWS  # noqa: E402
from farol.modulos import tela as mod_tela  # noqa: E402

JPEG_MAGICO = b"\xff\xd8"


class ContextoFalso:
    versao = "teste"


class SessaoFalsa:
    def __init__(self):
        self.enviados: list[str] = []
        self.motivo_encerramento: str | None = None

    def enviar(self, texto: str) -> None:
        self.enviados.append(texto)

    def encerrar(self, motivo: str = "") -> None:
        self.motivo_encerramento = motivo


def nova_sessao() -> tuple[mod_tela.Tela, SessaoFalsa]:
    s = SessaoFalsa()
    t = mod_tela.Tela(ContextoFalso(), "sessao-teste", s.enviar, s.encerrar)
    return t, s


def esperar(cond, timeout=8.0, passo=0.05):
    fim = time.monotonic() + timeout
    while time.monotonic() < fim:
        if cond():
            return True
        time.sleep(passo)
    return False


class TestTela(unittest.TestCase):
    def tearDown(self):
        for t in list(getattr(self, "_sessoes", [])):
            try:
                t.fechar()
            except Exception:
                pass

    def _abrir(self, args=None):
        t, s = nova_sessao()
        if not hasattr(self, "_sessoes"):
            self._sessoes = []
        self._sessoes.append(t)
        t.iniciar(args or {})
        return t, s

    def test_area_trabalho_disponivel_nesta_maquina_de_teste(self):
        # esta suíte roda numa sessão interativa de verdade (não como serviço SYSTEM) — tem que detectar certo.
        ok, motivo = mod_tela._area_trabalho_ok()
        self.assertTrue(ok, motivo)
        self.assertEqual(motivo, "")

    def test_captura_manda_pelo_menos_um_quadro_jpeg_valido(self):
        t, s = self._abrir({"fps": 4, "qualidade": 40, "largura_max": 640})
        achou = esperar(lambda: len(s.enviados) >= 1, timeout=6)
        self.assertTrue(achou, "nenhum quadro chegou")
        quadro = base64.b64decode(s.enviados[0])
        self.assertTrue(quadro.startswith(JPEG_MAGICO), "o quadro devia começar com o cabeçalho JPEG")
        self.assertLess(len(s.enviados[0]), mod_tela.TAMANHO_MAX_QUADRO, "quadro não pode estourar o limite do relay")
        t.fechar()

    def test_fps_configurado_e_respeitado_aproximadamente(self):
        # fps baixo (2): em ~1.6s não dá pra ter mais que uns 4 quadros (generoso, só confere que não é um laço livre)
        t, s = self._abrir({"fps": 2, "qualidade": 30, "largura_max": 480})
        esperar(lambda: len(s.enviados) >= 1, timeout=6)
        time.sleep(1.6)
        t.fechar()
        self.assertLessEqual(len(s.enviados), 5, f"rápido demais pro fps configurado: {len(s.enviados)} quadros")

    def test_fechar_para_a_captura(self):
        t, s = self._abrir({"fps": 5})
        esperar(lambda: len(s.enviados) >= 1, timeout=6)
        t.fechar()
        n_antes = len(s.enviados)
        time.sleep(0.6)
        self.assertEqual(len(s.enviados), n_antes, "não pode mandar mais quadros depois de fechar")

    def test_config_em_tempo_real_atualiza_fps_e_qualidade(self):
        t, s = self._abrir({"fps": 3, "qualidade": 40})
        esperar(lambda: len(s.enviados) >= 1, timeout=6)
        t.receber(json.dumps({"tipo": "config", "fps": 10, "qualidade": 70}))
        self.assertEqual(t._fps, 10)
        self.assertEqual(t._qualidade, 70)
        t.fechar()

    def test_config_fora_do_intervalo_e_limitada_nao_lanca(self):
        t, s = self._abrir()
        esperar(lambda: len(s.enviados) >= 1, timeout=6)
        t.receber(json.dumps({"tipo": "config", "fps": 999, "qualidade": -5}))
        self.assertEqual(t._fps, mod_tela.FPS_MAX)
        self.assertEqual(t._qualidade, mod_tela.QUALIDADE_MIN)
        t.fechar()

    def test_mensagem_invalida_nao_lanca(self):
        t, s = self._abrir()
        esperar(lambda: len(s.enviados) >= 1, timeout=6)
        t.receber("isto não é json")
        t.receber(json.dumps(["também não é um objeto"]))
        t.receber(json.dumps({"tipo": "tipo-desconhecido"}))
        t.fechar()

    @unittest.skipUnless(WINDOWS, "injeção de mouse/teclado só implementada no Windows por ora")
    def test_mouse_mover_move_o_cursor_de_verdade(self):
        u = ctypes.windll.user32
        largura, altura = mod_tela._tamanho_tela()
        mod_tela._controlar_mouse("mouse_mover", {"x": 0.25, "y": 0.25})
        ponto = ctypes.wintypes.POINT()
        u.GetCursorPos(ctypes.byref(ponto))
        self.assertAlmostEqual(ponto.x, int(0.25 * (largura - 1)), delta=3)
        self.assertAlmostEqual(ponto.y, int(0.25 * (altura - 1)), delta=3)

    @unittest.skipUnless(WINDOWS, "injeção de mouse/teclado só implementada no Windows por ora")
    def test_tecla_com_codigo_invalido_e_ignorada_sem_lancar(self):
        mod_tela._controlar_teclado({"codigo": "não-é-numero"})
        mod_tela._controlar_teclado({"codigo": 99999})
        mod_tela._controlar_teclado({})  # sem "codigo"

    def test_sem_shell_ou_tela_disponivel_avisa_e_encerra(self):
        t, s = nova_sessao()
        original = mod_tela._area_trabalho_ok
        mod_tela._area_trabalho_ok = lambda: (False, "motivo de teste")
        try:
            t.iniciar({})
        finally:
            mod_tela._area_trabalho_ok = original
        self.assertTrue(any("motivo de teste" in c for c in s.enviados))
        self.assertEqual(s.motivo_encerramento, "motivo de teste")


if __name__ == "__main__":
    unittest.main()
