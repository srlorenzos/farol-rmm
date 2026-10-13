// Gera dist/farol-servidor.exe: o servidor Node como executável único (Node SEA, Node 22.13+).
//   1. esbuild junta o servidor (src/**) num único .cjs; um plugin troca a descoberta de módulos por um registro estático
//      (não há pasta src/modulos dentro do exe) sem editar o código do servidor;
//   2. painel, biblioteca de scripts e o código Python do agente (para /download/farol-agente.pyz) viram um asset
//      comprimido do SEA e são extraídos para a pasta de dados na primeira execução;
//   3. o node.exe é copiado, recebe ícone/versão (rcedit) e o blob do SEA (postject).
// Uso: node build.mjs [--saida <pasta>]
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
const SERVIDOR = join(RAIZ, 'servidor');
const { values } = parseArgs({ options: { saida: { type: 'string' } } });
const SAIDA = resolve(values.saida || join(RAIZ, 'empacotamento', 'dist'));
const TRABALHO = join(RAIZ, 'empacotamento', 'build', 'servidor');
const VERSAO = readFileSync(join(RAIZ, 'empacotamento', 'VERSION'), 'utf8').trim();

if (!existsSync(join(SERVIDOR, 'node_modules'))) throw new Error('Rode "npm ci" em servidor/ antes (as dependências do servidor entram no bundle).');
const [maior] = process.versions.node.split('.').map(Number);
if (maior < 22) throw new Error(`Node SEA exige Node 22+; este é ${process.version}.`);

rmSync(TRABALHO, { recursive: true, force: true });
mkdirSync(TRABALHO, { recursive: true });
mkdirSync(SAIDA, { recursive: true });

// ---------- registro estático dos módulos do servidor ----------
const pastaModulos = join(SERVIDOR, 'src', 'modulos');
const modulos = readdirSync(pastaModulos, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && existsSync(join(pastaModulos, d.name, 'index.js')))
  .map((d) => d.name).sort();
const entradaVirtual = [
  ...modulos.map((m, i) => `import m${i} from ${JSON.stringify(join(pastaModulos, m, 'index.js').split(sep).join('/'))};`),
  `globalThis.__FAROL_MODULOS__ = { ${modulos.map((m, i) => `${JSON.stringify(m)}: m${i}`).join(', ')} };`,
  `import { iniciar } from ${JSON.stringify(join(AQUI, 'entrada.js').split(sep).join('/'))};`,
  'iniciar().catch((e) => { console.error(e); process.exit(1); });',
].join('\n');

/** Troca descobrirModulos (que lê src/modulos do disco e usa import dinâmico) por uma versão sobre o registro estático. */
const pluginModulos = {
  name: 'farol-modulos-estaticos',
  setup(b) {
    b.onLoad({ filter: /nucleo[\\/]modulos\.js$/ }, (args) => {
      let src = readFileSync(args.path, 'utf8');
      const ini = src.indexOf('export async function descobrirModulos');
      const fim = src.indexOf('export function validarModulo');
      if (ini < 0 || fim < 0) throw new Error('nucleo/modulos.js mudou: ajuste o plugin de empacotamento.');
      const nova = `export async function descobrirModulos(_pasta, { ignorar = [] } = {}) {
  const reg = globalThis.__FAROL_MODULOS__ || {};
  const modulos = [];
  for (const nome of Object.keys(reg).sort()) {
    if (ignorar.includes(nome)) continue;
    validarModulo(reg[nome], nome);
    modulos.push(reg[nome]);
  }
  return ordenarModulos(modulos);
}

`;
      return { contents: src.slice(0, ini) + nova + src.slice(fim), loader: 'js' };
    });
  },
};

