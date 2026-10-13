// Servidor local de desenvolvimento: arquivos de publico/ + funções de api/ (sem Vercel). Uso: node scripts/servir-local.mjs [porta]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const porta = Number(process.argv[2] || 4173);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
if (process.env.FAROL_DEMO) {
  // Modo demonstração: armazenamento em memória com uma licença de teste (chave descartável) e Stripe "ligado" sem rede.
  const { generateKeyPairSync } = await import('node:crypto');
  const { definirArmazenamento } = await import('../lib/armazenamento.js');
  const { emitirLicenca } = await import('../lib/licenca.js');
  process.env.LICENCA_CHAVE_PRIVADA = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
  const mem = new Map();
  const { licenca, chave } = emitirLicenca({ cliente: 'Empresa Demo Ltda', email: 'demo@exemplo.com', plano: 'profissional', dispositivos_max: 25, expira_em: Date.now() + 30 * 86400000 });
  mem.set('farol/licencas/sessao-cs_test_demo0123456789ABCDEFGHIJ.json', { sessao: 'cs_test_demo0123456789ABCDEFGHIJ', licenca, chave, intervalo: 'mes' });
  definirArmazenamento({ ler: async (c) => mem.get(c) ?? null, gravar: async (c, v) => { mem.set(c, v); } });
}
const csp = JSON.parse(await readFile(join(RAIZ, 'vercel.json'), 'utf8')).headers[0].headers;

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  for (const h of csp) res.setHeader(h.key, h.value);
  try {
    if (url.pathname.startsWith('/api/')) {
      const nome = url.pathname.slice(5).replace(/[^a-z]/g, '');
      const mod = await import(pathToFileURL(join(RAIZ, 'api', `${nome}.js`)).href);
      return mod.default(req, res);
    }
    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    if (rel.includes('..')) throw new Error('caminho inválido');
    if (!rel) rel = 'index.html';
    else if (!extname(rel)) rel += '.html';
    const dados = await readFile(join(RAIZ, 'publico', rel));
    res.setHeader('Content-Type', TIPOS[extname(rel)] || 'application/octet-stream');
    res.end(dados);
  } catch (e) {
    res.statusCode = e.code === 'ENOENT' ? 404 : 500;
    res.end(e.code === 'ENOENT' ? 'Não encontrado' : 'Erro');
  }
}).listen(porta, '127.0.0.1', () => console.log(`http://127.0.0.1:${porta}`));
