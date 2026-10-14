"""Ícone na área de notificação do Windows (pystray + Pillow). Ponto de status (verde/cinza/laranja),
menu de clique direito e notificações (pystray; win10toast como alternativa leve, se instalado)."""
from __future__ import annotations

import logging
import threading

from .recursos import icone as gerador_icone

log = logging.getLogger("farol.bandeja")


class Bandeja:
    def __init__(self, *, titulo: str, cor_marca: str, ao_abrir, ao_novo_chamado, ao_meus_chamados,
                 ao_copiar_dados, ao_sobre, ao_sair):
        import pystray
        self._pystray = pystray
        self.cor_marca = cor_marca
        self.status = "desconectado"
        self.icon = pystray.Icon(
            "farol-bandeja",
            icon=gerador_icone.gerar(64, self.status, cor_marca),
            title=titulo,
            menu=pystray.Menu(
                pystray.MenuItem("Abrir", self._chamar(ao_abrir), default=True),
                pystray.MenuItem("Novo chamado", self._chamar(ao_novo_chamado)),
                pystray.MenuItem("Meus chamados", self._chamar(ao_meus_chamados)),
                pystray.MenuItem("Copiar dados do sistema", self._chamar(ao_copiar_dados)),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Sobre", self._chamar(ao_sobre)),
                pystray.MenuItem("Sair", self._chamar(ao_sair)),
            ),
        )

    @staticmethod
    def _chamar(fn):
        """pystray passa (icon, item) ao handler; nossas ações não têm argumentos."""
        return lambda icon=None, item=None: fn()

    def definir_status(self, status: str, titulo: str | None = None) -> None:
        if status == self.status and titulo is None:
            return
        self.status = status
        try:
            self.icon.icon = gerador_icone.gerar(64, status, self.cor_marca)
            if titulo:
                self.icon.title = titulo[:127]
        except Exception:
            log.exception("falha ao atualizar o ícone da bandeja")

    def notificar(self, titulo: str, mensagem: str) -> None:
        try:
            self.icon.notify(mensagem, titulo)
            return
        except Exception:
            log.debug("notificação pelo pystray falhou; tentando win10toast")
        try:
            from win10toast import ToastNotifier
            ToastNotifier().show_toast(titulo, mensagem, duration=6, threaded=True)
        except Exception:
            log.debug("sem win10toast disponível; notificação não mostrada")

    def executar(self) -> None:
        """Bloqueia a thread atual (chame na thread principal quando não houver pywebview)."""
        self.icon.run()

    def executar_em_thread(self) -> threading.Thread:
        """Para quando o pywebview precisa da thread principal para o próprio loop de GUI."""
        t = threading.Thread(target=self.icon.run, name="farol-bandeja-tray", daemon=True)
        t.start()
        return t

    def parar(self) -> None:
        try:
            self.icon.stop()
        except Exception:
            pass
