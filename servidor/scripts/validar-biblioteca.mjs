#!/usr/bin/env node
// Validador da biblioteca de scripts do Farol RMM (sem dependências).
// Uso: node servidor/scripts/validar-biblioteca.mjs [--sintaxe] [--json]
//   --sintaxe  além do cabeçalho, roda parser do PowerShell, `bash -n` e `python -m py_compile` quando disponíveis.
//   --json     imprime o resumo em JSON.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', 'biblioteca');
const args = new Set(process.argv.slice(2));

const CATEGORIAS = {
  'manutencao': 'Manutenção', 'disco-armazenamento': 'Disco e armazenamento', 'rede': 'Rede', 'seguranca': 'Segurança',
  'usuarios-contas': 'Usuários e contas', 'active-directory': 'Active Directory', 'microsoft-365': 'Microsoft 365',
  'servicos-processos': 'Serviços e processos', 'atualizacoes': 'Atualizações', 'software': 'Software', 'impressoras': 'Impressoras',
  'hardware-diagnostico': 'Hardware e diagnóstico', 'backup-recuperacao': 'Backup e recuperação', 'monitoramento': 'Monitoramento',
  'desempenho': 'Desempenho', 'navegadores': 'Navegadores', 'email-outlook': 'E-mail e Outlook', 'politicas-gpo': 'Políticas e GPO',
  'energia': 'Energia', 'registro-sistema': 'Registro e logs do sistema', 'certificados': 'Certificados', 'firewall': 'Firewall',
  'antivirus-defender': 'Antivírus e Defender', 'bitlocker-criptografia': 'BitLocker e criptografia', 'remoto-acesso': 'Acesso remoto',
  'linux-servidores': 'Servidores Linux', 'macos': 'macOS', 'onboarding-offboarding': 'Onboarding e offboarding',
  'inventario-auditoria': 'Inventário e auditoria', 'compliance': 'Compliance', 'utilitarios': 'Utilitários',
};
const SO = ['windows', 'linux', 'macos'];
const SHELLS = { powershell: ['ps1'], cmd: ['cmd', 'bat'], bash: ['sh'], python: ['py'] };
const TIPOS = ['acao', 'monitor', 'auditoria'];
const TIPOS_VAR = ['texto', 'numero', 'booleano', 'selecao', 'senha'];
const OBRIGATORIOS = ['id', 'nome', 'descricao', 'categoria', 'so', 'shell', 'tipo', 'tempo_limite', 'requer_admin', 'tags', 'variaveis'];

