"""Configuração do agente: caminho padrão, validação da URL do servidor e arquivo com permissão restrita."""
from __future__ import annotations

import ipaddress
import json
import logging
import os
import subprocess
import sys
import urllib.parse
from pathlib import Path

WINDOWS = sys.platform == "win32"
log = logging.getLogger("farol")


class ErroConfig(Exception):
    """Configuração inválida (ex.: URL insegura)."""


def caminho_config_padrao() -> Path:
    if env := os.environ.get("FAROL_CONFIG"):
        return Path(env)
    if WINDOWS:
        return Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "Farol" / "config.json"
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        return Path("/etc/farol/config.json")
    return Path.home() / ".config" / "farol" / "config.json"


def _host_local(host: str) -> bool:
    if host in ("localhost",):
        return True
    try:
        return ipaddress.ip_address(host.strip("[]")).is_loopback
    except ValueError:
        return False


def validar_url_servidor(url: str, inseguro: bool = False) -> str:
    """Aceita https:// sempre; http:// só para localhost ou com --inseguro explícito."""
    partes = urllib.parse.urlsplit(url.strip())
    if partes.scheme not in ("http", "https") or not partes.hostname:
        raise ErroConfig(f"URL do servidor inválida: {url!r}")
    if partes.scheme == "http" and not _host_local(partes.hostname) and not inseguro:
        raise ErroConfig(
            "Recusando http:// para um host que não é localhost. Use HTTPS "
            "(recomendado) ou passe --inseguro se souber o que está fazendo."
        )
    return f"{partes.scheme}://{partes.netloc}{partes.path.rstrip('/')}"


def _restringir_permissoes(caminho: Path) -> None:
    if not WINDOWS:
        os.chmod(caminho, 0o600)
        return
    # Windows: remove herança e libera só SYSTEM, Administradores e o usuário atual.
    usuario = os.environ.get("USERNAME", "")
    dominio = os.environ.get("USERDOMAIN", "")
    concessoes = ["*S-1-5-18:F", "*S-1-5-32-544:F"]
    if usuario and not usuario.endswith("$"):
        concessoes.append(f"{dominio}\\{usuario}:F" if dominio else f"{usuario}:F")
    try:
        subprocess.run(["icacls", str(caminho), "/inheritance:r", "/grant:r", *concessoes],
                       check=True, capture_output=True, timeout=30)
    except (OSError, subprocess.SubprocessError) as e:
        log.warning("não foi possível restringir permissões de %s: %s", caminho, e)


def salvar_config(caminho: Path, dados: dict) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    temporario = caminho.with_suffix(".tmp")
    fd = os.open(temporario, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=2)
    os.replace(temporario, caminho)
    _restringir_permissoes(caminho)


def carregar_config(caminho: Path) -> dict:
    try:
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ErroConfig(f"Config não encontrada em {caminho}. Rode 'instalar' primeiro.") from None
    for chave in ("servidor", "agente_id", "segredo"):
        if not dados.get(chave):
            raise ErroConfig(f"Config incompleta: falta '{chave}'")
    dados["servidor"] = validar_url_servidor(dados["servidor"], dados.get("inseguro", False))
    return dados
