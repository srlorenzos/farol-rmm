// Biblioteca de scripts prontos: lê servidor/biblioteca/** na inicialização, indexa por categoria/SO/tipo/tags,
// expõe busca e "importar" para os scripts do usuário. Arquivos inválidos não derrubam o servidor: viram
// uma lista de erros visível para o administrador (GET /api/biblioteca/erros).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, basename, relative, sep } from 'node:path';
import { parseScript, SHELL_POR_EXTENSAO, SOS, TIPOS } from './parser.js';

/** Lê a pasta e devolve { itens: Map(id → item), erros: [{arquivo, erro}] }. */
export function carregarBiblioteca(pasta) {
  const itens = new Map();
  const erros = [];
  if (!existsSync(pasta)) return { itens, erros };
  const categorias = readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name).sort();
  for (const cat of categorias) {
    for (const nome of readdirSync(join(pasta, cat)).sort()) {
      const ext = extname(nome).slice(1).toLowerCase();
      if (!SHELL_POR_EXTENSAO[ext]) continue;
      const caminho = join(pasta, cat, nome);
      const arquivo = relative(pasta, caminho).split(sep).join('/');
      try {
        const item = parseScript(readFileSync(caminho, 'utf8'), { extensao: ext, idArquivo: basename(nome, `.${ext}`), categoriaSlug: cat, arquivo });
        if (itens.has(item.id)) throw new Error(`id "${item.id}" repetido (também em ${itens.get(item.id).arquivo})`);
        itens.set(item.id, item);
      } catch (e) {
        erros.push({ arquivo, erro: e.message });
      }
    }
  }
  return { itens, erros };
}

const resumoItem = ({ conteudo, ...resto }) => ({ ...resto, linhas: conteudo.split('\n').length });

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default {
  nome: 'biblioteca',
  descricao: 'Biblioteca de scripts prontos (servidor/biblioteca)',
  depende: ['scripts'],
  permissoes: {
    'biblioteca.ver': { descricao: 'Navegar na biblioteca de scripts', papeis: ['tecnico', 'leitura'] },
  },

  servico(ctx) {
    let estado = { itens: new Map(), erros: [], carregadaEm: 0 };
    let indiceBusca = new Map();
    const servico = {
      recarregar() {
        const r = carregarBiblioteca(ctx.config.pastaBiblioteca);
        estado = { ...r, carregadaEm: Date.now() };
        indiceBusca = new Map([...r.itens.values()].map((i) => [i.id, normalizar([i.id, i.nome, i.descricao, i.categoria, ...i.tags].join(' '))]));
        if (r.erros.length) ctx.log?.warn?.({ erros: r.erros.length }, 'biblioteca: arquivos com erro foram ignorados');
        return { total: r.itens.size, erros: r.erros.length };
      },
      obter: (id) => estado.itens.get(id) ?? null,
      erros: () => estado.erros,
      /** Busca com filtros. Todos os termos de `q` precisam aparecer (sem acentos, sem maiúsculas). */
      buscar({ q, categoria, so, tipo, tag, shell } = {}) {
        const termos = normalizar(q).split(/\s+/).filter(Boolean);
        return [...estado.itens.values()].filter((i) => (!categoria || i.categoria_slug === categoria)
          && (!so || i.so.includes(so)) && (!tipo || i.tipo === tipo) && (!tag || i.tags.includes(tag))
          && (!shell || i.shell === shell)
          && termos.every((t) => indiceBusca.get(i.id).includes(t)))
          .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
      },
      categorias() {
        const mapa = new Map();
        for (const i of estado.itens.values()) {
          const c = mapa.get(i.categoria_slug) ?? { slug: i.categoria_slug, nome: i.categoria, total: 0 };
          c.total++;
          mapa.set(i.categoria_slug, c);
        }
        return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      },
      get total() { return estado.itens.size; },
      get carregadaEm() { return estado.carregadaEm; },
    };
    return servico;
  },

  aoIniciar(ctx) {
    ctx.servicos.biblioteca.recarregar();
  },

  rotas(app, ctx) {
    const ver = ctx.exigir('biblioteca.ver');
    const bib = () => ctx.servicos.biblioteca;

    app.get('/api/biblioteca', {
      preHandler: ver,
      schema: { querystring: { type: 'object', additionalProperties: false, properties: {
        q: { type: 'string', maxLength: 120 }, categoria: { type: 'string', maxLength: 80 },
        so: { type: 'string', enum: SOS }, tipo: { type: 'string', enum: TIPOS }, tag: { type: 'string', maxLength: 40 },
        shell: { type: 'string', enum: ['powershell', 'cmd', 'bash', 'python'] },
      } } },
    }, async (req) => ({
      total: bib().total,
      categorias: bib().categorias(),
      itens: bib().buscar(req.query).map(resumoItem),
    }));

    app.get('/api/biblioteca/erros', { preHandler: ctx.exigir('scripts.editar') }, async () => ({ erros: bib().erros(), carregadaEm: bib().carregadaEm }));

    app.post('/api/biblioteca/recarregar', { preHandler: ctx.exigir('scripts.editar') }, async (req) => {
      const r = bib().recarregar();
      ctx.auditarReq(req, 'biblioteca_recarregada', { detalhes: r });
      return r;
    });

    app.get('/api/biblioteca/:id', {
      preHandler: ver,
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,79}$' } } } },
    }, async (req, reply) => {
      const item = bib().obter(req.params.id);
      if (!item) return reply.code(404).send({ erro: 'Script não encontrado na biblioteca' });
      const importado = ctx.db.prepare('SELECT id FROM scripts WHERE origem = ?').get(`biblioteca:${item.id}`);
      return { ...item, importado_id: importado?.id ?? null };
    });

    app.post('/api/biblioteca/:id/importar', {
      preHandler: ctx.exigir('scripts.editar'),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,79}$' } } } },
    }, async (req, reply) => {
      const item = bib().obter(req.params.id);
      if (!item) return reply.code(404).send({ erro: 'Script não encontrado na biblioteca' });
      const script = ctx.servicos.scripts.criar({
        nome: item.nome, descricao: item.descricao, shell: item.shell, conteudo: item.conteudo, timeout: item.tempo_limite,
        categoria: item.categoria, so: item.so, tipo: item.tipo, tags: item.tags, variaveis: item.variaveis,
        requer_admin: item.requer_admin, origem: `biblioteca:${item.id}`,
      });
      ctx.auditarReq(req, 'script_importado', { alvo: item.nome, detalhes: { biblioteca: item.id, script: script.id } });
      return script;
    });
  },
};
