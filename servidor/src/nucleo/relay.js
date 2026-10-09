// Relay: sessões ponto a ponto painel ⇄ agente, passando pelo servidor (nada é exposto nas máquinas).
//
// Painel → servidor (pelo /api/ws):
//   { t:'relay.abrir', ref, agente_id, tipo, args }     abre uma sessão do tipo registrado
//   { t:'relay.dados', sessao, d }                      dados (string; base64 se for binário)
//   { t:'relay.fechar', sessao }
// Servidor → painel: evento tipo 'relay' com dados { e:'aberta'|'dados'|'fechada'|'erro', sessao, ref, d, motivo }
// Servidor ⇄ agente (pelo /api/agente/ws): { t:'relay.abrir', sessao, tipo, args } · { t:'relay.aberta', sessao } ·
//   { t:'relay.erro', sessao, erro } · { t:'relay.dados', sessao, d } · { t:'relay.fechar', sessao, motivo }
//
// Cada tipo é registrado por um módulo com a permissão exigida (e se exige modo elevado):
//   ctx.relay.registrarTipo('terminal', { permissao: 'terminal.usar', elevado: true, descricao: 'Terminal interativo' })
// Abertura e fechamento ficam na tabela relay_sessoes e na auditoria (relay_aberto / relay_fechado).
import { randomUUID } from 'node:crypto';

const MAX_DADOS = 192 * 1024;
const MAX_SESSOES_POR_CONEXAO = 8;
const TIMEOUT_ABERTURA = 15_000;

