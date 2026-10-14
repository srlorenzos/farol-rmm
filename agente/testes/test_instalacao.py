"""Testes da instalação no Windows: só o que roda sem administrador (XML da tarefa, detecção de modo, parada do loop)."""
import argparse
import json
import logging
import logging.handlers
import os
import sys
import tempfile
import threading
import time
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from farol import cli, instalacao  # noqa: E402

cli._ajustar_saida()  # evita UnicodeEncodeError nos _dizer() de instalar_completo quando a saída é redirecionada


class TesteInstalacao(unittest.TestCase):
    def test_xml_da_tarefa_e_valido_e_escapa(self):
        xml = instalacao._xml_tarefa(Path(r"C:\Program Files\Farol\farol-agente.exe"), Path(r"C:\x & y\c.json"))
        raiz = ET.fromstring(xml.split("?>", 1)[1])
        ns = {"t": "http://schemas.microsoft.com/windows/2004/02/mit/task"}
        self.assertEqual(raiz.find(".//t:Command", ns).text, r"C:\Program Files\Farol\farol-agente.exe")
        self.assertIn(r'--config "C:\x & y\c.json"', raiz.find(".//t:Arguments", ns).text)
        self.assertEqual(raiz.find(".//t:UserId", ns).text, "S-1-5-18")

    def test_python_nao_e_onefile(self):
        self.assertFalse(instalacao.eh_onefile())

    def test_instalar_sem_token_e_sem_config_falha(self):
        args = argparse.Namespace(servidor=None, token=None, config=str(Path(tempfile.gettempdir()) / "nao-existe.json"),
                                  nome_servico="FarolTeste", pasta=None, modo=None, inseguro=False, elevado=False,
                                  silencioso=True)
        with mock.patch.object(instalacao, "eh_admin", return_value=True):
            self.assertEqual(instalacao.instalar_completo(args, lambda a: 0), 5)

    # ---------------------------------------------------------------- erro real do SCM/schtasks vira ErroInstalacao
    def test_servico_erro_generico_vira_erro_instalacao_com_motivo(self):
        """Qualquer falha do SCM (sem admin de verdade, pywin32 com problema, o que for) tem que virar uma
        ErroInstalacao com o motivo de verdade — nunca uma exceção crua escapando sem explicação."""
        with mock.patch("win32serviceutil.InstallService", side_effect=OSError("falha simulada do SCM")):
            with self.assertRaises(instalacao.ErroInstalacao) as ctx:
                instalacao._instalar_servico("FarolTesteXYZ", Path(r"C:\x\farol-agente.exe"), None)
        self.assertIn("falha simulada do SCM", str(ctx.exception))

    def test_tarefa_erro_generico_vira_erro_instalacao_com_motivo(self):
        with mock.patch.object(instalacao, "_rodar", side_effect=OSError("schtasks sumiu")):
            with self.assertRaises(instalacao.ErroInstalacao) as ctx:
                instalacao._instalar_tarefa(Path(r"C:\x\farol-agente.exe"), None)
        self.assertIn("schtasks sumiu", str(ctx.exception))

    # ---------------------------------------------------------------- fallback automático serviço <-> tarefa
    def _args_instalar(self, destino: Path, config_path: Path, modo=None) -> argparse.Namespace:
        return argparse.Namespace(servidor=None, token="tok-fake", config=str(config_path), nome_servico="FarolTeste",
                                  pasta=str(destino), modo=modo, inseguro=False, elevado=False, silencioso=True)

    @staticmethod
    def _registrar_fake(config_path: Path):
        def registrar(_args):
            config_path.write_text("{}", encoding="utf-8")
            return 0
        return registrar

    def test_instalar_completo_cai_para_tarefa_quando_servico_falha(self):
        with tempfile.TemporaryDirectory() as d:
            destino, config_path = Path(d) / "dest", Path(d) / "c.json"
            args = self._args_instalar(destino, config_path)
            with mock.patch.object(instalacao, "eh_admin", return_value=True), \
                 mock.patch.object(instalacao, "eh_onefile", return_value=False), \
                 mock.patch.object(instalacao, "_parar_servico"), mock.patch.object(instalacao, "_remover_tarefa"), \
                 mock.patch.object(instalacao, "_encerrar_bandeja"), \
                 mock.patch.object(instalacao, "_copiar_arquivos", return_value=(destino / "farol-agente.exe", None)), \
                 mock.patch.object(instalacao, "_instalar_servico", side_effect=instalacao.ErroInstalacao("SCM indisponível")), \
                 mock.patch.object(instalacao, "_instalar_tarefa") as tarefa_mock:
                codigo = instalacao.instalar_completo(args, self._registrar_fake(config_path))
            self.assertEqual(codigo, 0, "deveria ter caído para a Tarefa Agendada e dado certo")
            tarefa_mock.assert_called_once()

    def test_instalar_completo_sem_nada_funcionando_retorna_erro_claro_e_nao_zero(self):
        with tempfile.TemporaryDirectory() as d:
            destino, config_path = Path(d) / "dest", Path(d) / "c.json"
            args = self._args_instalar(destino, config_path)
            with mock.patch.object(instalacao, "eh_admin", return_value=True), \
                 mock.patch.object(instalacao, "eh_onefile", return_value=False), \
                 mock.patch.object(instalacao, "_parar_servico"), mock.patch.object(instalacao, "_remover_tarefa"), \
                 mock.patch.object(instalacao, "_encerrar_bandeja"), \
                 mock.patch.object(instalacao, "_copiar_arquivos", return_value=(destino / "farol-agente.exe", None)), \
                 mock.patch.object(instalacao, "_instalar_servico", side_effect=instalacao.ErroInstalacao("motivo-do-servico")), \
                 mock.patch.object(instalacao, "_instalar_tarefa", side_effect=instalacao.ErroInstalacao("motivo-da-tarefa")), \
                 self.assertLogs(level="ERROR") as logs:
                codigo = instalacao.instalar_completo(args, self._registrar_fake(config_path))
            self.assertEqual(codigo, 5, "nunca pode terminar com sucesso quando nada ficou rodando")
            texto = " ".join(logs.output)
            self.assertIn("motivo-do-servico", texto)
            self.assertIn("motivo-da-tarefa", texto)
            self.assertIn("Administrador", texto)
            self.assertIn("rodar", texto, "precisa indicar como iniciar manualmente")

    def test_instalar_completo_com_modo_explicito_nao_tenta_o_outro(self):
        """--modo é uma escolha explícita do usuário: uma tentativa só, sem cair pro outro modo."""
        with tempfile.TemporaryDirectory() as d:
            destino, config_path = Path(d) / "dest", Path(d) / "c.json"
            args = self._args_instalar(destino, config_path, modo="servico")
            with mock.patch.object(instalacao, "eh_admin", return_value=True), \
                 mock.patch.object(instalacao, "eh_onefile", return_value=False), \
                 mock.patch.object(instalacao, "_parar_servico"), mock.patch.object(instalacao, "_remover_tarefa"), \
                 mock.patch.object(instalacao, "_encerrar_bandeja"), \
                 mock.patch.object(instalacao, "_copiar_arquivos", return_value=(destino / "farol-agente.exe", None)), \
                 mock.patch.object(instalacao, "_instalar_servico", side_effect=instalacao.ErroInstalacao("falhou")), \
                 mock.patch.object(instalacao, "_instalar_tarefa") as tarefa_mock:
                codigo = instalacao.instalar_completo(args, self._registrar_fake(config_path))
            self.assertEqual(codigo, 5)
            tarefa_mock.assert_not_called()

    # ---------------------------------------------------------------- log em arquivo (cli._configurar_log)
    def _fechar_handlers_novos(self, handlers_antes):
        """RotatingFileHandler mantém o arquivo aberto; fecha e desregistra antes de qualquer limpeza de
        pasta temporária (Windows não deixa apagar um arquivo com handle aberto)."""
        for h in logging.getLogger().handlers[len(handlers_antes):]:
            h.close()
        logging.getLogger().handlers[:] = handlers_antes

    def test_configurar_log_grava_arquivo(self):
        handlers_antes = logging.getLogger().handlers[:]
        with tempfile.TemporaryDirectory() as d:
            caminho_log = Path(d) / "agente.log"
            try:
                with mock.patch.object(cli, "caminho_log_padrao", return_value=caminho_log):
                    cli._configurar_log(False)
                    logging.getLogger("farol").error("mensagem de teste only-for-this-test")
                self.assertTrue(caminho_log.exists(), "o log em arquivo tem que existir depois de _configurar_log")
                self.assertIn("mensagem de teste only-for-this-test", caminho_log.read_text(encoding="utf-8"))
            finally:
                self._fechar_handlers_novos(handlers_antes)

    def test_configurar_log_cai_para_temp_se_a_pasta_principal_nao_puder_ser_criada(self):
        handlers_antes = logging.getLogger().handlers[:]
        try:
            caminho_impossivel = Path("Z:\\pasta-que-nao-existe-de-verdade\\agente.log")
            with mock.patch.object(cli, "caminho_log_padrao", return_value=caminho_impossivel):
                cli._configurar_log(False)  # não pode lançar, mesmo sem conseguir escrever no caminho principal
            arquivo = [h for h in logging.getLogger().handlers if isinstance(h, logging.handlers.RotatingFileHandler)]
            self.assertTrue(arquivo, "deveria ter caído para %TEMP%\\farol-agente.log")
            self.assertNotEqual(Path(arquivo[0].baseFilename), caminho_impossivel)
        finally:
            self._fechar_handlers_novos(handlers_antes)

    def test_argv_para_log_mascara_o_token(self):
        texto = cli._argv_para_log(["instalar", "--servidor", "https://x", "--token", "segredo-nao-pode-vazar"])
        self.assertNotIn("segredo-nao-pode-vazar", texto)
        self.assertIn("***", texto)

    def test_loop_para_com_o_evento_do_servico(self):
        with tempfile.TemporaryDirectory() as d:
            caminho = Path(d) / "c.json"
            caminho.write_text(json.dumps({"servidor": "http://127.0.0.1:9", "agente_id": "x", "segredo": "y",
                                           "intervalo": 3600}), encoding="utf-8")
            parar = threading.Event()
            args = argparse.Namespace(config=str(caminho), uma_vez=False, sem_tempo_real=True, parar=parar)
            r = []
            t = threading.Thread(target=lambda: r.append(cli.cmd_rodar(args)))
            t.start()
            time.sleep(1.5)
            parar.set()
            t.join(20)
            self.assertFalse(t.is_alive(), "o loop deveria acordar e sair quando o serviço pede parada")
            self.assertEqual(r, [0])


if __name__ == "__main__":
    unittest.main()
