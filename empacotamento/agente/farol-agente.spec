# PyInstaller: agente do Farol. FAROL_MODO=onedir (padrão; serviço Windows + Setup) ou onefile (farol-agente.exe avulso).
import os
from pathlib import Path
import sys
from PyInstaller.utils.hooks import collect_submodules

RAIZ = Path(SPECPATH).resolve().parents[1]
EMP = RAIZ / "empacotamento"
sys.path.insert(0, str(RAIZ / "agente"))  # para o collect_submodules achar o pacote farol
MODO = os.environ.get("FAROL_MODO", "onedir")
VERSAO_TXT = str(Path(os.environ.get("FAROL_BUILD", EMP / "build")) / "versao-agente.txt")

oculto = collect_submodules("farol") + ["win32timezone", "servicemanager", "win32service", "win32serviceutil",
                                        "win32event", "winreg", "psutil"]
a = Analysis([str(RAIZ / "agente" / "farol_agente.py")], pathex=[str(RAIZ / "agente")], hiddenimports=oculto,
             excludes=["tkinter", "unittest", "pydoc_data", "test"], noarchive=False)
pyz = PYZ(a.pure)
comum = dict(name="farol-agente", console=True, upx=False, icon=str(EMP / "recursos" / "farol.ico"),
             version=VERSAO_TXT, uac_admin=False)
if MODO == "onefile":
    exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], **comum)
else:
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True, **comum)
    coll = COLLECT(exe, a.binaries, a.datas, upx=False, name="farol-agente")
