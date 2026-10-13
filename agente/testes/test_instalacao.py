"""Testes da instalação no Windows: só o que roda sem administrador (XML da tarefa, detecção de modo, parada do loop)."""
import argparse
import json
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
