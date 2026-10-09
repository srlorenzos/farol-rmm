# Arquitetura do Farol RMM v2

Manual de quem vai construir módulos novos. Leia inteiro antes de começar; ele é curto de propósito.

```
farol-rmm/
├── servidor/
│   ├── src/
│   │   ├── app.js            monta Fastify, aplica migrações, carrega módulos, WebSockets, painel estático
│   │   ├── nucleo/           infraestrutura compartilhada (NÃO edite sem combinar — ver "Regras para trabalho em paralelo")
│   │   └── modulos/<nome>/   um módulo por pasta, descoberto automaticamente
│   ├── biblioteca/           551 scripts prontos (formato no fim deste arquivo)
│   ├── scripts/              criar-admin.js, demo.js, validar-biblioteca.mjs
│   └── test/                 node --test (ajuda.js tem app em memória, cliente com cookie, agente falso)
├── agente/
│   ├── farol_agente.py       ponto de entrada (desenvolvimento)
│   └── farol/                pacote: cli, coleta, execucao, http, ws, tempo_real, registro
│       └── modulos/*.py      extensões do agente, descobertas automaticamente
└── painel/
    ├── css/                  design system em 5 camadas (ver painel/DESIGN.md)
    └── js/
        ├── app.js            boot: sessão → manifesto → módulos → shell → rotas → WebSocket
        ├── nucleo/           registro, shell, roteador, paleta, api, estado/tempo real (NÃO edite sem combinar)
        ├── ui/               componentes do design system (NÃO edite sem combinar)
        └── modulos/<nome>/   um módulo por pasta, descoberto pelo manifesto do servidor
```

## 1. Servidor

### 1.1 Núcleo × módulos

O **núcleo** (`src/nucleo/`) cria o `ctx`, as tabelas centrais (usuários, sessões, config, auditoria, clientes, sites,
agentes, métricas, tokens, comandos, sessões de relay) e a infraestrutura de tempo real. Tudo o que é *funcionalidade*
vive em **módulos** (`src/modulos/<nome>/index.js`): `auth`, `organizacao`, `agentes`, `alertas`, `scripts`,
`biblioteca`, `jobs`, `auditoria` e `ping` (o modelo).

O carregador lê as pastas de `src/modulos/` (ignorando as que começam com `_`), valida o objeto exportado e ordena
**topologicamente por `depende`, com desempate alfabético** — a ordem é sempre a mesma. Para cada módulo, na ordem:
registra permissões → aplica migrações → cria o serviço → registra ganchos → registra rotas → chama `aoIniciar`.

### 1.2 Contrato de um módulo

```js
// servidor/src/modulos/patches/index.js
export default {
  nome: 'patches',                       // = nome da pasta (obrigatório)
  descricao: 'Gestão de atualizações',
  depende: ['agentes', 'alertas'],       // módulos que precisam carregar antes
  permissoes: {                          // "area.acao" → papéis que recebem (admin recebe tudo sempre)
    'patches.ver': { descricao: 'Ver patches', papeis: ['tecnico', 'leitura'] },
    'patches.aprovar': { descricao: 'Aprovar e instalar patches', papeis: ['tecnico'] },
  },
  migracoes: [                           // versão = posição na lista; SÓ ACRESCENTE no fim
    `CREATE TABLE patches (...);`,
    (db, ctx) => { /* migração em JS, se precisar */ },
  ],
  servico(ctx) { return { /* API para outros módulos: ctx.servicos.patches */ }; },
  rotas(app, ctx) { /* app é uma instância Fastify encapsulada */ },
  aoCheckin(agenteAntes, payload, ctx, resumo) { /* a cada check-in */ },
  tarefasAgente(agente, ctx) { return { /* chaves extras na resposta do check-in */ }; },
  aoIniciar(ctx) { /* agendador, resolvedores de alvo, tipos de relay, enriquecedores */ },
};
```

Chaves desconhecidas fazem o servidor **recusar a inicialização** (pega erro de digitação cedo).

### 1.3 O `ctx`