// ---------- YAML mínimo ----------
function semComentario(s) {
  let asp = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (asp) { if (c === '\\' && asp === '"') i++; else if (c === asp) asp = null; }
    else if (c === '"' || c === "'") asp = c;
    else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s.trimEnd();
}
function dividirLista(s) {
  const itens = []; let atual = ''; let asp = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (asp) { atual += c; if (c === '\\' && asp === '"') { atual += s[++i] ?? ''; } else if (c === asp) asp = null; }
    else if (c === '"' || c === "'") { asp = c; atual += c; }
    else if (c === ',') { itens.push(atual); atual = ''; }
    else atual += c;
  }
  if (atual.trim() !== '' || itens.length) itens.push(atual);
  return itens;
}
function valor(bruto) {
  const s = bruto.trim();
  if (s === '') return '';
  if (s.startsWith('"')) {
    if (!s.endsWith('"') || s.length < 2) throw new Error(`string com aspas mal formada: ${s}`);
    return JSON.parse(s);
  }
  if (s.startsWith("'")) {
    if (!s.endsWith("'") || s.length < 2) throw new Error(`string com aspas mal formada: ${s}`);
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s.startsWith('[')) {
    if (!s.endsWith(']')) throw new Error(`lista mal formada: ${s}`);
    const miolo = s.slice(1, -1).trim();
    return miolo === '' ? [] : dividirLista(miolo).map(valor);
  }
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true';
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^(null|~)$/i.test(s)) return null;
  return s;
}
function parseYaml(linhas) {
  const obj = {}; let i = 0;
  const indent = l => l.length - l.trimStart().length;
  while (i < linhas.length) {
    const bruta = linhas[i];
    const l = semComentario(bruta);
    if (l.trim() === '') { i++; continue; }
    if (indent(l) !== 0) throw new Error(`indentação inesperada: "${bruta.trim()}"`);
    const m = l.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (!m) throw new Error(`linha inválida: "${bruta.trim()}"`);
    const [, chave, resto] = m;
    if (chave in obj) throw new Error(`chave duplicada: ${chave}`);
    if (resto !== undefined && resto.trim() !== '') { obj[chave] = valor(resto); i++; continue; }
    // bloco: lista de mapas
    const lista = []; i++;
    let item = null;
    while (i < linhas.length) {
      const sub = semComentario(linhas[i]);
      if (sub.trim() === '') { i++; continue; }
      if (indent(sub) === 0) break;
      const t = sub.trim();
      if (t.startsWith('- ')) {
        item = {}; lista.push(item);
        const mm = t.slice(2).match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
        if (!mm) throw new Error(`item de lista inválido: "${t}"`);
        item[mm[1]] = valor(mm[2] ?? '');
      } else {
        if (!item) throw new Error(`campo fora de item de lista: "${t}"`);
        const mm = t.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
        if (!mm) throw new Error(`campo inválido: "${t}"`);
        if (mm[1] in item) throw new Error(`campo duplicado no item: ${mm[1]}`);
        item[mm[1]] = valor(mm[2] ?? '');
      }
      i++;
    }
    obj[chave] = lista;
  }
  return obj;
}

// ---------- extração do cabeçalho ----------
function extrairCabecalho(texto, shell) {
  const prefixo = shell === 'cmd' ? /^\s*REM ?/i : /^\s*# ?/;
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/);
  let ini = -1, fim = -1;
  for (let i = 0; i < Math.min(linhas.length, 200); i++) {
    const l = linhas[i];
    if (i === 0 && l.startsWith('#!')) continue;
    if (ini < 0) {
      if (!prefixo.test(l)) { if (l.trim() === '' || /^@echo off/i.test(l)) continue; return { erro: 'cabeçalho não encontrado no início do arquivo' }; }
      if (l.replace(prefixo, '').trim() === '---') ini = i;
      continue;
    }
    if (!prefixo.test(l)) return { erro: 'cabeçalho interrompido por linha sem comentário' };
    if (l.replace(prefixo, '').trim() === '---') { fim = i; break; }
  }
  if (ini < 0 || fim < 0) return { erro: 'delimitadores "---" do cabeçalho ausentes' };
  const yaml = linhas.slice(ini + 1, fim).map(l => l.replace(prefixo, ''));
  return { yaml, corpo: linhas.slice(fim + 1).join('\n') };
}

// ---------- validação ----------
const erros = [], avisos = [];
const err = (arq, msg) => erros.push(`${arq}: ${msg}`);
const aviso = (arq, msg) => avisos.push(`${arq}: ${msg}`);

function listar(dir) {
  const r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...listar(p)); else r.push(p);
  }
  return r;
}
if (!fs.existsSync(RAIZ)) { console.error(`Pasta não encontrada: ${RAIZ}`); process.exit(2); }

