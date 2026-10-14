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
      s.ultimaAtividadeEm = Date.now();
      clearTimeout(s.timer);
      this.#paraPainel(s, { e: 'aberta', ref: s.ref });
      const def = this.tipos.get(s.tipo);
      // `msg` pode trazer campos extras que o agente anexou na confirmação de abertura (ver
      // farol/tempo_real.py `info_abertura`) — `consentimento` é repassado se vier, senão fica null.
      if (def?.aoAbrir) { try { def.aoAbrir({ id: s.id, agenteId: s.agenteId, hostname: s.hostname, usuario: s.usuario, consentimento: msg.consentimento ?? null }); } catch (e) { this.ctx.log?.error?.(e); } }
    });
    canalAgentes.aoMensagem('relay.erro', (msg, agenteId) => {
      const s = this.sessoes.get(msg.sessao);
      if (s && s.agenteId === agenteId) this.fechar(s.id, `erro no agente: ${String(msg.erro ?? '').slice(0, 200)}`, 'agente');
    });
    canalAgentes.aoMensagem('relay.dados', (msg, agenteId) => {
      const s = this.sessoes.get(msg.sessao);
      if (!s || s.agenteId !== agenteId || typeof msg.d !== 'string') return;
      s.bytesAgente += msg.d.length;
      s.ultimaAtividadeEm = Date.now();
      this.#notificarDados(s, 'agente', msg.d);
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

  // `aoDados(direcao, sessaoInfo, dados)` é opcional: observador de dados da sessão (ex.: gravação opt-in de
  // terminal). Não altera o fluxo; exceções são isoladas para não derrubar o relay.
  // `maxPorAgente` é opcional: quando definido, recusa abrir uma sessão NOVA deste tipo enquanto já houver
  // esse número de sessões do mesmo tipo abertas/abrindo no MESMO agente — útil pra um tipo de sessão
  // exclusiva (1 por vez). Sem o limite, padrão de sempre (várias sessões, como o terminal já permite).
  // `aoAbrir(sessaoInfo)` é opcional: chamado quando o agente confirma que a sessão abriu de verdade.
  // `aoPrepararArgs(agenteId, argsDoPainel)` é opcional: deixa o módulo dono do tipo AJUSTAR (nunca confiar
  // cegamente) os args antes de mandar pro agente, decidindo coisas sensíveis server-side em vez de
  // confiar no que o painel mandou. Sem isto, os args do painel vão direto.
  // `timeoutAberturaMs` é opcional: troca o timeout padrão de 15s pra confirmar abertura, pra tipos que
  // precisam de mais tempo antes de confirmar que a sessão abriu de verdade.
  // `timeoutInatividadeMs` é opcional: fecha sozinha uma sessão ABERTA sem nenhum dado trafegado (nenhuma
  // direção) por esse tempo — rede de segurança pra sessão esquecida aberta (aba travada, JS que não rodou
  // o cleanup, etc.) além do fechamento automático já existente quando a conexão do painel cai de vez.
  registrarTipo(tipo, { permissao, elevado = false, descricao = tipo, aoDados = null, maxPorAgente = null, aoAbrir = null, aoPrepararArgs = null, timeoutAberturaMs = null, timeoutInatividadeMs = null } = {}) {
    if (!/^[a-z][a-z0-9-]*$/.test(tipo)) throw new Error(`Tipo de relay inválido "${tipo}"`);
    if (this.tipos.has(tipo)) throw new Error(`Tipo de relay "${tipo}" já registrado`);
    if (!permissao) throw new Error(`Tipo de relay "${tipo}" precisa declarar a permissão exigida`);
    this.tipos.set(tipo, { permissao, elevado, descricao, aoDados, maxPorAgente, aoAbrir, aoPrepararArgs, timeoutAberturaMs, timeoutInatividadeMs });
  }

  #notificarDados(s, direcao, dados) {
    if (!s.aoDados) return;
    try { s.aoDados(direcao, { id: s.id, agenteId: s.agenteId, hostname: s.hostname, tipo: s.tipo, usuario: s.usuario }, dados); } catch (e) { this.ctx.log?.error?.(e); }
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
    if (def.maxPorAgente != null) {
      const doMesmoTipo = [...this.sessoes.values()].filter((s) => s.agenteId === agente.id && s.tipo === msg.tipo).length;
      if (doMesmoTipo >= def.maxPorAgente) return erro(`Já existe uma sessão de ${def.descricao} aberta neste dispositivo`);
    }

    const id = randomUUID();
    const agora = Date.now();
    const s = { id, ref, agenteId: agente.id, hostname: agente.hostname, tipo: msg.tipo, conexao, usuario: sessao.usuario,
      abertaEm: agora, ultimaAtividadeEm: agora, bytesPainel: 0, bytesAgente: 0, estado: 'abrindo', timer: null, aoDados: def.aoDados };
    this.sessoes.set(id, s);
    this.ctx.db.prepare('INSERT INTO relay_sessoes (id, agente_id, tipo, usuario, ip, aberta_em) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, agente.id, msg.tipo, sessao.usuario, conexao.ip ?? null, agora);
    this.ctx.auditar({ usuario: sessao.usuario, acao: 'relay_aberto', alvo: agente.hostname, agente_id: agente.id,
      detalhes: { sessao: id, tipo: msg.tipo }, ip: conexao.ip });
    s.timer = setTimeout(() => { if (s.estado === 'abrindo') this.fechar(id, 'o agente não respondeu', 'servidor'); }, def.timeoutAberturaMs ?? TIMEOUT_ABERTURA);
    s.timer.unref?.();
    this.ctx.hubPainel.enviar(conexao, 'relay', { e: 'abrindo', ref, sessao: id });
    // aoPrepararArgs nunca confia nos args do painel pra decisões sensíveis (ex.: exigir consentimento) —
    // o módulo dono do tipo decide server-side e pode sobrescrever o que o painel mandou.
    const argsFinais = def.aoPrepararArgs ? def.aoPrepararArgs(agente.id, msg.args ?? {}) : (msg.args ?? {});
    this.ctx.canalAgentes.enviar(agente.id, { t: 'relay.abrir', sessao: id, tipo: msg.tipo, args: argsFinais });
    return id;
  }

  /** Fecha sozinha sessões ABERTAS sem nenhum dado trafegado há mais que o timeout do tipo (ver
   * `timeoutInatividadeMs` em registrarTipo — número fixo, ou `(ctx) => número` pra ler config ao vivo,
   * como o terminal faz com o "tempo limite de inatividade" configurável em Configurações). Chamada
   * periodicamente (ver app.js, "Tarefas do núcleo"). */
  varrerInativas(agora = Date.now()) {
    for (const s of [...this.sessoes.values()]) {
      if (s.estado !== 'aberta') continue;
      const def = this.tipos.get(s.tipo);
      if (!def?.timeoutInatividadeMs) continue;
      const limite = typeof def.timeoutInatividadeMs === 'function' ? def.timeoutInatividadeMs(this.ctx) : def.timeoutInatividadeMs;
      if (limite > 0 && agora - s.ultimaAtividadeEm > limite) this.fechar(s.id, 'sessão encerrada por inatividade', 'servidor');
    }
  }

  #dadosDoPainel(conexao, msg) {
    const s = this.sessoes.get(msg.sessao);
    if (!s || s.conexao !== conexao || s.estado !== 'aberta') return;
    if (typeof msg.d !== 'string' || msg.d.length > MAX_DADOS) return;
    s.bytesPainel += msg.d.length;
    s.ultimaAtividadeEm = Date.now();
    this.#notificarDados(s, 'painel', msg.d);
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
