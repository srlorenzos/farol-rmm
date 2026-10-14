"""Orquestra a bandeja: a API local (agente/farol/modulos/api_local.py) é responsabilidade do agente
principal (processo SYSTEM) e já roda quando este código entra em ação; aqui só ligamos a janela local
(janela.py), o ícone (tray.py) e o polling de status/notificações pela API local (cliente_local.py)."""
from __future__ import annotations

import logging
import subprocess
import sys
import threading

from farol.modulos.api_local import PORTA_PADRAO

from . import janela, tray
from .cliente_local import ClienteLocal, ErroClienteLocal
from .recursos.icone import COR_MARCA_PADRAO

log = logging.getLogger("farol.bandeja")

INTERVALO_POLL_S = 10.0


def _copiar_para_area_de_transferencia(texto: str) -> None:
    try:
        if sys.platform == "win32":
            subprocess.run(["clip"], input=texto.encode("utf-16le"), check=False, timeout=5)
        elif sys.platform == "darwin":
            subprocess.run(["pbcopy"], input=texto.encode("utf-8"), check=False, timeout=5)
        else:
            subprocess.run(["xclip", "-selection", "clipboard"], input=texto.encode("utf-8"), check=False, timeout=5)
    except Exception:
        log.debug("não foi possível copiar os dados do sistema para a área de transferência")


class AplicacaoBandeja:
    def __init__(self, porta_api: int = PORTA_PADRAO):
        self.cliente = ClienteLocal(porta=porta_api)
        self.parar_evento = threading.Event()
        self.url: str | None = None
        self.servidor_ui = None
        self.janela_webview: janela.JanelaWebview | None = None
        self.bandeja: tray.Bandeja | None = None

    # ------------------------------------------------------------ ações (menu e clique na bandeja)
    def abrir(self) -> None:
        if self.janela_webview:
            self.janela_webview.mostrar()
        elif self.url:
            janela.abrir_no_navegador(self.url)

    def copiar_dados(self) -> None:
        try:
            s = self.cliente.sistema()
        except ErroClienteLocal as e:
            log.warning("não foi possível copiar os dados do sistema: %s", e)
            return
        texto = "\n".join(f"{k}: {v}" for k, v in s.items() if k not in ("farol", "discos"))
        _copiar_para_area_de_transferencia(texto)
        if self.bandeja:
            self.bandeja.notificar("Farol", "Dados do sistema copiados para a área de transferência.")

    def sair(self) -> None:
        self.parar_evento.set()
        if self.bandeja:
            self.bandeja.parar()
        # Mata o processo da bandeja direto: o loop do pywebview (se estiver na thread principal) não
        # tem uma forma universal de ser interrompido de outra thread em todos os backends. O agente
        # continua rodando — é um processo separado.
        import os
        os._exit(0)

    # ------------------------------------------------------------ polling de status/notificações
    def _loop_status(self) -> None:
        tem_resposta_nao_lida = False
        while not self.parar_evento.is_set():
            try:
                s = self.cliente.sistema()
                conectado = bool((s.get("farol") or {}).get("conectado"))
            except ErroClienteLocal as e:
                conectado = False
                log.debug("api local do agente indisponível: %s", e)
            if self.bandeja:
                status = "resposta" if tem_resposta_nao_lida else ("conectado" if conectado else "desconectado")
                self.bandeja.definir_status(status, titulo=f"Suporte — {'conectado' if conectado else 'desconectado'}")
            try:
                for n in self.cliente.notificacoes():
                    tem_resposta_nao_lida = True
                    if self.bandeja:
                        self.bandeja.definir_status("resposta")
                        self.bandeja.notificar("Resposta no chamado", n.get("assunto") or f"Chamado #{n.get('chamado_id')}")
            except ErroClienteLocal:
                pass
            self.parar_evento.wait(INTERVALO_POLL_S)

    # ------------------------------------------------------------ ciclo de vida
    def executar(self) -> int:
        empresa, cor = "Farol", COR_MARCA_PADRAO
        try:
            cfg = self.cliente.bandeja_config()
            empresa = cfg.get("empresa") or empresa
            cor = cfg.get("cor") or cor
        except ErroClienteLocal as e:
            log.info("sem a configuração da bandeja ainda (%s); usando o padrão", e)

        self.servidor_ui, self.url = janela.iniciar_servidor(
            porta_api=self.cliente.porta, token_api=self.cliente.token() or "", empresa=empresa, cor=cor)

        self.bandeja = tray.Bandeja(
            titulo=f"Suporte {empresa}", cor_marca=cor, ao_abrir=self.abrir, ao_novo_chamado=self.abrir,
            ao_meus_chamados=self.abrir, ao_copiar_dados=self.copiar_dados, ao_sobre=self.abrir, ao_sair=self.sair,
        )
        threading.Thread(target=self._loop_status, name="farol-bandeja-status", daemon=True).start()

        if janela.pywebview_disponivel():
            try:
                self.janela_webview = janela.JanelaWebview(self.url, f"Suporte {empresa}")
                self.bandeja.executar_em_thread()
                self.janela_webview.iniciar_loop()  # bloqueia: precisa ser a thread principal
                return 0
            except Exception:
                log.exception("pywebview não pôde iniciar; usando o navegador padrão como alternativa")
                self.janela_webview = None

        self.bandeja.executar()  # bloqueia; "Abrir" cai no navegador padrão
        return 0
