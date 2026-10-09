"""Testes do agente: python -m unittest (na pasta agente/)."""
import json
import os
import stat
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psutil  # noqa: E402

import farol_agente as fa  # noqa: E402


class TestUrl(unittest.TestCase):
    def test_https_aceito(self):
        self.assertEqual(fa.validar_url_servidor("https://farol.exemplo.com/"), "https://farol.exemplo.com")

    def test_http_local_aceito(self):
        for url in ("http://127.0.0.1:8420", "http://localhost:8420", "http://[::1]:8420"):
            self.assertTrue(fa.validar_url_servidor(url).startswith("http://"))

    def test_http_remoto_recusado(self):
        for url in ("http://10.0.0.5:8420", "http://farol.exemplo.com", "http://127.0.0.1.nip.io"):
            with self.assertRaises(fa.ErroConfig):
                fa.validar_url_servidor(url)

    def test_http_remoto_com_inseguro(self):
        self.assertEqual(fa.validar_url_servidor("http://10.0.0.5:8420", inseguro=True), "http://10.0.0.5:8420")

    def test_esquema_invalido(self):
        for url in ("ftp://x", "farol.exemplo.com", "file:///etc/passwd"):
            with self.assertRaises(fa.ErroConfig):
                fa.validar_url_servidor(url)


class TestColeta(unittest.TestCase):
    def test_metricas_estrutura(self):
        m = fa.coletar_metricas(intervalo_cpu=0.1)
        self.assertEqual(set(m), {"cpu", "ram_usada", "ram_total", "discos", "uptime", "usuario", "ip"})
        self.assertTrue(0 <= m["cpu"] <= 100)
        self.assertGreater(m["ram_total"], 0)
        self.assertLessEqual(m["ram_usada"], m["ram_total"])
        self.assertGreater(m["uptime"], 0)
        self.assertIsInstance(m["discos"], list)
        self.assertGreater(len(m["discos"]), 0)
        for d in m["discos"]:
            self.assertEqual(set(d), {"ponto", "fs", "total", "usado", "pct"})
            self.assertTrue(0 <= d["pct"] <= 100)

    def test_inventario_estrutura(self):
        inv = fa.coletar_inventario()
        self.assertEqual(set(inv), {"sistema", "hardware", "rede", "discos", "softwares"})
        self.assertTrue(inv["sistema"]["hostname"])
        self.assertGreater(inv["hardware"]["nucleos_logicos"], 0)
        self.assertIsInstance(inv["rede"], list)
        for s in inv["softwares"]:
            self.assertIn("nome", s)
            self.assertIn("versao", s)

    def test_payload_checkin(self):
        p = fa.montar_checkin("https://farol.exemplo.com", com_inventario=False, intervalo_cpu=0.1)
        self.assertEqual(set(p), {"metricas", "info"})
        self.assertEqual(p["info"]["versao_agente"], fa.VERSAO)
        self.assertTrue(p["info"]["hostname"])
        json.dumps(p)  # serializável
        p2 = fa.montar_checkin(None, com_inventario=True, intervalo_cpu=0.1)
        self.assertIn("inventario", p2)
        self.assertLessEqual(len(p2["inventario"]["softwares"]), 5000)
        json.dumps(p2)


class TestExecucao(unittest.TestCase):
    def job(self, conteudo, shell="python", timeout=30):
        return {"id": 1, "shell": shell, "conteudo": conteudo, "timeout": timeout}

    def test_sucesso_captura_saidas(self):
        r = fa.executar_job(self.job("import sys\nprint('olá')\nprint('erro', file=sys.stderr)\nsys.exit(3)"))
        self.assertEqual(r["job_id"], 1)
        self.assertEqual(r["codigo_saida"], 3)
        self.assertEqual(r["stdout"].strip(), "olá")
        self.assertEqual(r["stderr"].strip(), "erro")
        self.assertFalse(r["timeout"])
        self.assertIsNone(r["erro"])

    def test_timeout_mata_arvore(self):
        script = (
            "import subprocess, sys, time\n"
            "f = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])\n"
            "print(f.pid, flush=True)\n"
            "time.sleep(60)\n"
        )
        inicio = time.monotonic()
        r = fa.executar_job(self.job(script, timeout=2))
        self.assertLess(time.monotonic() - inicio, 20)
        self.assertTrue(r["timeout"])
        self.assertIsNone(r["codigo_saida"])
        self.assertIn("tempo limite", r["erro"])
        pid_filho = int(r["stdout"].split()[0])
        time.sleep(0.5)
        vivo = psutil.pid_exists(pid_filho) and psutil.Process(pid_filho).status() != psutil.STATUS_ZOMBIE
        self.assertFalse(vivo, "processo neto deveria ter sido encerrado")

    def test_truncamento(self):
        r = fa.executar_job(self.job("print('x' * 200000)"))
        self.assertLessEqual(len(r["stdout"].encode()), fa.MAX_SAIDA + 100)
        self.assertIn("truncada", r["stdout"])

    def test_shell_invalido(self):
        r = fa.executar_job(self.job("ls", shell="zsh"))
        self.assertIsNotNone(r["erro"])
        self.assertIsNone(r["codigo_saida"])

    @unittest.skipUnless(fa.WINDOWS, "somente Windows")
    def test_cmd_e_powershell(self):
        self.assertEqual(fa.executar_job(self.job("echo ola", shell="cmd"))["stdout"].strip(), "ola")
        r = fa.executar_job(self.job("Write-Output 'ação'", shell="powershell"))
        self.assertEqual(r["stdout"].strip(), "ação")

    @unittest.skipIf(fa.WINDOWS, "somente Linux/macOS")
    def test_bash(self):
        self.assertEqual(fa.executar_job(self.job("echo ola", shell="bash"))["stdout"].strip(), "ola")


class TestConfig(unittest.TestCase):
    def test_salvar_e_carregar(self):
        with tempfile.TemporaryDirectory() as d:
            caminho = Path(d) / "sub" / "config.json"
            dados = {"servidor": "https://farol.exemplo.com", "agente_id": "abc", "segredo": "s3cr3t", "intervalo": 15}
            fa.salvar_config(caminho, dados)
            self.assertEqual(fa.carregar_config(caminho)["segredo"], "s3cr3t")
            if not fa.WINDOWS:
                self.assertEqual(stat.S_IMODE(os.stat(caminho).st_mode), 0o600)

    def test_config_com_http_remoto_e_recusada(self):
        with tempfile.TemporaryDirectory() as d:
            caminho = Path(d) / "config.json"
            caminho.write_text(json.dumps({"servidor": "http://10.1.1.1", "agente_id": "a", "segredo": "b"}))
            with self.assertRaises(fa.ErroConfig):
                fa.carregar_config(caminho)

    def test_config_ausente(self):
        with self.assertRaises(fa.ErroConfig):
            fa.carregar_config(Path(tempfile.gettempdir()) / "nao-existe-farol.json")


if __name__ == "__main__":
    unittest.main()
