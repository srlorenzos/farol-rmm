"""API local do agente (só 127.0.0.1) para a bandeja (agente/farol_bandeja.py, processo separado que roda
na sessão do usuário) consultar o sistema e falar com o servidor de chamados sem nunca ter o segredo do
agente. Descoberta automaticamente (farol.registro), como qualquer módulo em farol/modulos/.

Como entra em funcionamento sem precisar de um gancho novo no núcleo do agente: um @coletor é chamado pelo
loop principal (cli.cmd_rodar → coletar_extras) a cada check-in com o `ctx` já montado — na primeira vez,
ele guarda essa referência e sobe o servidor HTTP em background (uma vez só). O timestamp da última
chamada do coletor serve de heurística para "último contato": se os check-ins pararem de sair (rede caiu,
backoff crescente), o timestamp para de avançar e a bandeja mostra "desconectado".

Segurança: token aleatório por início do processo, gravado em arquivo com permissão restrita (leitura só
para o usuário/Usuários locais, escrita só para SYSTEM/Administradores); todo pedido exige esse token
(cabeçalho Authorization: Bearer, ou ?token= só na rota de anexo, que é carregada por <img src>), confere
o cabeçalho Host (evita DNS rebinding) e recusa Origin estranha (evita que uma página web qualquer no
navegador do usuário fale com a porta). Corpo limitado a poucos MB (print de tela comprimido + JSON).

Rotas (todas sob /api/, só respondem em 127.0.0.1):
  GET  /api/saude                           {ok, versao}
  GET  /api/sistema                         inventário básico + estado da conexão com o Farol
  POST /api/sistema/reiniciar               reinicia o processo do agente (reexecução; best effort)
  GET  /api/notificacoes                    avisos de resposta de chamado pendentes (consome a fila)
  GET  /api/bandeja/config                  marca/contato/recursos configurados no painel
  GET  /api/chamados?usuario=               chamados do usuário do Windows atual
  POST /api/chamados                        abre um chamado (usuário/dados do sistema entram automático)
  GET  /api/chamados/<id>                   detalhe + conversa + anexos
  POST /api/chamados/<id>/mensagens         usuário responde
  POST /api/chamados/<id>/fechar            usuário encerra
  GET  /api/chamados/<id>/anexos/<anexoId>  print, binário (vem em base64 do servidor; ver anexo_base64)
"""
from __future__ import annotations

import base64
import json
import logging
import os
import secrets
import subprocess
import sys
import threading
import time
import urllib.parse
from collections import deque
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from farol import VERSAO
from farol.coleta import _hardware, coletar_metricas, info_basica  # reaproveitado de propósito (mesmo pacote)
from farol.config import WINDOWS
from farol.http import ErroHttp, ErroRede
from farol.registro import coletor, comando

log = logging.getLogger("farol")

PORTA_PADRAO = int(os.environ.get("FAROL_BANDEJA_PORTA", "8421"))
MAX_CORPO = 6 * 1024 * 1024  # print comprimido + JSON

# A janela da bandeja (pywebview ou o fallback no navegador — ver farol.bandeja.janela) é sempre servida
# por um pequeno servidor estático local, nunca por html= embutido: assim o fetch() que ela faz para esta
# API local sempre tem uma Origin concreta e verificável (em vez de "null", que um iframe sandbox também
# produziria), e um só código serve os dois caminhos. Essas portas (a primeira livre é a usada) entram na
# lista de origens aceitas, além da porta desta própria API.
PORTAS_UI_BANDEJA = [int(p) for p in os.environ.get("FAROL_BANDEJA_UI_PORTAS", "8422,8423,8424,8425").split(",")]

_estado = {
    "ctx": None,
    "token": None,
    "servidor": None,
    "ultimo_contato": None,
    "notificacoes": deque(maxlen=50),
    "trava": threading.Lock(),
}


class _ErroApi(Exception):
    def __init__(self, status: int, mensagem: str):
        super().__init__(mensagem)
        self.status = status
        self.mensagem = mensagem


# ------------------------------------------------------------ token
def caminho_token() -> Path:
    if env := os.environ.get("FAROL_BANDEJA_TOKEN_ARQUIVO"):
        return Path(env)
    if WINDOWS:
        return Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "Farol" / "bandeja.token"
    return Path("/etc/farol/bandeja.token")


