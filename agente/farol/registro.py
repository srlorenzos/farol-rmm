"""Registro de extensões do agente. Cada arquivo em farol/modulos/*.py é importado automaticamente e
usa os decoradores abaixo para se registrar:

    from farol.registro import comando, sessao, coletor, Sessao

    @comando("processos.listar")
    def listar(args: dict, ctx) -> dict | list: ...          # resposta vira o resultado do comando

    @sessao("terminal")
    class Terminal(Sessao):                                 # sessão de relay painel ⇄ agente
        def iniciar(self, args): ...
        def receber(self, dados: str): self.enviar(dados)
        def fechar(self): ...

    @coletor("patches", intervalo=3600)
    def coletar(ctx) -> dict: ...                           # vai em extras["patches"] no check-in

Um módulo com erro de importação é ignorado (com log) e não derruba o agente.
"""
from __future__ import annotations

import importlib
import logging
import pkgutil
import re
import threading
from dataclasses import dataclass, field
from typing import Callable

log = logging.getLogger("farol")
_TIPO = re.compile(r"^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)*$")


class ErroComando(Exception):
    """Erro esperado de um comando (a mensagem vai para o painel)."""


@dataclass
class Coletor:
    nome: str
    fn: Callable
    intervalo: float
    ultimo: float = 0.0


@dataclass
class Registro:
    comandos: dict[str, Callable] = field(default_factory=dict)
    sessoes: dict[str, type] = field(default_factory=dict)
    coletores: dict[str, Coletor] = field(default_factory=dict)
    modulos: list[str] = field(default_factory=list)
    erros: dict[str, str] = field(default_factory=dict)

    def capacidades(self) -> list[str]:
        return sorted(self.comandos) + sorted(f"sessao:{t}" for t in self.sessoes)


REGISTRO = Registro()


def comando(tipo: str):
    if not _TIPO.match(tipo):
        raise ValueError(f"tipo de comando inválido: {tipo}")

    def decorar(fn):
        if tipo in REGISTRO.comandos:
            raise ValueError(f"comando {tipo} registrado duas vezes")
        REGISTRO.comandos[tipo] = fn
        return fn
    return decorar


def sessao(tipo: str):
    if not re.match(r"^[a-z][a-z0-9-]*$", tipo):
        raise ValueError(f"tipo de sessão inválido: {tipo}")

    def decorar(cls):
        if not issubclass(cls, Sessao):
            raise TypeError("@sessao exige uma subclasse de Sessao")
        REGISTRO.sessoes[tipo] = cls
        return cls
    return decorar


def coletor(nome: str, intervalo: float = 3600):
    def decorar(fn):
        REGISTRO.coletores[nome] = Coletor(nome, fn, intervalo)
        return fn
    return decorar


class Sessao:
    """Base de uma sessão de relay. `enviar(texto)` manda dados ao painel; `encerrar(motivo)` fecha do lado do agente."""

    def __init__(self, ctx, id_sessao: str, enviar: Callable[[str], None], encerrar: Callable[[str], None]):
        self.ctx = ctx
        self.id = id_sessao
        self.enviar = enviar
        self.encerrar = encerrar
        self.trava = threading.Lock()

    def iniciar(self, args: dict) -> None:  # pragma: no cover - padrão vazio
        pass

    def receber(self, dados: str) -> None:  # pragma: no cover
        pass

    def fechar(self) -> None:  # pragma: no cover
        pass


def descobrir(pacote: str = "farol.modulos") -> Registro:
    """Importa todos os módulos do pacote (ordem alfabética). Idempotente."""
    pkg = importlib.import_module(pacote)
    for info in sorted(pkgutil.iter_modules(pkg.__path__), key=lambda m: m.name):
        nome = f"{pacote}.{info.name}"
        if info.name.startswith("_") or nome in REGISTRO.modulos:
            continue
        try:
            importlib.import_module(nome)
            REGISTRO.modulos.append(nome)
        except Exception as e:  # um módulo quebrado não derruba o agente
            REGISTRO.erros[nome] = repr(e)
            log.error("módulo %s ignorado: %s", nome, e)
    return REGISTRO


def executar_comando(ctx, tipo: str, args: dict) -> dict:
    """Roda o handler e devolve o payload de resposta {ok, dados|erro}."""
    fn = REGISTRO.comandos.get(tipo)
    if not fn:
        return {"ok": False, "erro": f"comando desconhecido: {tipo}"}
    try:
        return {"ok": True, "dados": fn(args or {}, ctx)}
    except ErroComando as e:
        return {"ok": False, "erro": str(e)}
    except Exception as e:
        log.exception("comando %s falhou", tipo)
        return {"ok": False, "erro": f"{type(e).__name__}: {e}"}
