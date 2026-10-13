"""Linha de comando do agente: instalar, rodar, versao, modulos."""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import logging
import random
import signal
import sys
import threading
import time
from pathlib import Path

import psutil

from . import VERSAO
from .coleta import coletar_inventario, coletar_metricas, info_basica
from .config import ErroConfig, caminho_config_padrao, carregar_config, salvar_config, validar_url_servidor
from .execucao import executar_job
from .http import Cliente, ErroHttp, ErroRede
from .registro import REGISTRO, descobrir, executar_comando
from .tempo_real import CanalTempoReal

INTERVALO_INVENTARIO = 3600
log = logging.getLogger("farol")


class ContextoAgente:
    """Passado aos handlers dos módulos (comandos, sessões, coletores)."""

    def __init__(self, cfg: dict, cliente: Cliente):
        self.cfg = cfg
        self.cliente = cliente
        self.log = log
        self.versao = VERSAO

    def responder_comando_http(self, id_comando, resposta: dict) -> None:
        try:
            self.cliente.post("/api/agente/comando-resultado", {"id": id_comando, **resposta})
        except (ErroHttp, ErroRede) as e:
            log.warning("não foi possível entregar o resultado do comando %s: %s", id_comando, e)


def montar_checkin(servidor: str | None, com_inventario: bool, intervalo_cpu: float | None = None,
                   ctx: ContextoAgente | None = None, agora: float | None = None) -> dict:
    payload = {"metricas": coletar_metricas(servidor, intervalo_cpu), "info": info_basica(REGISTRO.capacidades())}
    if com_inventario:
        payload["inventario"] = coletar_inventario()
    extras = coletar_extras(ctx, agora or time.time())
    if extras:
        payload["extras"] = extras
    return payload


def coletar_extras(ctx, agora: float) -> dict:
    """Roda os coletores registrados pelos módulos cujo intervalo venceu."""
    extras = {}
    for c in REGISTRO.coletores.values():
        if agora - c.ultimo < c.intervalo:
            continue
        c.ultimo = agora
        try:
            extras[c.nome] = c.fn(ctx)
        except Exception as e:  # coletor com erro não derruba o check-in
            log.warning("coletor %s falhou: %s", c.nome, e)
    return extras


def cmd_instalar(args) -> int:
    """No exe do Windows (ou com --completo) instala de verdade; fora disso só registra no servidor."""
    if args.completo or (sys.platform == "win32" and getattr(sys, "frozen", False) and not args.so_registrar):
        from . import instalacao
        return instalacao.instalar_completo(args, registrar_agente)
    if not args.servidor or not args.token:
        log.error("informe --servidor e --token")
        return 2
    return registrar_agente(args)


def cmd_desinstalar(args) -> int:
    from . import instalacao
    return instalacao.desinstalar_completo(args)


def cmd_status(args) -> int:
    from . import instalacao
    return instalacao.status_completo(args)


def cmd_servico(_args) -> int:
    from . import servico_windows
    return servico_windows.executar()


def registrar_agente(args) -> int:
    if not args.servidor or not args.token:
        log.error("informe --servidor e --token")
        return 2
    servidor = validar_url_servidor(args.servidor, args.inseguro)
    caminho = Path(args.config) if args.config else caminho_config_padrao()
    cliente = Cliente(servidor)
    descobrir()
    try:
        resp = cliente.post("/api/agente/registrar", {"token": args.token, "info": info_basica(REGISTRO.capacidades())})
    except ErroHttp as e:
        try:
            msg = json.loads(e.corpo).get("erro", e.corpo)
        except ValueError:
            msg = e.corpo
        log.error("registro recusado (HTTP %s): %s", e.status, msg)
        return 2
    except ErroRede as e:
        log.error("não foi possível falar com %s: %s", servidor, e)
        return 3
    salvar_config(caminho, {
        "servidor": servidor,
        "agente_id": resp["id"],
        "segredo": resp["segredo"],
        "intervalo": int(resp.get("intervalo") or 15),
        "inseguro": bool(args.inseguro),
    })
    print(f"Agente registrado: {resp['id']}\nConfiguração salva em {caminho}")
    if not (args.completo or getattr(sys, "frozen", False)):
        exe = Path(sys.argv[0]).name or "farol-agente.pyz"
        print(f"Agora rode: python {exe} rodar" + (f" --config \"{caminho}\"" if args.config else ""))
    return 0


