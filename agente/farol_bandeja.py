#!/usr/bin/env python3
"""Farol RMM — bandeja do agente: ícone na área de notificação + chamados de suporte (o código fica no
pacote farol/bandeja/). Processo separado do agente principal, roda na sessão do usuário (sem o segredo
do agente) e fala com ele só pela API local em 127.0.0.1 (agente/farol/modulos/api_local.py).

Uso:
  python farol_bandeja.py                       # abre a bandeja (padrão)
  python farol_bandeja.py rodar --porta 8421     # idem, apontando para outra porta da API local
  python farol_bandeja.py instalar-autostart     # registra para abrir no login (todos os usuários)
  python farol_bandeja.py status-autostart       # mostra o que está registrado

Depende de pystray, Pillow, mss e (no Windows) pywebview — veja agente/requirements.txt. Sem pywebview
(ou fora do Windows), cai sozinha no fallback: a mesma página servida em 127.0.0.1, aberta no navegador
padrão. Funciona tanto rodando direto (este arquivo) quanto empacotada com PyInstaller (farol-bandeja.exe).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from farol.bandeja.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
