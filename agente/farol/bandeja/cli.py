"""Linha de comando da bandeja: `rodar` (padrão, se nenhum comando for passado), `instalar-autostart`,
`remover-autostart`, `status-autostart`.

Observação: o instalador .exe (empacotamento/, agente/farol/instalacao.py) já registra e abre a bandeja
sozinho — usa a MESMA chave e o MESMO nome do Registro daqui (CHAVE_RUN/VALOR_RUN), então os dois são
compatíveis (quem gravar por último prevalece, sem duplicar entradas). Estes comandos existem para rodar
a bandeja "solta" (python farol_bandeja.py, ou farol-bandeja.exe fora do instalador) manualmente.
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

WINDOWS = sys.platform == "win32"
CHAVE_RUN = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
VALOR_RUN = "FarolBandeja"

log = logging.getLogger("farol.bandeja")


def _comando_padrao() -> str:
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}"'
    return f'"{sys.executable}" "{Path(sys.argv[0]).resolve()}" rodar'


def cmd_instalar_autostart(args) -> int:
    if not WINDOWS:
        print("instalar-autostart só é suportado no Windows.")
        return 1
    import winreg
    raiz = winreg.HKEY_CURRENT_USER if args.usuario_atual else winreg.HKEY_LOCAL_MACHINE
    comando = args.comando or _comando_padrao()
    try:
        with winreg.OpenKey(raiz, CHAVE_RUN, 0, winreg.KEY_SET_VALUE) as k:
            winreg.SetValueEx(k, VALOR_RUN, 0, winreg.REG_SZ, comando)
    except PermissionError:
        print("Sem permissão para gravar em HKLM; rode como administrador ou use --usuario-atual.")
        return 2
    print(f"Autostart registrado em {'HKCU' if args.usuario_atual else 'HKLM'}\\...\\Run\\{VALOR_RUN} = {comando}")
    return 0


def cmd_remover_autostart(_args) -> int:
    if not WINDOWS:
        print("não é Windows; nada a remover.")
        return 1
    import winreg
    removido = False
    for raiz in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        try:
            with winreg.OpenKey(raiz, CHAVE_RUN, 0, winreg.KEY_SET_VALUE) as k:
                winreg.DeleteValue(k, VALOR_RUN)
                removido = True
        except OSError:
            pass
    print("Autostart removido." if removido else "Nenhum autostart da bandeja estava registrado.")
    return 0


def cmd_status_autostart(_args) -> int:
    if not WINDOWS:
        print("não é Windows.")
        return 1
    import winreg
    for nome, raiz in (("HKCU", winreg.HKEY_CURRENT_USER), ("HKLM", winreg.HKEY_LOCAL_MACHINE)):
        try:
            with winreg.OpenKey(raiz, CHAVE_RUN, 0, winreg.KEY_READ) as k:
                print(f"{nome}: {winreg.QueryValueEx(k, VALOR_RUN)[0]}")
        except OSError:
            print(f"{nome}: (não registrado)")
    return 0


def cmd_rodar(args) -> int:
    from farol.modulos.api_local import PORTA_PADRAO

    from .app import AplicacaoBandeja
    porta = args.porta or PORTA_PADRAO
    return AplicacaoBandeja(porta_api=porta).executar()


def _ajustar_saida() -> None:
    """Evita UnicodeEncodeError em consoles com codepage legado (mesmo ajuste do farol_agente.py)."""
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass


def main(argv=None) -> int:
    _ajustar_saida()
    p = argparse.ArgumentParser(prog="farol-bandeja", description="Bandeja do Farol RMM: ícone + chamados")
    p.add_argument("-v", "--verbose", action="store_true", help="log detalhado")
    sub = p.add_subparsers(dest="comando")

    pr = sub.add_parser("rodar", help="abre a bandeja (é o padrão se nenhum comando for passado)")
    pr.add_argument("--porta", type=int, default=None, help="porta da API local do agente (padrão: $FAROL_BANDEJA_PORTA ou 8421)")

    pi = sub.add_parser("instalar-autostart", help="registra a bandeja para abrir no login do Windows")
    pi.add_argument("--usuario-atual", action="store_true", help="grava em HKCU (só este usuário) em vez de HKLM (todos os usuários)")
    pi.add_argument("--comando", help="comando completo a gravar no Registro (padrão: este executável/script)")

    sub.add_parser("remover-autostart", help="remove a entrada de autostart (HKCU e HKLM)")
    sub.add_parser("status-autostart", help="mostra o que está gravado em HKCU/HKLM")

    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    comando = args.comando or "rodar"
    if comando == "rodar":
        if not hasattr(args, "porta"):
            args.porta = None
        return cmd_rodar(args)
    if comando == "instalar-autostart":
        return cmd_instalar_autostart(args)
    if comando == "remover-autostart":
        return cmd_remover_autostart(args)
    if comando == "status-autostart":
        return cmd_status_autostart(args)
    p.error(f"comando desconhecido: {comando}")
    return 2
