// Parser dos scripts da biblioteca (servidor/biblioteca/<categoria>/<id>.<ps1|sh|py|cmd>).
// O cabeçalho é um bloco de comentários (# ou REM) delimitado por linhas "---", com um YAML simples:
// pares chave: valor, listas inline [a, b], listas em bloco ("- item") e listas de mapas (variaveis).
import { normalizarDefinicoes } from '../../nucleo/variaveis.js';

export const SHELL_POR_EXTENSAO = { ps1: 'powershell', sh: 'bash', py: 'python', cmd: 'cmd', bat: 'cmd' };
export const SOS = ['windows', 'linux', 'macos'];
export const TIPOS = ['acao', 'monitor', 'auditoria'];
const ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,79}$/;

export class ErroBiblioteca extends Error {}

/** Remove o prefixo de comentário de uma linha do cabeçalho; devolve null se a linha não é comentário. */
function semPrefixo(linha, extensao) {
  const m = extensao === 'cmd' || extensao === 'bat'
    ? /^\s*(?:@?rem\b|::)\s?(.*)$/i.exec(linha)
    : /^\s*#\s?(.*)$/.exec(linha);
  return m ? m[1].replace(/\s+$/, '') : null;
}

/** Tira comentário "  # ..." do fim de um valor, respeitando aspas. */
function semComentario(texto) {
  let aspas = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === aspas) aspas = null; continue; }
    if (c === '"' || c === "'") aspas = c;
    else if (c === '#' && (i === 0 || /\s/.test(texto[i - 1]))) return texto.slice(0, i).trimEnd();
  }
  return texto.trimEnd();
}

function escalar(bruto) {
  const v = bruto.trim();
  if (v === '') return null;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    const dentro = v.slice(1, -1);
    return v[0] === '"' ? dentro.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\') : dentro.replace(/''/g, "'");
  }
  if (v.startsWith('[') && v.endsWith(']')) {
    const dentro = v.slice(1, -1).trim();
    if (!dentro) return [];
    return dividirVirgulas(dentro).map(escalar);
  }
  if (/^true$/i.test(v)) return true;
  if (/^false$/i.test(v)) return false;
  if (/^(null|~)$/i.test(v)) return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function dividirVirgulas(texto) {
  const partes = [];
  let atual = '';
  let aspas = null;
  for (const c of texto) {
    if (aspas) { atual += c; if (c === aspas) aspas = null; continue; }
    if (c === '"' || c === "'") { aspas = c; atual += c; continue; }
    if (c === ',') { partes.push(atual); atual = ''; continue; }
    atual += c;
  }
  partes.push(atual);
  return partes.map((p) => p.trim()).filter((p) => p !== '');
}

const indentacao = (l) => l.length - l.trimStart().length;

/** YAML mínimo → objeto. Suporta o subconjunto descrito no topo do arquivo. */
export function parseYamlSimples(linhas) {
  const obj = {};
  const ls = linhas.map(semComentario).map((l) => l.replace(/\t/g, '  ')).filter((l) => l.trim() !== '');
  let i = 0;
  while (i < ls.length) {
    const linha = ls[i];
    if (indentacao(linha) !== 0) throw new ErroBiblioteca(`indentação inesperada: "${linha.trim()}"`);
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(linha);
    if (!m) throw new ErroBiblioteca(`linha inválida: "${linha.trim()}"`);
    const [, chave, resto] = m;
    i++;
    if (resto !== '') { obj[chave] = escalar(resto); continue; }
    // bloco: lista ("- ...") com itens escalares ou mapas
    const lista = [];
    while (i < ls.length && indentacao(ls[i]) > 0) {
      const item = ls[i].trim();
      if (!item.startsWith('-')) throw new ErroBiblioteca(`esperava "- " em "${chave}": "${item}"`);
      const baseInd = indentacao(ls[i]);
      const conteudo = item.slice(1).trim();
      i++;
      const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(conteudo);
      if (!kv) { lista.push(escalar(conteudo)); continue; }
      const mapa = { [kv[1]]: escalar(kv[2]) };
      while (i < ls.length && indentacao(ls[i]) > baseInd && !ls[i].trim().startsWith('-')) {
        const kv2 = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(ls[i].trim());
        if (!kv2) throw new ErroBiblioteca(`linha inválida em "${chave}": "${ls[i].trim()}"`);
        mapa[kv2[1]] = escalar(kv2[2]);
        i++;
      }
      lista.push(mapa);
    }
    obj[chave] = lista.length ? lista : null;
  }
  return obj;
}