def _restringir_e_liberar(caminho: Path) -> None:
    """SYSTEM/Administradores podem escrever; Usuários locais só leem (a bandeja não é admin)."""
    if WINDOWS:
        try:
            subprocess.run(["icacls", str(caminho), "/inheritance:r", "/grant:r",
                             "*S-1-5-18:F", "*S-1-5-32-544:F", "*S-1-5-32-545:R"],
                            check=True, capture_output=True, timeout=30)
        except (OSError, subprocess.SubprocessError) as e:
            log.warning("não foi possível ajustar a ACL do token da bandeja: %s", e)
    else:
        try:
            os.chmod(caminho, 0o640)  # leitura pelo grupo do arquivo; ajuste manual do grupo se precisar
        except OSError as e:
            log.warning("não foi possível ajustar a permissão do token da bandeja: %s", e)


def _gravar_token(token: str) -> None:
    caminho = caminho_token()
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o640)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(token)
    os.replace(tmp, caminho)
    _restringir_e_liberar(caminho)


def _usuario_atual() -> str:
    for var in ("USERNAME", "USER"):
        if v := os.environ.get(var):
            return v
    try:
        import getpass
        return getpass.getuser()
    except Exception:
        return "desconhecido"


# ------------------------------------------------------------ dados do sistema
def _info_sistema(ctx) -> dict:
    cfg = getattr(ctx, "cfg", None) or {}
    servidor = cfg.get("servidor")
    try:
        m = coletar_metricas(servidor)
    except Exception:
        m = {}
    try:
        hw = _hardware()
    except Exception:
        hw = {}
    basica = info_basica()
    agora = time.time()
    ultimo = _estado.get("ultimo_contato")
    intervalo = int(cfg.get("intervalo") or 15)
    conectado = bool(ultimo and (agora - ultimo) < max(60, intervalo * 3))
    return {
        "hostname": basica["hostname"], "usuario": m.get("usuario") or _usuario_atual(),
        "so": basica["so"], "so_versao": basica["so_versao"], "arquitetura": basica["arquitetura"],
        "ip": m.get("ip"), "cpu_pct": m.get("cpu"), "ram_usada": m.get("ram_usada"), "ram_total": m.get("ram_total"),
        "discos": m.get("discos") or [], "uptime": m.get("uptime"),
        "fabricante": hw.get("fabricante"), "modelo": hw.get("modelo"), "serial": hw.get("serial"),
        "cpu_modelo": hw.get("cpu_modelo"), "nucleos_fisicos": hw.get("nucleos_fisicos"), "nucleos_logicos": hw.get("nucleos_logicos"),
        "versao_agente": VERSAO,
        "farol": {
            "conectado": conectado, "ultimo_contato": ultimo,
            "agente_id": cfg.get("agente_id"), "servidor": servidor,
        },
    }


def _chamar_servidor(ctx, caminho: str, corpo: dict | None = None) -> dict:
    if not ctx or not getattr(ctx, "cliente", None):
        raise _ErroApi(503, "O agente ainda não terminou de iniciar; tente de novo em alguns segundos.")
    try:
        return ctx.cliente.post(caminho, corpo or {})
    except ErroHttp as e:
        msg = e.corpo
        try:
            msg = json.loads(e.corpo).get("erro", e.corpo)
        except (ValueError, AttributeError):
            pass
        raise _ErroApi(e.status, str(msg)) from None
    except ErroRede as e:
        raise _ErroApi(502, f"Sem conexão com o servidor do Farol: {e}") from None


def _reiniciar_processo() -> None:
    time.sleep(0.3)  # dá tempo da resposta HTTP sair antes do processo morrer
    try:
        argv = sys.argv[1:] if getattr(sys, "frozen", False) else sys.argv
        subprocess.Popen([sys.executable, *argv], close_fds=True)
    except Exception:
        log.exception("falha ao reiniciar o agente (reexecução)")
        return
    os._exit(0)


