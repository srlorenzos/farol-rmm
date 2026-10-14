// Agendador de tarefas periódicas. Módulos registram com ctx.agendador.registrar(nome, intervaloMs, fn).
// fn recebe (ctx, agora). Erros são registrados no log e não derrubam as outras tarefas.

export class Agendador {
  constructor(ctx) {
    this.ctx = ctx;
    this.tarefas = new Map();
    this.timers = [];
    this.ativo = false;
  }

  registrar(nome, intervaloMs, fn, { imediato = false } = {}) {
    if (this.tarefas.has(nome)) throw new Error(`Tarefa "${nome}" já registrada`);
    if (!(intervaloMs >= 1000)) throw new Error(`Tarefa "${nome}": intervalo mínimo de 1000 ms`);
    const t = { nome, intervaloMs, fn, imediato, rodando: false };
    this.tarefas.set(nome, t);
    if (this.ativo) this.#agendar(t);
  }

  async executar(nome, agora = Date.now()) {
    const t = this.tarefas.get(nome);
    if (!t) throw new Error(`Tarefa "${nome}" não existe`);
    return this.#rodar(t, agora);
  }

  /** Executa todas as tarefas uma vez (usado em testes com um "agora" simulado). */
  async executarTodas(agora = Date.now()) {
    for (const t of this.tarefas.values()) await this.#rodar(t, agora);
  }

  iniciar() {
    if (this.ativo) return;
    this.ativo = true;
    for (const t of this.tarefas.values()) this.#agendar(t);
  }

  parar() {
    this.ativo = false;
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  #agendar(t) {
    const timer = setInterval(() => this.#rodar(t), t.intervaloMs);
    timer.unref?.();
    this.timers.push(timer);
    if (t.imediato) setImmediate(() => this.#rodar(t));
  }

  async #rodar(t, agora = Date.now()) {
    if (t.rodando) return; // não sobrepõe execuções lentas
    t.rodando = true;
    try {
      await t.fn(this.ctx, agora);
    } catch (e) {
      this.ctx.log?.error?.({ err: e, tarefa: t.nome }, 'falha em tarefa periódica');
    } finally {
      t.rodando = false;
    }
  }
}