| Membro | Para que serve |
|---|---|
| `db` | `node:sqlite` síncrono. **Sempre** consultas parametrizadas. `transacao(db, fn)` e `marcadores(n)` em `src/db.js`. |
| `config` | configuração (`src/config.js`): porta, URLs, retenções, pastas. |
| `log` | logger do Fastify (pino). |
| `auditar({usuario, acao, alvo, detalhes, ip, agente_id})` | grava na auditoria. Em rotas use **`ctx.auditarReq(req, 'acao', { alvo, detalhes, agente_id })`**. Ação = `snake_case` em pt-BR; o painel traduz em `painel/js/modulos/auditoria/index.js` (ROTULOS). |
| `emitir(tipo, dados, { permissao })` | evento em tempo real para os painéis conectados (opcionalmente só quem tem a permissão). |
| `exigir(perm?, { elevado })` | **preHandler padrão das rotas do painel**: `ctx.exigir('patches.ver')`, `ctx.exigir('patches.aprovar', { elevado: true })`. Também existem `exigirLogin`, `exigirPermissao(...)`, `exigirElevado()`. Na rota, `req.sessao` tem `usuario`, `papel`, `totp_ativo`, `elevado_ate`. |
| `autenticarAgente` + `limiteAgente()` | preHandler e rate limit (por agente, não por IP) para rotas `/api/agente/*`. Põe a linha do agente em `req.agente`. |
| `permissoes` | registro RBAC (`papelTem`, `doPapel`, `listar`). |
| `alvos.resolver(alvo)` / `alvos.registrar(tipo, fn)` | ver 1.5. |
| `comandos.enviar(agenteId, tipo, args, opts)` | ver 1.6. |
| `relay.registrarTipo(tipo, { permissao, elevado })` | ver 1.7. |
| `canalAgentes` | `conectado(id)`, `enviar(id, msg)`, `acordar(id)` (check-in imediato), `conectados()`. |
| `hubPainel` | conexões WebSocket do painel (use `emitir`; `aoMensagem(t, fn)` para mensagens do painel). |
| `agendador.registrar(nome, ms, fn(ctx, agora), { imediato })` | tarefas periódicas (nome `modulo.tarefa`). Nos testes: `await tarefasPeriodicas(ctx, agoraSimulado)`. |
| `servicos.<modulo>` | APIs entre módulos (ex.: `ctx.servicos.alertas.abrir(agente, { tipo, mensagem, severidade })`). Nunca importe o `index.js` de outro módulo. |

Serviços que já existem:

- `servicos.agentes.registrarEnriquecedor(nome, fn(linhas, ctx))` — acrescenta campos às linhas de `GET /api/agentes`
  (é assim que `alertas_abertos` chega à lista; o módulo de patches deve preencher `patch_status`).
- `servicos.alertas.abrir(agente, { tipo, mensagem, valor, severidade: 'info'|'alerta'|'critico' })`, `.resolver(agente, tipo)`.
  Use `tipo` com prefixo do módulo (`monitor:<id>`, `patch:pendentes`).
- `servicos.organizacao.arvore()`, `.siteExiste(id)`.
- `servicos.scripts.criar(dados)`, `.obter(id)`; `servicos.biblioteca.buscar(filtros)`, `.obter(id)`.

### 1.4 Migrações

- Tabela de controle `farol_migracoes(modulo, versao, aplicada_em)`. Cada migração roda numa transação; se falhar, nada dela fica.
- A versão é a **posição** na lista. Publicada, uma migração **nunca** é editada nem reordenada — corrija com uma nova.
- Banco mais novo que o código → o servidor se recusa a subir (evita corromper dados num downgrade).
- `ALTER TABLE ... ADD COLUMN` com `REFERENCES` exige `DEFAULT NULL` no SQLite; prefira colunas sem FK + validação no código.
- Bancos da v1 são atualizados automaticamente (a migração 1 de cada parte é o esquema v1 com `IF NOT EXISTS`).

### 1.5 RBAC, escopo e alvos

- **Papéis fixos**: `admin` (tudo), `tecnico`, `leitura`. O módulo declara quais papéis recebem cada permissão.
  Permissão usada e não declarada é **negada** (e gera aviso no log).
- **Modo elevado**: ações que executam algo nos dispositivos exigem `{ elevado: true }` (2FA ativo + código TOTP nos
  últimos 10 min). O painel trata isso sozinho com `comElevacao()` (ver DESIGN.md).
- **Escopo cliente/site**: o seletor do topo do painel manda `?cliente=` ou `?site=`. Nas rotas de listagem use
  `ESCOPO_QUERY` no schema e `filtroEscopo(req.query, 'a')` (`src/nucleo/util.js`), que devolve `{ sql, args }` para
  concatenar no `WHERE` de uma consulta com `agentes a`.
- **Alvo**: `{ tipo: 'agente'|'site'|'cliente'|'todos'|<registrado>, id }` (ou lista deles). `await ctx.alvos.resolver(alvo)`
  devolve os agentes ativos, sem duplicatas. Para grupos/filtros dinâmicos:
  `ctx.alvos.registrar('grupo', async (id, ctx) => [ids...], { descricao })` no `aoIniciar`. Valide o corpo com `ALVO_SCHEMA`.

