"""Testes do terminal interativo remoto (agente/farol/modulos/terminal.py): sessão de relay que roda um
shell de verdade. Usa um shell real (cmd/powershell no Windows, bash/sh no Linux) — mesmo espírito dos
testes de execucao.py. Nunca mexe no agente real: cada teste cria sua própria sessão/processo e encerra.
"""
from __future__ import annotations

import json
import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from farol.config import WINDOWS  # noqa: E402
from farol.modulos import terminal as mod_terminal  # noqa: E402


class ContextoFalso:
    versao = "teste"


class SessaoFalsa:
    """Reúne o que a sessão manda (enviar) e se foi encerrada (encerrar), sem precisar do relay de verdade."""

    def __init__(self):
        self.enviados: list[str] = []
        self.motivo_encerramento: str | None = None

    def enviar(self, texto: str) -> None:
        self.enviados.append(texto)

    def encerrar(self, motivo: str = "") -> None:
        self.motivo_encerramento = motivo


def nova_sessao() -> tuple[mod_terminal.Terminal, SessaoFalsa]:
    s = SessaoFalsa()
    t = mod_terminal.Terminal(ContextoFalso(), "sessao-teste", s.enviar, s.encerrar)
    return t, s


def esperar(cond, timeout=8.0, passo=0.05):
    fim = time.monotonic() + timeout
    while time.monotonic() < fim:
        if cond():
            return True
        time.sleep(passo)
    return False


class TestTerminal(unittest.TestCase):
    def tearDown(self):
        # garante que nenhum shell de teste fica pendurado entre testes
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

    def test_echo_chega_na_saida(self):
        t, s = self._abrir()
        self.assertTrue(esperar(lambda: t.proc is not None and t.proc.poll() is None, timeout=3))
        comando = "echo FAROL_OK\r\n" if WINDOWS else "echo FAROL_OK\n"
        t.receber(json.dumps({"tipo": "dados", "texto": comando}))
        achou = esperar(lambda: any("FAROL_OK" in c for c in s.enviados), timeout=8)
        self.assertTrue(achou, f"saída recebida: {s.enviados!r}")
        t.fechar()

    def test_texto_puro_sem_envelope_json_e_tratado_como_digitado(self):
        t, s = self._abrir()
        self.assertTrue(esperar(lambda: t.proc is not None, timeout=3))
        comando = "echo SEM_ENVELOPE\r\n" if WINDOWS else "echo SEM_ENVELOPE\n"
        t.receber(comando)  # sem JSON: cai no fallback "texto digitado puro"
        achou = esperar(lambda: any("SEM_ENVELOPE" in c for c in s.enviados), timeout=8)
        self.assertTrue(achou, f"saída recebida: {s.enviados!r}")
        t.fechar()

    def test_redimensionar_nao_quebra_nem_escreve_na_entrada(self):
        t, s = self._abrir()
        self.assertTrue(esperar(lambda: t.proc is not None, timeout=3))
        t.receber(json.dumps({"tipo": "redimensionar", "cols": 80, "linhas": 24}))
        time.sleep(0.3)
        self.assertIsNone(t.proc.poll(), "processo não deveria ter morrido por causa do redimensionar")
        t.fechar()

    def test_sem_shell_disponivel_avisa_e_encerra(self):
        t, s = nova_sessao()
        original = mod_terminal._escolher_shell
        mod_terminal._escolher_shell = lambda: None
        try:
            t.iniciar({})
        finally:
            mod_terminal._escolher_shell = original
        self.assertTrue(any("interpretador" in c.lower() or "shell" in c.lower() for c in s.enviados))
        self.assertIsNotNone(s.motivo_encerramento)

    def test_fechar_mata_o_processo(self):
        t, s = self._abrir()
        self.assertTrue(esperar(lambda: t.proc is not None and t.proc.poll() is None, timeout=3))
        pid = t.proc.pid
        t.fechar()
        import psutil
        morreu = esperar(lambda: not psutil.pid_exists(pid) or psutil.Process(pid).status() == psutil.STATUS_ZOMBIE, timeout=5)
        self.assertTrue(morreu, "processo do shell deveria ter sido encerrado")

    def test_sinal_sigint_chama_a_api_certa_sem_derrubar_a_sessao(self):
        t, s = self._abrir()
        self.assertTrue(esperar(lambda: t.proc is not None, timeout=3))
        # não dá pra testar de forma 100% determinística que o shell realmente parou algo (depende do SO
        # e do que está rodando), mas confere que mandar o sinal não derruba a sessão nem lança exceção.
        t.receber(json.dumps({"tipo": "sinal", "nome": "SIGINT"}))
        time.sleep(0.5)
        self.assertIsNone(s.motivo_encerramento, "SIGINT sozinho não deveria encerrar a sessão")
        t.fechar()

    def test_receber_depois_do_processo_morto_nao_lanca(self):
        t, s = self._abrir()
        self.assertTrue(esperar(lambda: t.proc is not None, timeout=3))
        t.fechar()
        time.sleep(0.2)
        t.receber(json.dumps({"tipo": "dados", "texto": "echo depois-de-morto\r\n"}))  # não pode lançar


if __name__ == "__main__":
    unittest.main()
