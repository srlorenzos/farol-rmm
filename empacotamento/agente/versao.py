"""Gera os arquivos de versão do PyInstaller a partir de empacotamento/VERSION e sincroniza farol.VERSAO.

Uso: python versao.py <pasta-de-saida>   -> escreve versao-agente.txt e versao-bandeja.txt
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
VERSAO = (RAIZ / "empacotamento" / "VERSION").read_text(encoding="utf-8").strip()

MODELO = """VSVersionInfo(
  ffi=FixedFileInfo(filevers=({a}, {b}, {c}, 0), prodvers=({a}, {b}, {c}, 0), mask=0x3f, flags=0x0, OS=0x40004,
                    fileType=0x1, subtype=0x0, date=(0, 0)),
  kids=[
    StringFileInfo([StringTable('041604b0', [
      StringStruct('CompanyName', 'Farol'),
      StringStruct('FileDescription', '{descricao}'),
      StringStruct('FileVersion', '{v}.0'),
      StringStruct('InternalName', '{interno}'),
      StringStruct('LegalCopyright', 'Farol RMM (MIT)'),
      StringStruct('OriginalFilename', '{arquivo}'),
      StringStruct('ProductName', 'Farol RMM'),
      StringStruct('ProductVersion', '{v}')])]),
    VarFileInfo([VarStruct('Translation', [1046, 1200])])
  ])
"""


def sincronizar_agente() -> None:
    """Mantém agente/farol/__init__.py com a versão única."""
    init = RAIZ / "agente" / "farol" / "__init__.py"
    texto = init.read_text(encoding="utf-8")
    novo = re.sub(r'^VERSAO = ".*"$', f'VERSAO = "{VERSAO}"', texto, flags=re.M)
    if novo != texto:
        init.write_text(novo, encoding="utf-8")
        print(f"farol.VERSAO atualizado para {VERSAO}")


def main(saida: Path) -> None:
    a, b, c = (int(x) for x in VERSAO.split("."))
    saida.mkdir(parents=True, exist_ok=True)
    for nome, desc, interno, arquivo in (
        ("agente", "Farol RMM Agent", "farol-agente", "farol-agente.exe"),
        ("bandeja", "Farol RMM Tray", "farol-bandeja", "farol-bandeja.exe"),
    ):
        (saida / f"versao-{nome}.txt").write_text(
            MODELO.format(a=a, b=b, c=c, v=VERSAO, descricao=desc, interno=interno, arquivo=arquivo), encoding="utf-8")
    sincronizar_agente()


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "empacotamento" / "build")
