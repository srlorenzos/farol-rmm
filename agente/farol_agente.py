#!/usr/bin/env python3
"""Farol RMM — ponto de entrada do agente (o código fica no pacote farol/).

Uso:
  python farol_agente.py instalar --servidor https://farol.exemplo.com --token TOKEN
  python farol_agente.py rodar             # loop principal (check-in + canal em tempo real)
  python farol_agente.py rodar --uma-vez   # um check-in e sai
  python farol_agente.py modulos           # lista comandos e sessões disponíveis

Em produção o servidor entrega o mesmo código empacotado: /download/farol-agente.pyz
(python farol-agente.pyz rodar). Depende apenas da biblioteca padrão + psutil.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from farol.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