const scripts = [];
const ids = new Map();
const catPorPasta = new Map();
for (const arq of listar(RAIZ).sort()) {
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  const ext = path.extname(arq).slice(1).toLowerCase();
  if (rel === 'README.md') continue;
  if (!Object.values(SHELLS).flat().includes(ext)) { err(rel, `extensão não reconhecida (.${ext})`); continue; }
  const partes = rel.split('/');
  if (partes.length !== 2) { err(rel, 'o arquivo deve estar em <categoria-slug>/<id>.<ext>'); continue; }
  const [pasta, nomeArq] = partes;
  const texto = fs.readFileSync(arq, 'utf8');
  const shellProvavel = Object.keys(SHELLS).find(s => SHELLS[s].includes(ext));
  const cab = extrairCabecalho(texto, shellProvavel);
  if (cab.erro) { err(rel, cab.erro); continue; }
  let h;
  try { h = parseYaml(cab.yaml); } catch (e) { err(rel, `cabeçalho YAML inválido: ${e.message}`); continue; }

  for (const c of OBRIGATORIOS) if (!(c in h)) err(rel, `campo obrigatório ausente: ${c}`);
  const id = h.id;
  if (typeof id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) err(rel, `id inválido (kebab-case): ${id}`);
  else {
    if (path.basename(nomeArq, '.' + ext) !== id) err(rel, `id "${id}" difere do nome do arquivo`);
    if (ids.has(id)) err(rel, `id duplicado (também em ${ids.get(id)})`); else ids.set(id, rel);
  }
  for (const c of ['nome', 'descricao']) if (typeof h[c] !== 'string' || h[c].trim().length < 5) err(rel, `${c} vazio ou curto demais`);
  if (typeof h.descricao === 'string' && h.descricao.length > 400) aviso(rel, 'descricao muito longa (>400)');
  if (!Array.isArray(h.so) || !h.so.length || h.so.some(s => !SO.includes(s))) err(rel, `so inválido: ${JSON.stringify(h.so)} (use ${SO.join('|')})`);
  if (!SHELLS[h.shell]) err(rel, `shell inválido: ${h.shell}`);
  else if (!SHELLS[h.shell].includes(ext)) err(rel, `extensão .${ext} incompatível com shell ${h.shell}`);
  else if (Array.isArray(h.so)) {
    if ((h.shell === 'powershell' || h.shell === 'cmd') && !h.so.includes('windows')) err(rel, `shell ${h.shell} exige so contendo windows`);
    if (h.shell === 'bash' && !h.so.some(s => s === 'linux' || s === 'macos')) err(rel, 'shell bash exige so linux ou macos');
    if (h.shell === 'bash' && h.so.includes('windows')) err(rel, 'shell bash não deve declarar windows');
    if (h.shell === 'bash' && !/^#!.*\b(ba)?sh\b/.test(texto.split('\n')[0])) aviso(rel, 'shebang ausente');
  }
  if (!TIPOS.includes(h.tipo)) err(rel, `tipo inválido: ${h.tipo}`);
  if (!Number.isInteger(h.tempo_limite) || h.tempo_limite < 1 || h.tempo_limite > 86400) err(rel, `tempo_limite inválido: ${h.tempo_limite}`);
  if (typeof h.requer_admin !== 'boolean') err(rel, 'requer_admin deve ser true|false');
  if (!Array.isArray(h.tags) || h.tags.some(t => typeof t !== 'string' || !t)) err(rel, 'tags deve ser lista de textos');
  if (!(pasta in CATEGORIAS)) err(rel, `pasta de categoria desconhecida: ${pasta}`);
  else if (h.categoria !== CATEGORIAS[pasta]) err(rel, `categoria "${h.categoria}" difere do esperado "${CATEGORIAS[pasta]}" para a pasta ${pasta}`);
  if (!catPorPasta.has(pasta)) catPorPasta.set(pasta, new Set());
  catPorPasta.get(pasta).add(h.categoria);

  // variáveis
  const nomesVar = new Set();
  if (!Array.isArray(h.variaveis)) err(rel, 'variaveis deve ser lista');
  else for (const v of h.variaveis) {
    const ctx = `variável ${v.nome ?? '?'}`;
    if (typeof v.nome !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(v.nome)) { err(rel, `${ctx}: nome inválido (MAIÚSCULAS_COM_UNDERSCORE)`); continue; }
    if (nomesVar.has(v.nome)) err(rel, `${ctx}: duplicada`);
    nomesVar.add(v.nome);
    if (typeof v.rotulo !== 'string' || !v.rotulo.trim()) err(rel, `${ctx}: rotulo ausente`);
    if (!TIPOS_VAR.includes(v.tipo)) err(rel, `${ctx}: tipo inválido (${v.tipo})`);
    if (typeof v.obrigatorio !== 'boolean') err(rel, `${ctx}: obrigatorio deve ser true|false`);
    if (!Array.isArray(v.opcoes)) err(rel, `${ctx}: opcoes deve ser lista`);
    if (!('padrao' in v)) err(rel, `${ctx}: padrao ausente`);
    if (v.tipo === 'selecao') {
      if (!Array.isArray(v.opcoes) || v.opcoes.length < 2) err(rel, `${ctx}: selecao exige ao menos 2 opcoes`);
      else if (v.padrao !== '' && !v.opcoes.map(String).includes(String(v.padrao))) err(rel, `${ctx}: padrao "${v.padrao}" fora das opcoes`);
    } else if (Array.isArray(v.opcoes) && v.opcoes.length) err(rel, `${ctx}: opcoes só é válido para tipo selecao`);
    if (v.tipo === 'numero' && v.padrao !== '' && typeof v.padrao !== 'number') err(rel, `${ctx}: padrao de numero deve ser número`);
    if (v.tipo === 'booleano' && v.padrao !== '' && typeof v.padrao !== 'boolean') err(rel, `${ctx}: padrao de booleano deve ser true|false`);
    if (v.tipo === 'senha' && v.padrao !== '') err(rel, `${ctx}: senha não deve ter padrao`);
    if (v.obrigatorio === true && v.padrao !== '' && v.tipo !== 'selecao') aviso(rel, `${ctx}: obrigatória com padrão`);
  }

  // corpo
  const corpo = cab.corpo;
  if (h.tipo === 'monitor' && !corpo.includes('FAROL_STATUS')) err(rel, 'monitor deve conter FAROL_STATUS');
  if (h.tipo === 'monitor' && !/FAROL_STATUS: *(\$|"|'|\w)/.test(corpo) && !/FAROL_STATUS/.test(corpo)) err(rel, 'monitor sem saída FAROL_STATUS');
  if (h.tipo !== 'monitor' && /FAROL_STATUS/.test(corpo) && !/Out-Status|f_status/.test(corpo)) aviso(rel, 'FAROL_STATUS em script que não é monitor');
  const usadas = new Set([...corpo.matchAll(/FAROL_([A-Z][A-Z0-9_]*)/g)].map(m => m[1]));
  usadas.delete('STATUS');
  for (const u of usadas) if (!nomesVar.has(u)) err(rel, `usa FAROL_${u} sem declarar a variável no cabeçalho`);
  for (const n of nomesVar) if (!usadas.has(n)) aviso(rel, `variável ${n} declarada e não utilizada`);
  if (h.tipo === 'acao' && /Remove-Item|rm -rf|Remove-|userdel|Stop-Process|Restart-/.test(corpo) &&
      !/CONFIRMAR|SIMULAR|Test-Confirmar|Test-Simular|f_confirmar|f_simular|FAROL_[A-Z_]+/.test(corpo)) aviso(rel, 'ação potencialmente destrutiva sem variável de proteção');
  if (!corpo.trim()) err(rel, 'corpo vazio');

  scripts.push({ rel, arq, shell: h.shell, so: h.so, tipo: h.tipo, categoria: h.categoria, pasta, id, admin: h.requer_admin });
}
for (const [pasta, set] of catPorPasta) if (set.size > 1) err(pasta + '/', `categoria inconsistente na pasta: ${[...set].join(' | ')}`);
for (const slug of Object.keys(CATEGORIAS)) if (!catPorPasta.has(slug)) aviso(slug + '/', 'categoria sem scripts');

// ---------- checagem de sintaxe real ----------
function tem(cmd, argv = ['--version']) { try { return spawnSync(cmd, argv, { stdio: 'ignore' }).status === 0; } catch { return false; } }
if (args.has('--sintaxe')) {
  const ps = scripts.filter(s => s.shell === 'powershell');
  if (ps.length) {
    const lista = path.join(os.tmpdir(), `farol-ps-${process.pid}.txt`);
    const runner = path.join(os.tmpdir(), `farol-ps-${process.pid}.ps1`);
    fs.writeFileSync(lista, ps.map(s => s.arq).join('\n'), 'utf8');
    fs.writeFileSync(runner, `$n=0\nGet-Content -LiteralPath '${lista}' -Encoding UTF8 | ForEach-Object {\n $t=$null;$e=$null\n [void][System.Management.Automation.Language.Parser]::ParseFile($_,[ref]$t,[ref]$e)\n foreach($x in $e){ "ERRO|$_|$($x.Extent.StartLineNumber)|$($x.Message)" }\n}\n`, 'utf8');
    const cmd = process.platform === 'win32' ? 'powershell' : 'pwsh';
    const r = spawnSync(cmd, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', runner], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.error) aviso('sintaxe', `PowerShell indisponível (${r.error.message}); .ps1 não verificados`);
    else for (const l of (r.stdout || '').split(/\r?\n/)) if (l.startsWith('ERRO|')) { const [, f, n, m] = l.split('|'); err(path.relative(RAIZ, f).split(path.sep).join('/'), `sintaxe PowerShell (linha ${n}): ${m}`); }
    fs.rmSync(lista, { force: true }); fs.rmSync(runner, { force: true });
  }
  if (tem('bash')) for (const s of scripts.filter(s => s.shell === 'bash')) { const r = spawnSync('bash', ['-n', s.arq], { encoding: 'utf8' }); if (r.status !== 0) err(s.rel, `bash -n: ${(r.stderr || '').trim().split('\n')[0]}`); }
  else aviso('sintaxe', 'bash indisponível; .sh não verificados');
  const py = tem('python', ['--version']) ? 'python' : tem('python3', ['--version']) ? 'python3' : null;
  if (py) for (const s of scripts.filter(s => s.shell === 'python')) {
    const r = spawnSync(py, ['-I', '-c', 'import ast,sys; ast.parse(open(sys.argv[1],encoding="utf-8").read())', s.arq], { encoding: 'utf8' });
    if (r.status !== 0) err(s.rel, `python: ${(r.stderr || '').trim().split('\n').pop()}`);
  } else if (scripts.some(s => s.shell === 'python')) aviso('sintaxe', 'python indisponível; .py não verificados');
}

// ---------- resumo ----------
const conta = (f) => { const m = {}; for (const s of scripts) for (const k of [].concat(f(s))) m[k] = (m[k] || 0) + 1; return m; };
const resumo = { total: scripts.length, porSO: conta(s => s.so), porTipo: conta(s => s.tipo), porShell: conta(s => s.shell), porCategoria: conta(s => s.categoria), erros: erros.length, avisos: avisos.length };
if (args.has('--json')) console.log(JSON.stringify({ ...resumo, listaErros: erros, listaAvisos: avisos }, null, 2));
else {
  const imp = (t, m) => { console.log(`\n${t}`); for (const [k, v] of Object.entries(m).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`); };
  console.log(`Biblioteca: ${RAIZ}\nTotal de scripts: ${resumo.total}`);
  imp('Por sistema operacional:', resumo.porSO); imp('Por tipo:', resumo.porTipo); imp('Por shell:', resumo.porShell); imp('Por categoria:', resumo.porCategoria);
  if (avisos.length) { console.log(`\nAvisos (${avisos.length}):`); avisos.slice(0, 40).forEach(a => console.log('  - ' + a)); if (avisos.length > 40) console.log(`  ... e mais ${avisos.length - 40}`); }
  if (erros.length) { console.log(`\nERROS (${erros.length}):`); erros.forEach(e => console.log('  x ' + e)); }
  else console.log('\nNenhum erro encontrado.');
}
process.exit(erros.length ? 1 : 0);