### 1.6 Comandos tipados (servidor → agente)

```js
const { id, entregue, resultado } = ctx.comandos.enviar(agenteId, 'processos.listar', { limite: 50 },
  { usuario: req.sessao.usuario, timeoutMs: 15_000, validadeMs: 600_000, fila: true });
const dados = await resultado; // rejeita com ErroComando (statusCode 409/502/504) — pode lançar direto da rota
```

- Com o agente no canal em tempo real, chega na hora. Sem canal, fica na tabela `comandos` e vai na resposta do próximo
  check-in (`comandos: [...]`), a menos que `fila: false` (aí lança 409 na hora).
- O agente responde `{ ok, dados | erro }`. Resultado até 2 MB. Todo comando fica registrado (status, quem pediu).
- O tipo é `area.acao`; o handler correspondente fica num módulo Python do agente (seção 2).

### 1.7 Tempo real e relay

**Painel** ⇄ `/api/ws` (cookie): o servidor manda `{ tipo, dados, ts }`. Eventos atuais: `checkin`, `agente`,
`agente.canal`, `job`, `alerta`, `comando`, `organizacao`, `relay`. O socket é fechado no logout e quando a sessão expira.

**Agente** ⇄ `/api/agente/ws` (`Authorization: Bearer <id>:<segredo>`), mensagens `{ t, ... }`:

| Sentido | Mensagem |
|---|---|
| servidor → agente | `ola`, `checkin` (faça check-in agora), `cmd {id, tipo, args}`, `relay.abrir {sessao, tipo, args}`, `relay.dados {sessao, d}`, `relay.fechar {sessao, motivo}` |
| agente → servidor | `res {id, ok, dados, erro}`, `relay.aberta {sessao}`, `relay.erro {sessao, erro}`, `relay.dados {sessao, d}`, `relay.fechar {sessao, motivo}` |

Keepalive por ping/pong do WebSocket a cada 30 s. Uma conexão por agente (a nova derruba a velha).

**Relay** (sessão ponto a ponto painel ⇄ agente, multiplexada nos dois sockets acima — base do terminal e da tela remota):

1. O módulo registra o tipo no servidor: `ctx.relay.registrarTipo('terminal', { permissao: 'terminal.usar', elevado: true })`.
2. O agente implementa `@sessao('terminal')` (seção 2).
3. O painel abre com `abrirSessao(agenteId, 'terminal', args, { aoDados, aoFechar })` (`painel/js/nucleo/estado.js`)
   e recebe `{ id, enviar(texto), fechar() }`.

O servidor checa permissão/2FA na abertura (revalidando a sessão a cada mensagem), exige o agente conectado, limita 8
sessões por aba e 192 KB por mensagem, fecha tudo se um dos lados cair e grava `relay_sessoes` + auditoria
(`relay_aberto`/`relay_fechado` com duração e bytes). Dados binários: envie base64 em `d`.

Exemplo completo e testado: módulo `ping` (servidor), `agente/farol/modulos/basico.py` (agente) e
`painel/js/modulos/ping/index.js` (painel) — comando `ping` e sessão `eco`.

### 1.8 Check-in (HTTP)

`POST /api/agente/checkin` com `{ metricas, info?, inventario?, extras? }`. `extras` é `{ <coletor>: {...} }`, preenchido
pelos coletores do agente; leia em `aoCheckin(agenteAntes, payload, ctx, resumo)` → `payload.extras?.patches`.
`resumo` traz `{ agora, cpu, ramPct, discoMax, discoPonto }`. A resposta é
`{ intervalo, pedirInventario, comandos, tempoReal, ...tarefasAgente }` — o módulo `jobs` acrescenta `jobs`.
Chaves reservadas não podem ser sobrescritas.

### 1.9 Convenções de rota

- Painel: `/api/<area>...`, `preHandler: ctx.exigir(...)`, JSON Schema em `body`/`params`/`querystring`
  (`additionalProperties: false`), erros `reply.code(4xx).send({ erro: 'mensagem em pt-BR' })`.
- Mutação do painel exige o header `X-Farol: 1` (CSRF) — o cliente do painel já envia.
- Agente: `/api/agente/<algo>`, `preHandler: ctx.autenticarAgente`, `config: ctx.limiteAgente()`.
- Ação sensível → `ctx.auditarReq`; mudança visível → `ctx.emitir`.

### 1.10 Testes