/** Separa cabeçalho e corpo. O cabeçalho precisa começar nas primeiras 10 linhas (depois de shebang/encoding). */
export function separarCabecalho(texto, extensao) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/);
  let inicio = -1;
  for (let i = 0; i < Math.min(linhas.length, 10); i++) {
    if (semPrefixo(linhas[i], extensao)?.trim() === '---') { inicio = i; break; }
  }
  if (inicio < 0) throw new ErroBiblioteca('cabeçalho "---" não encontrado no início do arquivo');
  const cab = [];
  for (let i = inicio + 1; i < linhas.length; i++) {
    const l = semPrefixo(linhas[i], extensao);
    if (l == null) throw new ErroBiblioteca(`linha ${i + 1}: o cabeçalho terminou sem o "---" final`);
    if (l.trim() === '---') {
      const antes = linhas.slice(0, inicio).join('\n');
      const corpo = linhas.slice(i + 1).join('\n').replace(/^\s*\n/, '');
      return { cabecalho: cab, corpo: antes ? `${antes}\n${corpo}` : corpo };
    }
    cab.push(l);
  }
  throw new ErroBiblioteca('o cabeçalho não foi fechado com "---"');
}

const comoLista = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/**
 * Lê um arquivo da biblioteca e devolve o item validado.
 * @param {string} texto       conteúdo do arquivo
 * @param {{ extensao: string, idArquivo: string, categoriaSlug: string, arquivo: string }} meta
 */
export function parseScript(texto, { extensao, idArquivo, categoriaSlug, arquivo }) {
  const shellExt = SHELL_POR_EXTENSAO[extensao];
  if (!shellExt) throw new ErroBiblioteca(`extensão .${extensao} não suportada`);
  const { cabecalho, corpo } = separarCabecalho(texto, extensao);
  const y = parseYamlSimples(cabecalho);

  const id = String(y.id ?? '');
  if (!ID_VALIDO.test(id)) throw new ErroBiblioteca(`id inválido "${id}" (use minúsculas, números e hífens)`);
  if (id !== idArquivo) throw new ErroBiblioteca(`o id "${id}" deve ser igual ao nome do arquivo ("${idArquivo}")`);
  if (!y.nome || typeof y.nome !== 'string') throw new ErroBiblioteca('falta "nome"');
  const shell = y.shell ?? shellExt;
  if (shell !== shellExt && !(shellExt === 'cmd' && shell === 'cmd')) {
    throw new ErroBiblioteca(`shell "${shell}" não combina com a extensão .${extensao} (esperado ${shellExt})`);
  }
  const so = comoLista(y.so).map((s) => String(s).toLowerCase());
  if (!so.length) throw new ErroBiblioteca('falta "so" (windows, linux, macos)');
  for (const s of so) if (!SOS.includes(s)) throw new ErroBiblioteca(`so inválido "${s}"`);
  const tipo = y.tipo ?? 'acao';
  if (!TIPOS.includes(tipo)) throw new ErroBiblioteca(`tipo inválido "${tipo}" (${TIPOS.join(', ')})`);
  const tempo = y.tempo_limite ?? 60;
  if (!Number.isInteger(tempo) || tempo < 5 || tempo > 3600) throw new ErroBiblioteca('tempo_limite deve ser um inteiro entre 5 e 3600');
  let variaveis;
  try { variaveis = normalizarDefinicoes(y.variaveis); } catch (e) { throw new ErroBiblioteca(e.message); }
  if (!corpo.trim()) throw new ErroBiblioteca('o script está vazio depois do cabeçalho');

  return {
    id,
    nome: String(y.nome).slice(0, 120),
    descricao: String(y.descricao ?? '').slice(0, 1000),
    categoria: String(y.categoria ?? categoriaSlug),
    categoria_slug: categoriaSlug,
    so, shell, tipo,
    tempo_limite: tempo,
    requer_admin: y.requer_admin === true,
    tags: comoLista(y.tags).map((t) => String(t).toLowerCase()).slice(0, 20),
    variaveis,
    conteudo: corpo,
    arquivo,
  };
}
