"""Testes da página única da bandeja (agente/farol/bandeja/ui.py): montagem do HTML, escape de dados do
admin (nome da empresa/cor vêm de Configurações > Bandeja do agente no painel — nunca confiar neles sem
escapar) e a presença do código que liga/desliga recursos (chamados/print/ações rápidas) conforme o que
servidor/src/modulos/chamados/index.js expõe em configBandeja().recursos."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from farol.bandeja import ui  # noqa: E402


class TestMontarHtml(unittest.TestCase):
    def test_estrutura_basica(self):
        html = ui.montar_html(porta_api=8421, token="tok123", empresa="Minha Empresa", cor_marca="#112233")
        self.assertTrue(html.startswith("<!doctype html>"))
        self.assertIn("<title>Suporte Minha Empresa</title>", html)
        self.assertIn("#112233", html)
        self.assertIn("8421", html)
        self.assertIn("tok123", html)

    def test_empresa_com_html_e_escapada_no_titulo(self):
        html = ui.montar_html(porta_api=8421, token="t", empresa='<script>alert(1)</script>')
        self.assertNotIn("<script>alert(1)</script>", html.split("<style>")[0])  # fora do <title> teria que estar escapado
        self.assertIn("&lt;script&gt;", html)

    def test_cor_invalida_cai_no_padrao(self):
        html = ui.montar_html(porta_api=8421, token="t", cor_marca="nao-eh-cor")
        self.assertIn(ui.COR_MARCA_PADRAO, html)
        self.assertNotIn("nao-eh-cor", html)

    def test_cor_valida_e_usada(self):
        html = ui.montar_html(porta_api=8421, token="t", cor_marca="#abcdef")
        self.assertIn("#abcdef", html)

    def test_token_vai_pro_json_inicial_sem_quebrar_a_tag_script(self):
        # token poderia (em tese) conter caracteres de fechamento de tag; aqui é hex, mas o _json_js
        # genérico escapa '</' em qualquer campo — confere que o mecanismo está ligado.
        html = ui.montar_html(porta_api=8421, token="abc</script>def", empresa="Farol")
        self.assertNotIn("</script>def", html)


class TestRecursosLigaDesliga(unittest.TestCase):
    """O HTML/JS embutido precisa esconder Chamados/Novo chamado, o botão de print e as ações rápidas
    quando o admin desliga o recurso correspondente em Configurações > Bandeja do agente (painel)."""

    def test_js_consulta_recursos_da_config_carregada(self):
        html = ui.montar_html(porta_api=8421, token="t")
        self.assertIn("function recursoAtivo(", html)
        self.assertIn("F.config && F.config.recursos", html)

    def test_aba_chamados_e_novo_sao_escondidas_quando_recurso_desligado(self):
        html = ui.montar_html(porta_api=8421, token="t")
        self.assertIn('data-aba="chamados"', html)
        self.assertIn("abaChamados.hidden = semChamados", html)
        self.assertIn("abaNovo.hidden = semChamados", html)

    def test_botao_de_print_respeita_o_recurso(self):
        html = ui.montar_html(porta_api=8421, token="t")
        self.assertIn("recursoAtivo('print')", html)
        self.assertIn('id="btnAnexarPrint"', html)

    def test_acoes_rapidas_respeita_o_recurso(self):
        html = ui.montar_html(porta_api=8421, token="t")
        self.assertIn("recursoAtivo('acoesRapidas')", html)

    def test_sem_config_carregada_ainda_assume_ligado(self):
        # recursoAtivo(nome) só olha F.config.recursos se já existir; antes disso (corrida possível no
        # primeiro carregamento), assume ligado — nunca esconde por padrão (fail-open na UX, não na segurança).
        html = ui.montar_html(porta_api=8421, token="t")
        self.assertIn("return !r || r[nome] !== false", html)


if __name__ == "__main__":
    unittest.main()