`servidor/test/ajuda.js`: `novoApp()` (banco em memória, biblioteca de fixtures), `adminElevado(app, db, { papel })`,
`cliente(app)` (cookie + CSRF), `registrarAgente(app, c, info, { site_id })` (com `checkin()` e `resultado()`).
Para tempo real com sockets de verdade veja `test/tempo-real.test.js` (agente falso via pacote `ws`).
Rode `npm test` (servidor) e `python -m unittest discover -s agente/testes` (agente).

## 2. Agente

Pacote `agente/farol/` (só stdlib + psutil). Em produção o servidor o entrega como zipapp:
`GET /download/farol-agente.pyz` (montado em memória a partir de `agente/farol/**/*.py`).

Um módulo do agente é um arquivo em `agente/farol/modulos/` — importado automaticamente; se der erro, é ignorado com log:

```python
# agente/farol/modulos/processos.py
import psutil
from farol.registro import comando, sessao, coletor, Sessao, ErroComando

@comando("processos.listar")             # recebe args (dict) e ctx; o retorno vai como 'dados'
def listar(args, ctx):
    limite = int(args.get("limite", 50))
    return [p.info for p in psutil.process_iter(["pid", "name", "username"])][:limite]

@comando("processos.encerrar")
def encerrar(args, ctx):
    raise ErroComando("mensagem que aparece no painel")   # erro esperado → ok:false

@sessao("terminal")                      # sessão de relay; uma instância por sessão
class Terminal(Sessao):
    def iniciar(self, args): ...          # self.enviar(texto) manda ao painel; self.encerrar(motivo) fecha
    def receber(self, dados): ...         # chamado numa thread do executor (com self.trava)
    def fechar(self): ...

@coletor("patches", intervalo=3600)      # vai em extras["patches"] no check-in, a cada intervalo
def coletar(ctx):
    return {"pendentes": 3}
```

`ctx` (ContextoAgente) tem `cfg`, `cliente` (HTTP), `log`, `versao`. As capacidades (`comandos` + `sessao:<tipo>`) vão
no `info` do check-in e ficam em `GET /api/agentes/:id` → `capacidades` — o painel pode habilitar um botão só quando o
agente suporta. `python farol_agente.py modulos` lista o que foi descoberto.

O canal em tempo real (`farol/tempo_real.py` + cliente WebSocket próprio em `farol/ws.py`) é opcional: se cair, o agente
segue só com o check-in HTTP e reconecta com espera crescente. Jobs recebem variáveis como `FAROL_<NOME>` no ambiente.

## 3. Painel

SPA sem framework e sem CDN; CSP `script-src 'self'` (nada inline). O servidor lista as pastas de
`painel/js/modulos/` em `GET /api/painel/modulos`; o boot importa cada `index.js` e chama `iniciar(farol)`.
**Para criar um módulo basta criar a pasta** — nenhum arquivo do núcleo é editado.

```js
// painel/js/modulos/patches/index.js
import { h } from '../../nucleo/dom.js';
import { get } from '../../nucleo/api.js';
import { cabecalhoPagina, selo } from '../../ui/componentes.js';

export default {
  nome: 'patches',
  iniciar(farol) {
    farol.menu({ id: 'patches', rotulo: 'Patches', icone: 'pacote', secao: 'Gerenciar', ordem: 30, href: '#/patches', permissao: 'patches.ver' });
    farol.rota('/patches', { titulo: 'Patches', permissao: 'patches.ver', render(el, { params, query }) {
      el.append(cabecalhoPagina({ titulo: 'Patches', migalhas: [['Gerenciar'], ['Patches']] }));
      return () => { /* limpeza: cancelar aoEvento, timers */ };
    } });
    farol.abaDispositivo({ id: 'patches', rotulo: 'Patches', icone: 'pacote', ordem: 35, render(el, { agente, recarregar }) {} });
    farol.colunaDispositivo({ id: 'patches', rotulo: 'Patches', largura: '104px', ordem: 95, render: (a) => selo(a.patch_status ?? '—'), valor: (a) => a.patch_status });
    farol.widget({ id: 'patches', titulo: 'Conformidade de patches', tamanho: 4, ordem: 70, render(el, { escopo }) {} });
    farol.acaoLote({ id: 'patches-instalar', rotulo: 'Instalar patches', icone: 'download', executar: (agentes) => {} });
    farol.acaoDispositivo({ id: 'patches-verificar', rotulo: 'Verificar patches', icone: 'atualizar', menu: true, executar: (agente) => {} });
    farol.secaoConfig({ id: 'patches', rotulo: 'Política de patches', icone: 'pacote', render(el) {} });
    farol.comando({ id: 'patches-pendentes', rotulo: 'Ver patches pendentes', executar: () => { location.hash = '#/patches'; } });
    farol.buscador({ id: 'patches', secao: 'Patches', buscar: async (q) => [] });
    farol.notificacoes({ id: 'patches', contar: async () => 0, listar: async () => [], eventos: ['patch'] });
  },
};
```

