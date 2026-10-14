// Canais WebSocket do Farol.
//
//  Painel  ⇄  /api/ws          (cookie de sessão)   — eventos {tipo, dados, ts}; mensagens do painel {t, ...}
//  Agente  ⇄  /api/agente/ws   (Bearer id:segredo)  — mensagens {t, ...} nos dois sentidos
//
// Os dois canais são independentes; o Relay (relay.js) liga um ao outro em sessões ponto a ponto.
import { sessaoPorId } from './sessao.js';

const ABERTO = 1;
export const MAX_MSG_PAINEL = 256 * 1024;

function enviarJson(socket, obj) {
  if (socket.readyState !== ABERTO) return false;
  socket.send(JSON.stringify(obj));
  return true;
}

/** Conexões do painel. Cada conexão guarda a sessão (id, usuário, papel) que a abriu. */
export class HubPainel {
  constructor(ctx) {
    this.ctx = ctx;
    this.conexoes = new Set();
    this.manipuladores = new Map();
  }

  adicionar(socket, sessao, ip) {
    const conexao = { socket, sessaoId: sessao.id, usuario: sessao.usuario, papel: sessao.papel, ip, desde: Date.now() };
    this.conexoes.add(conexao);
    socket.on('close', () => {
      this.conexoes.delete(conexao);
      for (const fn of this.manipuladores.get('_fechou') ?? []) fn(conexao);
    });
    socket.on('message', (bruto) => this.#receber(conexao, bruto));
    enviarJson(socket, { tipo: 'ola', dados: { usuario: sessao.usuario }, ts: Date.now() });
    return conexao;
  }

  /** Registra um manipulador para mensagens {t} vindas do painel. '_fechou' é chamado ao desconectar. */
  aoMensagem(t, fn) {
    if (!this.manipuladores.has(t)) this.manipuladores.set(t, []);
    this.manipuladores.get(t).push(fn);
  }

  #receber(conexao, bruto) {
    if (bruto.length > MAX_MSG_PAINEL) return this.enviar(conexao, 'erro', { erro: 'Mensagem grande demais' });
    let msg;
    try { msg = JSON.parse(bruto.toString('utf8')); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const lista = this.manipuladores.get(msg.t);
    if (!lista) return;
    // A sessão pode ter expirado/sido encerrada desde a conexão: revalida a cada mensagem.
    const sessao = sessaoPorId(this.ctx, conexao.sessaoId);
    if (!sessao) { conexao.socket.close(4401, 'sessao expirada'); return; }
    conexao.papel = sessao.papel;
    for (const fn of lista) {
      Promise.resolve().then(() => fn(msg, conexao, sessao)).catch((e) => {
        this.ctx.log?.error?.(e);
        this.enviar(conexao, 'erro', { erro: 'Falha ao processar mensagem', ref: msg.ref });
      });
    }
  }

  enviar(conexao, tipo, dados) {
    return enviarJson(conexao.socket, { tipo, dados, ts: Date.now() });
  }

  /** Envia um evento a todas as conexões (opcionalmente só a quem tem a permissão). */
  emitir(tipo, dados, { permissao } = {}) {
    const msg = JSON.stringify({ tipo, dados, ts: Date.now() });
    for (const c of this.conexoes) {
      if (permissao && !this.ctx.permissoes.papelTem(c.papel, permissao)) continue;
      if (c.socket.readyState === ABERTO) c.socket.send(msg);
    }
  }

  /** Fecha as conexões de uma sessão (logout) ou de um usuário (desativado, papel alterado). */
  fecharSessao(sessaoId) {
    for (const c of this.conexoes) if (c.sessaoId === sessaoId) c.socket.close(4401, 'sessao encerrada');
  }

  fecharUsuario(usuario) {
    for (const c of this.conexoes) if (c.usuario === usuario) c.socket.close(4401, 'sessao encerrada');
  }

  /** Fecha conexões cujas sessões expiraram (tarefa periódica). */
  revalidar() {
    for (const c of this.conexoes) {
      const s = sessaoPorId(this.ctx, c.sessaoId);
      if (!s) c.socket.close(4401, 'sessao expirada');
      else c.papel = s.papel;
    }
  }
}

/** Conexões persistentes dos agentes (uma por agente; a mais nova substitui a anterior). */
export class CanalAgentes {
  constructor(ctx) {
    this.ctx = ctx;
    this.conexoes = new Map();
    this.manipuladores = new Map();
  }

  adicionar(agente, socket) {
    const anterior = this.conexoes.get(agente.id);
    if (anterior) anterior.socket.close(4000, 'substituida');
    const conexao = { socket, agenteId: agente.id, hostname: agente.hostname, desde: Date.now(), vivo: true };
    this.conexoes.set(agente.id, conexao);
    socket.on('pong', () => { conexao.vivo = true; });
    socket.on('message', (bruto) => this.#receber(conexao, bruto));
    socket.on('close', () => {
      if (this.conexoes.get(agente.id) !== conexao) return;
      this.conexoes.delete(agente.id);
      for (const fn of this.manipuladores.get('_fechou') ?? []) fn(agente.id);
      this.ctx.emitir('agente.canal', { id: agente.id, conectado: false });
    });
    enviarJson(socket, { t: 'ola', intervalo: this.ctx.config.intervaloCheckin, ts: Date.now() });
    this.ctx.emitir('agente.canal', { id: agente.id, conectado: true });
    for (const fn of this.manipuladores.get('_abriu') ?? []) fn(agente.id);
    return conexao;
  }

  aoMensagem(t, fn) {
    if (!this.manipuladores.has(t)) this.manipuladores.set(t, []);
    this.manipuladores.get(t).push(fn);
  }

  #receber(conexao, bruto) {
    let msg;
    try { msg = JSON.parse(bruto.toString('utf8')); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    for (const fn of this.manipuladores.get(msg.t) ?? []) {
      try { fn(msg, conexao.agenteId); } catch (e) { this.ctx.log?.error?.(e); }
    }
  }

  conectado(agenteId) { return this.conexoes.has(agenteId); }
  conectados() { return [...this.conexoes.keys()]; }

  enviar(agenteId, msg) {
    const c = this.conexoes.get(agenteId);
    return c ? enviarJson(c.socket, msg) : false;
  }

  /** Pede um check-in imediato (ex.: há job novo). Devolve false se o agente não tem canal aberto. */
  acordar(agenteId) { return this.enviar(agenteId, { t: 'checkin' }); }

  /** Desconecta (ex.: agente revogado). */
  desconectar(agenteId, motivo = 'revogado') {
    this.conexoes.get(agenteId)?.socket.close(4403, motivo);
  }

  /** Keepalive: ping WebSocket; quem não respondeu ao anterior é derrubado. */
  verificarVivos() {
    for (const c of this.conexoes.values()) {
      if (!c.vivo) { c.socket.terminate(); continue; }
      c.vivo = false;
      try { c.socket.ping(); } catch { /* socket já fechando */ }
    }
  }
}
