"""Testa a lógica de fechamento da janela da bandeja (agente/farol/bandeja/janela.py) sem precisar de uma
janela pywebview de verdade: constrói a instância sem rodar __init__ (que exige o runtime do pywebview) e
troca `self.janela` por um dublê.

Bug real corrigido aqui: `_ao_fechar()` chamava `self.janela.hide()` DENTRO do próprio handler do evento
`closing` do pywebview — mas o pywebview só decide se cancela o fechamento (impede o WinForms de fechar a
janela de verdade) DEPOIS que todos os handlers terminam, então esconder o formulário no meio dessa
transição atrapalhava essa decisão: a janela fechava de verdade mesmo com o handler retornando `False`.
Como é a única janela do processo, o pywebview desligava o laço de eventos inteiro quando ela fechava e,
como todas as outras threads do processo são daemon, o PROCESSO INTEIRO morria — reproduzido ao vivo
mandando um WM_CLOSE de verdade pro HWND da janela (ver o relatório; não dá pra automatizar isso num teste
de unidade sem abrir uma janela do SO de verdade). Esta suíte cobre a parte determinística: `_ao_fechar`
nunca chama hide() na hora, só agenda pra rodar logo depois, fora do evento."""
import sys
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from farol.bandeja.janela import JanelaWebview  # noqa: E402


def _janela_sem_init() -> JanelaWebview:
    """Instância sem rodar __init__ (que precisa do runtime real do pywebview)."""
    j = object.__new__(JanelaWebview)
    j._webview = mock.MagicMock()
    j.janela = mock.MagicMock()
    return j


class TestAoFechar(unittest.TestCase):
    def test_ao_fechar_nunca_chama_hide_na_hora_so_agenda(self):
        j = _janela_sem_init()
        resultado = j._ao_fechar()
        self.assertFalse(resultado, "precisa retornar False pra pedir o cancelamento do fechamento real")
        j.janela.hide.assert_not_called()  # é exatamente isto que causava o bug: hide() na hora, não depois

    def test_hide_roda_pouco_depois_fora_do_evento(self):
        j = _janela_sem_init()
        j._ao_fechar()
        for _ in range(50):
            if j.janela.hide.called:
                break
            time.sleep(0.02)
        j.janela.hide.assert_called_once()

    def test_esconder_depois_de_fechar_nao_propaga_excecao(self):
        """Se hide() falhar (janela já destruída, race rara), só loga — não pode derrubar o Timer/thread."""
        j = _janela_sem_init()
        j.janela.hide.side_effect = RuntimeError("janela já destruída")
        try:
            j._esconder_depois_de_fechar()
        except Exception as e:  # noqa: BLE001
            self.fail(f"_esconder_depois_de_fechar não pode propagar exceção: {e}")


if __name__ == "__main__":
    unittest.main()