Pontos de extensão (assinaturas completas em `painel/js/nucleo/registro.js`): `rota`, `menu`, `abaDispositivo`,
`acaoDispositivo`, `acaoLote`, `colunaDispositivo`, `widget`, `secaoConfig`, `comando`, `buscador`, `notificacoes`.
Seções do menu: Visão geral, Gerenciar, Automação, Monitoramento, Relatórios, Administração.

Use `pode('perm')`, `aoEvento(tipo, fn)` (devolve o cancelador), `paramsEscopo()`, `estado` de
`nucleo/estado.js`; `get/post/put/del/qs` de `nucleo/api.js`. Montagem de DOM **só** com `h()`/`s()` de
`nucleo/dom.js` (nunca `innerHTML` com dados). Componentes e padrões visuais: **`painel/DESIGN.md`** e a página `#/estilo`.

Ações que rodam algo nos dispositivos: `comElevacao('descrição', () => post(...))` de `ui/elevar.js` (pede o 2FA e
repete se expirar). Para executar scripts reutilize `executarScript({ agentes })` via a ação já registrada pelo módulo
`scripts` — não recrie o fluxo.

## 4. Biblioteca de scripts

`servidor/biblioteca/<categoria-slug>/<id>.<ps1|sh|py|cmd>` com cabeçalho em comentários (`#` ou `REM`) entre linhas `---`
(YAML simples: `id`, `nome`, `descricao`, `categoria`, `so: [windows|linux|macos]`, `shell`, `tipo: acao|monitor|auditoria`,
`tempo_limite` (5–86400), `requer_admin`, `tags`, `variaveis: [{nome, rotulo, tipo, padrao, obrigatorio, opcoes}]`).
O BOM UTF-8 dos `.ps1` é aceito; o agente grava `.ps1` em UTF-8 com BOM. Variáveis chegam como **variáveis de ambiente
`FAROL_<NOME>`**, nunca interpoladas. Scripts `monitor` terminam com `FAROL_STATUS: ok|alerta|critico <mensagem>` —
o servidor guarda em `jobs.monitor_status/monitor_msg`. Arquivos inválidos são ignorados e listados em
`GET /api/biblioteca/erros`. Valide com `npm run validar-biblioteca`.

## 5. Regras para trabalho em paralelo

1. Cada agente trabalha **só nas suas pastas**: `servidor/src/modulos/<seu>/`, `agente/farol/modulos/<seu>.py`,
   `painel/js/modulos/<seu>/`, `servidor/test/<seu>.test.js`, `agente/testes/test_<seu>.py`.
2. **Não edite** `servidor/src/nucleo/`, `servidor/src/app.js`, `painel/js/nucleo/`, `painel/js/ui/`, `painel/css/`.
   Precisa de algo novo no núcleo? Faça localmente no seu módulo e descreva a necessidade no relatório; o arquiteto
   integra. Precisa de um componente visual novo? Monte com os tokens e classes existentes dentro do seu módulo.
3. Tabelas novas: prefixe com o nome da área (`patches_*`, `monitores_*`). Nunca altere tabela de outro módulo — use o
   serviço dele ou peça um.
4. Ações de auditoria e permissões levam o prefixo da sua área (`patches.aprovar`, `patch_aprovado`).
5. Ao terminar: `npm test` e os testes do agente passando, e screenshot das suas telas nos dois temas.

## 6. Como adicionar um módulo (resumo)

1. Servidor: crie `servidor/src/modulos/<nome>/index.js` com `{ nome, depende, permissoes, migracoes, rotas, aoIniciar }`.
2. Proteja rotas com `ctx.exigir('<area>.<acao>', { elevado })`; audite com `ctx.auditarReq`; avise o painel com `ctx.emitir`.
3. Para falar com o agente: `ctx.comandos.enviar(id, '<area>.<acao>', args)`; para sessões interativas, `ctx.relay.registrarTipo`.
4. Agente: crie `agente/farol/modulos/<nome>.py` com `@comando`, `@sessao` ou `@coletor`.
5. Painel: crie `painel/js/modulos/<nome>/index.js` com `iniciar(farol)` registrando rota, menu, abas, colunas, widgets…
6. Use só componentes de `painel/js/ui/` e tokens de `painel/css/tokens.css` (veja `#/estilo`).
7. Testes em `servidor/test/<nome>.test.js` com `ajuda.js`; rode tudo antes de entregar.
