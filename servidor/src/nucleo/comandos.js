// Comandos tipados servidor → agente: { tipo: 'processos.listar', args: {...} }.
// Entrega: pelo canal WebSocket do agente, na hora, se ele estiver conectado; senão ficam na fila e
// seguem na resposta do próximo check-in (campo "comandos"). O agente responde pelo WS ({t:'res'})
// ou por POST /api/agente/comando-resultado. Todo comando fica registrado na tabela `comandos`.
import { truncar } from './util.js';

export const MAX_RESULTADO = 2 * 1024 * 1024;
const TIPO_VALIDO = /^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)*$/;

export class ErroComando extends Error {
  constructor(msg, statusCode = 504) { super(msg); this.statusCode = statusCode; }
}

export class Comandos {
  constructor(ctx) {
    this.ctx = ctx;
    this.espera = new Map(); // id → { resolver, rejeitar, timer }
  }

  /**
   * Envia um comando a um agente.
   * @returns {{ id: number, entregue: boolean, resultado: Promise<any> }}
   *   `resultado` resolve com os dados devolvidos pelo agente ou rejeita com ErroComando.
   * Opções: usuario, timeoutMs (espera pelo resultado, padrão 30 s), validadeMs (quanto tempo pode ficar
   * na fila esperando o agente, padrão 10 min), fila (false = exige canal em tempo real).
   */
  enviar(agenteId, tipo, args = {}, { usuario = null, timeoutMs = 30_000, validadeMs = 600_000, fila = true } = {}) {
    if (!TIPO_VALIDO.test(tipo)) throw new ErroComando(`Tipo de comando inválido: ${tipo}`, 400);
    const { db, canalAgentes } = this.ctx;
    const agente = db.prepare('SELECT id, revogado FROM agentes WHERE id = ?').get(agenteId);
    if (!agente || agente.revogado) throw new ErroComando('Agente não encontrado', 404);
    const online = canalAgentes.conectado(agenteId);
    if (!online && !fila) throw new ErroComando('O agente não está conectado em tempo real', 409);

    const agora = Date.now();
    const r = db.prepare(`INSERT INTO comandos (agente_id, tipo, args_json, status, criado_por, criado_em, expira_em)
      VALUES (?, ?, ?, 'pendente', ?, ?, ?)`).run(agenteId, tipo, JSON.stringify(args ?? {}), usuario, agora, agora + Math.max(validadeMs, timeoutMs));
    const id = Number(r.lastInsertRowid);

    let resolver, rejeitar;
    const resultado = new Promise((res, rej) => { resolver = res; rejeitar = rej; });
    resultado.catch(() => {}); // evita "unhandled rejection" se quem chamou não aguardar
    const timer = setTimeout(() => {
      this.espera.delete(id);
      rejeitar(new ErroComando('O agente não respondeu a tempo'));
    }, timeoutMs);
    timer.unref?.();
    this.espera.set(id, { resolver, rejeitar, timer });

    const entregue = online && this.#entregarWs(id, agenteId, tipo, args);
    this.ctx.emitir('comando', { id, agente_id: agenteId, tipo, status: entregue ? 'enviado' : 'pendente' });
    return { id, entregue, resultado };
  }

  #entregarWs(id, agenteId, tipo, args) {
    const ok = this.ctx.canalAgentes.enviar(agenteId, { t: 'cmd', id, tipo, args: args ?? {} });
    if (ok) this.ctx.db.prepare("UPDATE comandos SET status = 'enviado', enviado_em = ? WHERE id = ? AND status = 'pendente'").run(Date.now(), id);
    return ok;
  }

  /** Comandos pendentes para o check-in HTTP (marca como enviados). */
  pendentesParaCheckin(agenteId, limite = 20) {
    const { db } = this.ctx;
    const agora = Date.now();
    const lista = db.prepare(`SELECT id, tipo, args_json FROM comandos
      WHERE agente_id = ? AND status = 'pendente' AND expira_em > ? ORDER BY id LIMIT ?`).all(agenteId, agora, limite);
    const marcar = db.prepare("UPDATE comandos SET status = 'enviado', enviado_em = ? WHERE id = ?");
    for (const c of lista) marcar.run(agora, c.id);
    return lista.map((c) => ({ id: c.id, tipo: c.tipo, args: JSON.parse(c.args_json) }));
  }

  /** Reenvia pelo WS o que ficou na fila enquanto o agente estava desconectado. */
  entregarFila(agenteId) {
    const pend = this.ctx.db.prepare(`SELECT id, tipo, args_json FROM comandos
      WHERE agente_id = ? AND status = 'pendente' AND expira_em > ? ORDER BY id LIMIT 50`).all(agenteId, Date.now());
    for (const c of pend) this.#entregarWs(c.id, agenteId, c.tipo, JSON.parse(c.args_json));
  }

  /** Resultado vindo do agente (WS ou HTTP). Devolve false se o comando não é dele ou já terminou. */
  concluir(agenteId, { id, ok, dados, erro }) {
    const { db } = this.ctx;
    const c = db.prepare('SELECT id, tipo, status FROM comandos WHERE id = ? AND agente_id = ?').get(id, agenteId);
    if (!c || !['pendente', 'enviado'].includes(c.status)) return false;
    let json = null;
    if (ok) {
      json = JSON.stringify(dados ?? null);
      if (Buffer.byteLength(json) > MAX_RESULTADO) { ok = false; erro = 'Resultado grande demais'; json = null; }
    }
    const status = ok ? 'sucesso' : 'erro';
    db.prepare('UPDATE comandos SET status = ?, concluido_em = ?, resultado_json = ?, erro = ? WHERE id = ?')
      .run(status, Date.now(), json, ok ? null : truncar(String(erro ?? 'erro desconhecido'), 2000), id);
    const espera = this.espera.get(id);
    if (espera) {
      clearTimeout(espera.timer);
      this.espera.delete(id);
      if (ok) espera.resolver(dados ?? null);
      else espera.rejeitar(new ErroComando(String(erro ?? 'O agente devolveu um erro'), 502));
    }
    this.ctx.emitir('comando', { id, agente_id: agenteId, tipo: c.tipo, status });
    return true;
  }

  /** Expira comandos vencidos (tarefa periódica). */
  expirar(agora = Date.now()) {
    const r = this.ctx.db.prepare(`UPDATE comandos SET status = 'expirado', concluido_em = ?
      WHERE status IN ('pendente', 'enviado') AND expira_em < ?`).run(agora, agora);
    return Number(r.changes);
  }

  cancelarDoAgente(agenteId) {
    this.ctx.db.prepare("UPDATE comandos SET status = 'cancelado' WHERE agente_id = ? AND status IN ('pendente', 'enviado')").run(agenteId);
  }
}
