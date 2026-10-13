# PyInstaller: bandeja do Farol (sem console). Ponto de entrada criado em agente/farol_bandeja.py.
import os
from pathlib import Path
import sys
from PyInstaller.utils.hooks import collect_submodules

RAIZ = Path(SPECPATH).resolve().parents[1]
EMP = RAIZ / "empacotamento"
sys.path.insert(0, str(RAIZ / "agente"))  # para o collect_submodules achar o pacote farol
ENTRADA = RAIZ / "agente" / "farol_bandeja.py"
if not ENTRADA.exists():
    raise SystemExit(f"{ENTRADA} não existe ainda; gere a bandeja depois que o ponto de entrada for criado.")
VERSAO_TXT = str(Path(os.environ.get("FAROL_BUILD", EMP / "build")) / "versao-bandeja.txt")

oculto = collect_submodules("farol") + ["win32timezone", "winreg", "psutil"]
a = Analysis([str(ENTRADA)], pathex=[str(RAIZ / "agente")], hiddenimports=oculto,
             excludes=["tkinter", "unittest", "pydoc_data", "test"])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name="farol-bandeja", console=False, upx=False,
          icon=str(EMP / "recursos" / "farol.ico"), version=VERSAO_TXT)
