"""Serviço do Windows ("Farol RMM Agent") hospedado pelo próprio farol-agente.exe via pywin32.

O gerenciador de serviços inicia `farol-agente.exe servico --config ... --nome-servico ...`; este módulo conecta o
processo ao gerenciador e roda o mesmo loop do comando `rodar`, parando quando o Windows pede.
"""
from __future__ import annotations

import argparse
import logging
import logging.handlers
import os
import sys
import threading
from pathlib import Path

import servicemanager
import win32event
import win32service
import win32serviceutil

from .config import caminho_config_padrao
from .instalacao import NOME_EXIBICAO, NOME_SERVICO


def _configurar_log(config: Path) -> None:
    """Sem console no serviço: o log vai para um arquivo ao lado da configuração."""
    config.parent.mkdir(parents=True, exist_ok=True)
    h = logging.handlers.RotatingFileHandler(config.parent / "agente.log", maxBytes=2_000_000, backupCount=3,
                                             encoding="utf-8")
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    raiz = logging.getLogger()
    raiz.handlers[:] = [h]
    raiz.setLevel(logging.INFO)


class ServicoFarol(win32serviceutil.ServiceFramework):
    _svc_name_ = NOME_SERVICO
    _svc_display_name_ = NOME_EXIBICAO

    def __init__(self, args):
        super().__init__(args)
        self.parar = threading.Event()

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        self.parar.set()
        # o loop acorda ao ver o evento (cmd_rodar usa o mesmo Event para o intervalo de espera)

    def SvcDoRun(self):
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE, servicemanager.PYS_SERVICE_STARTED,
                              (self._svc_name_, ""))
        p = argparse.ArgumentParser(add_help=False)
        p.add_argument("servico")
        p.add_argument("--config")
        p.add_argument("--nome-servico")
        a, _ = p.parse_known_args(sys.argv[1:])
        config = Path(a.config) if a.config else caminho_config_padrao()
        _configurar_log(config)
        log = logging.getLogger("farol")
        codigo = 1
        try:
            from .cli import cmd_rodar
            os.chdir(os.path.dirname(sys.executable))  # o Windows inicia serviços em System32
            codigo = cmd_rodar(argparse.Namespace(config=str(config), uma_vez=False, sem_tempo_real=False,
                                                  parar=self.parar))
        except Exception:  # noqa: BLE001
            log.exception("o agente terminou com erro")
        if not self.parar.is_set():
            # Saída sem pedido de parada = falha: o código diferente de zero aciona a recuperação do serviço.
            self.ExitCode = codigo or 1
            log.error("o loop do agente terminou sozinho (código %s)", codigo)
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE, servicemanager.PYS_SERVICE_STOPPED,
                              (self._svc_name_, ""))


def executar() -> int:
    """Ponto de entrada de `farol-agente.exe servico`: entrega o processo ao gerenciador de serviços."""
    servicemanager.Initialize()
    servicemanager.PrepareToHostSingle(ServicoFarol)
    try:
        servicemanager.StartServiceCtrlDispatcher()
    except Exception as e:  # noqa: BLE001 - erro 1063 quando iniciado a mão, fora do gerenciador
        print("Este comando é chamado pelo Windows (serviço). Para instalar, use: farol-agente.exe instalar ...\n"
              f"Detalhe: {e}")
        return 1
    return 0