def _enviar_resultado(cliente: Cliente, resultado: dict) -> None:
    for tentativa in range(5):
        try:
            cliente.post("/api/agente/resultado", resultado)
            return
        except ErroHttp as e:
            log.error("servidor recusou resultado do job %s: %s", resultado["job_id"], e)
            return
        except ErroRede as e:
            log.warning("falha ao enviar resultado do job %s (%s); tentando de novo", resultado["job_id"], e)
            time.sleep(min(60, 2 ** tentativa))


def _processar_job(cliente: Cliente, job: dict) -> None:
    log.info("executando job %s (%s, timeout %ss)", job["id"], job.get("shell"), job.get("timeout"))
    r = executar_job(job)
    log.info("job %s terminou: código %s%s", job["id"], r["codigo_saida"], " (timeout)" if r["timeout"] else "")
    _enviar_resultado(cliente, r)


def _processar_comando(ctx: ContextoAgente, c: dict) -> None:
    log.info("comando %s (%s) via check-in", c.get("tipo"), c.get("id"))
    ctx.responder_comando_http(c.get("id"), executar_comando(ctx, str(c.get("tipo")), c.get("args") or {}))


def cmd_rodar(args) -> int:
    caminho = Path(args.config) if args.config else caminho_config_padrao()
    cfg = carregar_config(caminho)
    cliente = Cliente(cfg["servidor"], cfg["agente_id"], cfg["segredo"])
    ctx = ContextoAgente(cfg, cliente)
    descobrir()
    intervalo = int(cfg.get("intervalo") or 15)
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=8, thread_name_prefix="tarefa")
    parar = getattr(args, "parar", None) or threading.Event()  # o serviço do Windows passa o seu
    acordar = threading.Event()
    if getattr(args, "parar", None):
        threading.Thread(target=lambda: (parar.wait(), acordar.set()), daemon=True, name="parada").start()
    for sinal in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sinal, lambda *_: (parar.set(), acordar.set()))
        except (ValueError, OSError):
            pass

    canal = None if args.uma_vez or args.sem_tempo_real else CanalTempoReal(ctx, executor, acordar, parar)
    psutil.cpu_percent(interval=None)  # primeira leitura serve só de referência
    ultimo_inventario = 0.0
    pedir_inventario = False
    falhas = 0
    log.info("agente %s v%s falando com %s (intervalo %ss, %d módulo(s))",
             cfg["agente_id"], VERSAO, cfg["servidor"], intervalo, len(REGISTRO.modulos))

    while not parar.is_set():
        espera = intervalo
        try:
            com_inv = pedir_inventario or time.time() - ultimo_inventario >= INTERVALO_INVENTARIO
            payload = montar_checkin(cfg["servidor"], com_inv, intervalo_cpu=1.0 if args.uma_vez else None, ctx=ctx)
            resp = cliente.post("/api/agente/checkin", payload)
            if com_inv:
                ultimo_inventario = time.time()
            pedir_inventario = bool(resp.get("pedirInventario"))
            intervalo = int(resp.get("intervalo") or intervalo)
            espera = intervalo
            falhas = 0
            jobs = resp.get("jobs") or []
            futuros = [executor.submit(_processar_job, cliente, j) for j in jobs]
            futuros += [executor.submit(_processar_comando, ctx, c) for c in resp.get("comandos") or []]
            if canal and resp.get("tempoReal"):
                canal.iniciar(resp["tempoReal"])
            if args.uma_vez:
                concurrent.futures.wait(futuros)
            log.debug("check-in ok, %d job(s), %d comando(s)", len(jobs), len(resp.get("comandos") or []))
        except ErroHttp as e:
            if e.status == 401:
                log.error("credencial recusada: o agente foi revogado ou a config está errada")
                if args.uma_vez:
                    return 4
                espera = 300
            else:
                falhas += 1
                log.warning("servidor respondeu %s", e)
                espera = min(300, intervalo * 2 ** falhas)
        except ErroRede as e:
            falhas += 1
            espera = min(300, intervalo * 2 ** min(falhas, 6)) * random.uniform(0.8, 1.2)
            log.warning("sem conexão com o servidor (%s); nova tentativa em %.0fs", e, espera)
            if args.uma_vez:
                return 3
        if args.uma_vez:
            break
        acordar.wait(espera)  # o canal em tempo real acorda antes quando há job novo
        acordar.clear()
    if canal:
        canal.encerrar()
    executor.shutdown(wait=True)
    return 0


def cmd_modulos(_args) -> int:
    descobrir()
    print(f"Farol agente {VERSAO}")
    for m in REGISTRO.modulos:
        print(f"  módulo  {m}")
    for t in sorted(REGISTRO.comandos):
        print(f"  comando {t}")
    for t in sorted(REGISTRO.sessoes):
        print(f"  sessão  {t}")
    for c in REGISTRO.coletores.values():
        print(f"  coletor {c.nome} (a cada {c.intervalo:.0f}s)")
    for m, e in REGISTRO.erros.items():
        print(f"  ERRO    {m}: {e}")
    return 0