const bundle = join(TRABALHO, 'servidor.cjs');
await build({
  stdin: { contents: entradaVirtual, resolveDir: AQUI, sourcefile: 'entrada-gerada.js', loader: 'js' },
  bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: bundle, minify: false, legalComments: 'none',
  plugins: [pluginModulos],
  // import.meta.url (usado por config.js para achar a raiz) aponta para a pasta de dados: RAIZ_SERVIDOR = pasta de dados.
  define: { 'import.meta.url': '__farol_url', 'process.env.FAROL_VERSAO_BUILD': JSON.stringify(VERSAO) },
  banner: {
    js: `const __farol_url = require('node:url').pathToFileURL(require('node:path').join(process.env.FAROL_DADOS || (process.platform === 'win32' ? require('node:path').join(process.env.ProgramData || 'C:\\\\ProgramData', 'FarolServidor') : require('node:path').join(process.env.HOME || '.', '.farol-servidor')), 'src', 'config.js')).href;`,
  },
  logLevel: 'warning',
});

// ---------- assets: painel, biblioteca e agente Python ----------
function listar(pasta, raiz, filtro = () => true, saida = {}) {
  if (!existsSync(pasta)) return saida;
  for (const d of readdirSync(pasta, { withFileTypes: true })) {
    if (d.name.startsWith('.') || d.name === '__pycache__' || d.name === 'node_modules') continue;
    const caminho = join(pasta, d.name);
    if (d.isDirectory()) listar(caminho, raiz, filtro, saida);
    else if (filtro(d.name)) saida[relative(raiz, caminho).split(sep).join('/')] = readFileSync(caminho).toString('base64');
  }
  return saida;
}
const arquivos = {
  ...Object.fromEntries(Object.entries(listar(join(RAIZ, 'painel'), join(RAIZ, 'painel'))).map(([k, v]) => [`painel/${k}`, v])),
  ...Object.fromEntries(Object.entries(listar(join(SERVIDOR, 'biblioteca'), join(SERVIDOR, 'biblioteca'))).map(([k, v]) => [`biblioteca/${k}`, v])),
  ...Object.fromEntries(Object.entries(listar(join(RAIZ, 'agente', 'farol'), join(RAIZ, 'agente', 'farol'), (n) => n.endsWith('.py'))).map(([k, v]) => [`agente/farol/${k}`, v])),
};
const recursos = join(TRABALHO, 'recursos.gz');
writeFileSync(recursos, gzipSync(Buffer.from(JSON.stringify(arquivos)), { level: 9 }));
console.log(`assets: ${Object.keys(arquivos).length} arquivos, ${(readFileSync(recursos).length / 1e6).toFixed(1)} MB comprimidos`);

// ---------- SEA ----------
const configSea = join(TRABALHO, 'sea-config.json');
const blob = join(TRABALHO, 'sea.blob');
writeFileSync(configSea, JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true, useCodeCache: false,
  assets: { 'recursos.gz': recursos } }));
execFileSync(process.execPath, ['--experimental-sea-config', configSea], { stdio: 'inherit' });

const exe = join(SAIDA, 'farol-servidor.exe');
copyFileSync(process.execPath, exe);
try {
  const { default: rcedit } = await import('rcedit');
  await rcedit(exe, {
    icon: join(RAIZ, 'empacotamento', 'recursos', 'farol.ico'),
    'version-string': { CompanyName: 'Farol', ProductName: 'Farol RMM', FileDescription: 'Farol RMM Server',
      InternalName: 'farol-servidor', OriginalFilename: 'farol-servidor.exe', LegalCopyright: 'Farol RMM (MIT)' },
    'file-version': `${VERSAO}.0`, 'product-version': VERSAO,
  });
} catch (e) {
  console.warn('rcedit indisponível, exe sem ícone/versão personalizados:', e.message);
}
const postject = join(AQUI, 'node_modules', 'postject', 'dist', 'cli.js');
execFileSync(process.execPath, [postject, exe, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'],
  { stdio: 'inherit' });
console.log(`gerado ${exe} (${(readFileSync(exe).length / 1e6).toFixed(0)} MB)`);