export class Relay {
  constructor(ctx) {
    this.ctx = ctx;
    this.tipos = new Map();
    this.sessoes = new Map();
    const { hubPainel, canalAgentes } = ctx;

    hubPainel.aoMensagem('relay.abrir', (msg, conexao, sessao) => this.abrir(conexao, sessao, msg));
    hubPainel.aoMensagem('relay.dados', (msg, conexao) => this.#dadosDoPainel(conexao, msg));
    hubPainel.aoMensagem('relay.fechar', (msg, conexao) => {
      const s = this.sessoes.get(msg.sessao);
      if (s && s.conexao === conexao) this.fechar(s.id, 'fechada pelo painel', 'painel');
    });
    hubPainel.aoMensagem('_fechou', (conexao) => {
      for (const s of this.sessoes.values()) if (s.conexao === conexao) this.fechar(s.id, 'painel desconectou', 'painel');
    });

    canalAgentes.aoMensagem('relay.aberta', (msg, agenteId) => {
      const s = this.sessoes.get(msg.sessao);
      if (!s || s.agenteId !== agenteId || s.estado !== 'abrindo') return;
      s.estado = 'aberta';
      clearTimeout(s.timer);
      this.#paraPainel(s, { e: 'aberta', ref: s.ref });
    });
    canalAgentes.aoMensagem('relay.erro', (msg, agenteId) => {
      const s = this.sessoes.get(msg.sessao);
      if (s && s.agenteId === agenteId) this.fechar(s.id, `erro no agente: ${String(msg.erro ?? '').slice(0, 200)}`, 'agente');
    });
    canalAgentes.aoMensagem('relay.dados', (msg, agenteId) => {
      const s = this.sessoes.get(msg.sessao);
      if (!s || s.agenteId !== agenteId || typeof msg.d !== 'string') return;
      s.bytesAgente += msg.d.length;
      this.#paraPainel(s, { e: 'dados', d: msg.d });
    });
    canalAgentes.aoMensagem('relay.fechar', (msg, agenteId) => {
      const s = this.sessoes.get(msg.sessao);
      if (s && s.agenteId === agenteId) this.fechar(s.id, String(msg.motivo ?? 'fechada pelo agente').slice(0, 200), 'agente');
    });
    canalAgentes.aoMensagem('_fechou', (agenteId) => {
      for (const s of this.sessoes.values()) if (s.agenteId === agenteId) this.fechar(s.id, 'agente desconectou', 'agente');
    });
  }

  registrarTipo(tipo, { permissao, elevado = false, descricao = tipo } = {}) {
    if (!/^[a-z][a-z0-9-]*$/.test(tipo)) throw new Error(`Tipo de relay inválido "${tipo}"`);
    if (this.tipos.has(tipo)) throw new Error(`Tipo de relay "${tipo}" já registrado`);
    if (!permissao) throw new Error(`Tipo de relay "${tipo}" precisa declarar a permissão exigida`);
    this.tipos.set(tipo, { permissao, elevado, descricao });
  }

  abrir(conexao, sessao, msg) {
    const ref = typeof msg.ref === 'string' ? msg.ref.slice(0, 64) : null;
    const erro = (texto, extra = {}) => this.ctx.hubPainel.enviar(conexao, 'relay', { e: 'erro', ref, erro: texto, ...extra });
    const def = this.tipos.get(msg.tipo);
    if (!def) return erro('Tipo de sessão desconhecido');
    if (!this.ctx.permissoes.papelTem(sessao.papel, def.permissao)) return erro('Sem permissão para esta sessão');
    if (def.elevado) {
      if (!sessao.totp_ativo) return erro('Ative o 2FA para abrir esta sessão', { precisa2fa: true });
      if (sessao.elevado_ate <= Date.now()) return erro('Confirme o código 2FA para continuar', { precisaElevar: true });
    }
    const agente = typeof msg.agente_id === 'string'
      ? this.ctx.db.prepare('SELECT id, hostname, revogado FROM agentes WHERE id = ?').get(msg.agente_id) : null;
    if (!agente || agente.revogado) return erro('Dispositivo não encontrado');
    if (!this.ctx.canalAgentes.conectado(agente.id)) return erro('O dispositivo não está conectado em tempo real');
    const abertas = [...this.sessoes.values()].filter((s) => s.conexao === conexao).length;
    if (abertas >= MAX_SESSOES_POR_CONEXAO) return erro('Sessões demais abertas nesta aba');

    const id = randomUUID();
    const agora = Date.now();
    const s = { id, ref, agenteId: agente.id, hostname: agente.hostname, tipo: msg.tipo, conexao, usuario: sessao.usuario,
      abertaEm: agora, bytesPainel: 0, bytesAgente: 0, estado: 'abrindo', timer: null };
    this.sessoes.set(id, s);
    this.ctx.db.prepare('INSERT INTO relay_sessoes (id, agente_id, tipo, usuario, ip, aberta_em) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, agente.id, msg.tipo, sessao.usuario, conexao.ip ?? null, agora);
    this.ctx.auditar({ usuario: sessao.usuario, acao: 'relay_aberto', alvo: agente.hostname, agente_id: agente.id,
      detalhes: { sessao: id, tipo: msg.tipo }, ip: conexao.ip });
    s.timer = setTimeout(() => { if (s.estado === 'abrindo') this.fechar(id, 'o agente não respondeu', 'servidor'); }, TIMEOUT_ABERTURA);
    s.timer.unref?.();
    this.ctx.hubPainel.enviar(conexao, 'relay', { e: 'abrindo', ref, sessao: id });
    this.ctx.canalAgentes.enviar(agente.id, { t: 'relay.abrir', sessao: id, tipo: msg.tipo, args: msg.args ?? {} });
    return id;
  }

  #dadosDoPainel(conexao, msg) {
    const s = this.sessoes.get(msg.sessao);
    if (!s || s.conexao !== conexao || s.estado !== 'aberta') return;
    if (typeof msg.d !== 'string' || msg.d.length > MAX_DADOS) return;
    s.bytesPainel += msg.d.length;
    this.ctx.canalAgentes.enviar(s.agenteId, { t: 'relay.dados', sessao: s.id, d: msg.d });
  }

  #paraPainel(s, dados) {
    this.ctx.hubPainel.enviar(s.conexao, 'relay', { sessao: s.id, ...dados });
  }

  fechar(id, motivo, origem) {
    const s = this.sessoes.get(id);
    if (!s) return;
    this.sessoes.delete(id);
    clearTimeout(s.timer);
    const agora = Date.now();
    if (origem !== 'agente') this.ctx.canalAgentes.enviar(s.agenteId, { t: 'relay.fechar', sessao: id, motivo });
    if (origem !== 'painel' || motivo !== 'painel desconectou') this.#paraPainel(s, { e: 'fechada', ref: s.ref, motivo });
    this.ctx.db.prepare('UPDATE relay_sessoes SET fechada_em = ?, bytes_painel = ?, bytes_agente = ?, motivo = ? WHERE id = ?')
      .run(agora, s.bytesPainel, s.bytesAgente, motivo, id);
    this.ctx.auditar({ usuario: s.usuario, acao: 'relay_fechado', alvo: s.hostname, agente_id: s.agenteId,
      detalhes: { sessao: id, tipo: s.tipo, motivo, duracao_ms: agora - s.abertaEm, bytes_painel: s.bytesPainel, bytes_agente: s.bytesAgente } });
  }

  ativas() {
    return [...this.sessoes.values()].map((s) => ({ id: s.id, agente_id: s.agenteId, tipo: s.tipo, usuario: s.usuario, aberta_em: s.abertaEm, estado: s.estado }));
  }
}