def _ajustar_saida() -> None:
    """Evita UnicodeEncodeError quando a saída é redirecionada num console com codepage legado."""
    for fluxo in (sys.stdout, sys.stderr):
        try:
            if fluxo and not fluxo.isatty():
                fluxo.reconfigure(encoding="utf-8", errors="replace")
            elif fluxo:
                fluxo.reconfigure(errors="replace")
        except (AttributeError, ValueError, OSError):
            pass


def _opcoes_windows(p) -> None:
    p.add_argument("--nome-servico", help="nome do serviço (padrão FarolAgente; mude só para testes)")
    p.add_argument("--pasta", help="pasta de instalação (padrão C:\\Program Files\\Farol)")
    p.add_argument("--silencioso", action="store_true", help="sem perguntas nem pausa no fim")
    p.add_argument("--elevado", action="store_true", help=argparse.SUPPRESS)


def _sem_argumentos(p) -> int:
    """Duplo clique no exe: mostra a ajuda e espera, em vez de a janela sumir."""
    p.print_help()
    print("\nPara instalar neste computador: farol-agente.exe instalar --servidor URL --token TOKEN")
    try:
        input("\nPressione Enter para fechar...")
    except (EOFError, OSError):
        pass
    return 0


def main(argv=None) -> int:
    _ajustar_saida()
    p = argparse.ArgumentParser(prog="farol-agente", description="Agente do Farol RMM")
    p.add_argument("-v", "--verbose", action="store_true", help="log detalhado")
    sub = p.add_subparsers(dest="comando", required=True)

    pi = sub.add_parser("instalar", help="registra este computador no servidor (no exe do Windows: instala tudo)")
    pi.add_argument("--servidor", help="URL do servidor, ex.: https://farol.exemplo.com")
    pi.add_argument("--token", help="token de instalação gerado no painel (sem ele, só atualiza uma instalação existente)")
    pi.add_argument("--config", help="caminho do arquivo de configuração")
    pi.add_argument("--inseguro", action="store_true", help="permite http:// para hosts que não são localhost")
    _opcoes_windows(pi)
    pi.add_argument("--completo", action="store_true", help="força a instalação completa (Windows) fora do exe")
    pi.add_argument("--so-registrar", action="store_true", help="só registra no servidor, sem instalar serviço")
    pi.add_argument("--modo", choices=["servico", "tarefa"], help="força serviço do Windows ou tarefa agendada")

    pd = sub.add_parser("desinstalar", help="remove serviço, autostart, arquivos e (com confirmação) a configuração")
    pd.add_argument("--config", help="caminho do arquivo de configuração")
    _opcoes_windows(pd)
    pd.add_argument("--manter-config", action="store_true", help="não apaga %%ProgramData%%\\Farol")
    pd.add_argument("--remover-config", action="store_true", help="apaga %%ProgramData%%\\Farol sem perguntar")
    pd.add_argument("--sem-arquivos", action="store_true", help=argparse.SUPPRESS)

    ps = sub.add_parser("status", help="mostra o estado da instalação (serviço, bandeja, configuração)")
    ps.add_argument("--config", help="caminho do arquivo de configuração")
    _opcoes_windows(ps)

    sub.add_parser("servico", help=argparse.SUPPRESS)  # chamado pelo gerenciador de serviços do Windows

    pr = sub.add_parser("rodar", help="loop principal de check-in")
    pr.add_argument("--config", help="caminho do arquivo de configuração")
    pr.add_argument("--uma-vez", action="store_true", help="faz um check-in (e executa jobs) e sai")
    pr.add_argument("--sem-tempo-real", action="store_true", help="não abre o canal WebSocket (só check-in HTTP)")

    sub.add_parser("versao", help="mostra a versão")
    sub.add_parser("modulos", help="lista módulos, comandos e sessões disponíveis")

    if argv is None and len(sys.argv) == 1 and getattr(sys, "frozen", False):
        return _sem_argumentos(p)
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    try:
        if args.comando == "instalar":
            return cmd_instalar(args)
        if args.comando == "rodar":
            return cmd_rodar(args)
        if args.comando == "desinstalar":
            return cmd_desinstalar(args)
        if args.comando == "status":
            return cmd_status(args)
        if args.comando == "servico":
            return cmd_servico(args)
        if args.comando == "modulos":
            return cmd_modulos(args)
        print(VERSAO)
        return 0
    except ErroConfig as e:
        log.error("%s", e)
        return 2