# ------------------------------------------------------------ servidor HTTP
class _Handler(BaseHTTPRequestHandler):
    server_version = f"FarolBandejaAPI/{VERSAO}"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # silencioso no nível INFO
        log.debug("api-local %s - " + fmt, self.address_string(), *args)

    def _host_ok(self) -> bool:
        host = (self.headers.get("Host") or "").strip()
        porta = self.server.server_port
        return host in (f"127.0.0.1:{porta}", f"localhost:{porta}")

    def _origens_permitidas(self) -> set[str]:
        porta = self.server.server_port
        permitidas = {f"http://127.0.0.1:{porta}", f"http://localhost:{porta}"}
        for p in PORTAS_UI_BANDEJA:
            permitidas.add(f"http://127.0.0.1:{p}")
            permitidas.add(f"http://localhost:{p}")
        return permitidas

    def _origem_ok(self) -> bool:
        origem = self.headers.get("Origin")
        if not origem:
            return True  # curl/python (sem navegador) não mandam Origin
        return origem in self._origens_permitidas()

    def _cors_origem(self) -> str | None:
        """Origin do pedido, só se estiver na lista permitida — pra ecoar em Access-Control-Allow-Origin.
        Sem isso, o navegador bloqueia a resposta antes do JS da bandeja conseguir lê-la (tela "Failed to
        fetch"): a janela da bandeja é servida numa porta (ui) e fala com a API local noutra, então TODA
        chamada é cross-origin aos olhos do navegador — mesmo as duas sendo 127.0.0.1."""
        origem = self.headers.get("Origin")
        return origem if origem and origem in self._origens_permitidas() else None

    def _token_ok(self, partes) -> bool:
        esperado = _estado.get("token") or ""
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer ") and esperado and secrets.compare_digest(auth[7:].strip(), esperado):
            return True
        if "/anexos/" in partes.path:  # carregado por <img src>, que não manda cabeçalhos
            tok = (urllib.parse.parse_qs(partes.query).get("token") or [""])[0]
            return bool(esperado) and secrets.compare_digest(tok, esperado)
        return False

    def _recusar(self, status: int, erro: str) -> None:
        self._responder(status, {"erro": erro})

    def _responder(self, status: int, dados) -> None:
        corpo = json.dumps(dados, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        origem = self._cors_origem()
        if origem:
            self.send_header("Access-Control-Allow-Origin", origem)
            self.send_header("Vary", "Origin")
        self.end_headers()
        try:
            self.wfile.write(corpo)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _corpo_json(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_CORPO:
            # Drena o corpo mesmo recusando: se sobrar gente não lida no socket, o SO manda RST ao
            # fechar a conexão e a resposta de erro nem chega íntegra no outro lado.
            restante = n
            while restante > 0:
                pedaco = self.rfile.read(min(65536, restante))
                if not pedaco:
                    break
                restante -= len(pedaco)
            raise ValueError("corpo da requisição grande demais")
        dados = self.rfile.read(n) if n else b""
        if not dados:
            return {}
        try:
            return json.loads(dados.decode("utf-8"))
        except ValueError as e:
            raise ValueError(f"JSON inválido: {e}") from None

    def _preparar(self, partes):
        if not self._host_ok():
            self._recusar(HTTPStatus.FORBIDDEN, "Host não permitido")
            return False
        if not self._origem_ok():
            self._recusar(HTTPStatus.FORBIDDEN, "Origem não permitida")
            return False
        if not self._token_ok(partes):
            self._recusar(HTTPStatus.UNAUTHORIZED, "Token inválido ou ausente")
            return False
        return True

    def do_OPTIONS(self):
        """Preflight de CORS: o navegador manda isso sozinho antes de um GET/POST com cabeçalho
        Authorization (não é "simples" pro CORS). Sem responder aqui, a chamada de verdade nunca sai."""
        self.send_response(HTTPStatus.NO_CONTENT)
        if self._host_ok():
            origem = self._cors_origem()
            if origem:
                self.send_header("Access-Control-Allow-Origin", origem)
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Access-Control-Max-Age", "600")
                self.send_header("Vary", "Origin")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        partes = urllib.parse.urlsplit(self.path)
        if not self._preparar(partes):
            return
        try:
            self._rotear_get(partes)
        except _ErroApi as e:
            self._recusar(e.status, e.mensagem)
        except Exception as e:
            log.exception("api-local: falha em GET %s", self.path)
            self._recusar(500, str(e))

    def do_POST(self):
        partes = urllib.parse.urlsplit(self.path)
        if not self._preparar(partes):
            return
        try:
            self._rotear_post(partes)
        except ValueError as e:
            self._recusar(413, str(e))
        except _ErroApi as e:
            self._recusar(e.status, e.mensagem)
        except Exception as e:
            log.exception("api-local: falha em POST %s", self.path)
            self._recusar(500, str(e))

    def _rotear_get(self, partes) -> None:
        seg = [s for s in partes.path.split("/") if s]
        q = urllib.parse.parse_qs(partes.query)
        ctx = _estado.get("ctx")
        if seg == ["api", "saude"]:
            return self._responder(200, {"ok": True, "versao": VERSAO})
        if seg == ["api", "sistema"]:
            return self._responder(200, _info_sistema(ctx))
        if seg == ["api", "notificacoes"]:
            with _estado["trava"]:
                itens = list(_estado["notificacoes"])
                _estado["notificacoes"].clear()
            return self._responder(200, {"itens": itens})
        if seg == ["api", "bandeja", "config"]:
            return self._responder(200, _chamar_servidor(ctx, "/api/agente/bandeja/config"))
        if seg == ["api", "chamados"]:
            usuario = (q.get("usuario") or [_usuario_atual()])[0]
            return self._responder(200, _chamar_servidor(ctx, "/api/agente/chamados/listar", {"usuario": usuario}))
        if len(seg) == 3 and seg[:2] == ["api", "chamados"] and seg[2].isdigit():
            return self._responder(200, _chamar_servidor(ctx, "/api/agente/chamados/obter", {"id": int(seg[2])}))
        if len(seg) == 5 and seg[:2] == ["api", "chamados"] and seg[3] == "anexos" and seg[2].isdigit() and seg[4].isdigit():
            return self._anexo(ctx, int(seg[2]), int(seg[4]))
        self._recusar(404, "rota desconhecida")

    def _rotear_post(self, partes) -> None:
        seg = [s for s in partes.path.split("/") if s]
        ctx = _estado.get("ctx")
        if seg == ["api", "sistema", "reiniciar"]:
            threading.Thread(target=_reiniciar_processo, daemon=True).start()
            return self._responder(200, {"ok": True})
        if seg == ["api", "chamados"]:
            corpo = self._corpo_json()
            corpo.setdefault("usuario_windows", _usuario_atual())
            corpo.setdefault("dados_sistema", _info_sistema(ctx))
            return self._responder(201, _chamar_servidor(ctx, "/api/agente/chamados/criar", corpo))
        if len(seg) == 4 and seg[:2] == ["api", "chamados"] and seg[2].isdigit() and seg[3] == "mensagens":
            corpo = self._corpo_json()
            corpo["id"] = int(seg[2])
            corpo.setdefault("usuario_windows", _usuario_atual())
            return self._responder(200, _chamar_servidor(ctx, "/api/agente/chamados/responder", corpo))
        if len(seg) == 4 and seg[:2] == ["api", "chamados"] and seg[2].isdigit() and seg[3] == "fechar":
            return self._responder(200, _chamar_servidor(ctx, "/api/agente/chamados/fechar", {"id": int(seg[2])}))
        self._recusar(404, "rota desconhecida")

    def _anexo(self, ctx, chamado_id: int, anexo_id: int) -> None:
        r = _chamar_servidor(ctx, "/api/agente/chamados/anexo", {"id": chamado_id, "anexo_id": anexo_id})
        dados = base64.b64decode(r["conteudo_base64"])
        self.send_response(200)
        self.send_header("Content-Type", r.get("tipo") or "application/octet-stream")
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-store")
        origem = self._cors_origem()
        if origem:
            self.send_header("Access-Control-Allow-Origin", origem)
            self.send_header("Vary", "Origin")
        self.end_headers()
        try:
            self.wfile.write(dados)
        except (BrokenPipeError, ConnectionResetError):
            pass


def _iniciar_servidor() -> None:
    with _estado["trava"]:
        if _estado["servidor"] is not None:
            return
        token = secrets.token_hex(32)
        _estado["token"] = token
        try:
            _gravar_token(token)
        except OSError as e:
            log.warning("não foi possível gravar o token da bandeja (%s); a bandeja não vai autenticar", e)
        try:
            servidor = ThreadingHTTPServer(("127.0.0.1", PORTA_PADRAO), _Handler)
        except OSError as e:
            log.warning("API local da bandeja não conseguiu abrir a porta %d: %s", PORTA_PADRAO, e)
            return
        servidor.daemon_threads = True
        threading.Thread(target=servidor.serve_forever, name="farol-api-local", daemon=True).start()
        _estado["servidor"] = servidor
        log.info("API local da bandeja em http://127.0.0.1:%d", servidor.server_port)


# ------------------------------------------------------------ integração com o agente
@comando("chamados.notificar")
def _notificar(args: dict, _ctx) -> dict:
    """O servidor avisa por aqui (comando tipado comum, fila se o canal estiver caído) quando o técnico
    responde um chamado; a bandeja descobre lendo GET /api/notificacoes."""
    with _estado["trava"]:
        _estado["notificacoes"].append({
            "chamado_id": args.get("chamado_id"), "assunto": args.get("assunto"), "recebido_em": time.time(),
        })
    return {"ok": True}


@coletor("bandeja", intervalo=15)
def _coletor(ctx) -> None:
    """Roda a cada check-in (não precisa de nenhum gancho novo no núcleo do agente): guarda o `ctx` para a
    API local usar, marca o heartbeat (heurística de "conectado") e sobe o servidor na primeira vez."""
    _estado["ctx"] = ctx
    _estado["ultimo_contato"] = time.time()
    _iniciar_servidor()
    return None
