// Cookies e sessões do painel.
import { sha256, gerarToken } from '../seguranca.js';

export const COOKIE_SESSAO = 'farol_sessao';

export function lerCookies(cabecalho = '') {
  const cookies = {};
  for (const parte of String(cabecalho).split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const nome = parte.slice(0, i).trim();
    if (!nome) continue;
    try { cookies[nome] = decodeURIComponent(parte.slice(i + 1).trim()); } catch { /* cookie malformado é ignorado */ }
  }
  return cookies;
}

export function montarCookie(nome, valor, { maxAge, seguro }) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`];
  if (seguro) partes.push('Secure');
  return partes.join('; ');
}

export function criarSessao(ctx, usuarioId, ip) {
  const token = gerarToken();
  const agora = Date.now();
  const duracao = ctx.config.sessaoHoras * 3600_000;
  const r = ctx.db.prepare('INSERT INTO sessoes (usuario_id, token_hash, criado_em, expira_em, ip) VALUES (?, ?, ?, ?, ?)')
    .run(usuarioId, sha256(token), agora, agora + duracao, ip);
  return { token, id: Number(r.lastInsertRowid), maxAge: Math.floor(duracao / 1000) };
}

const SQL_SESSAO = `SELECT s.id, s.usuario_id, s.expira_em, s.elevado_ate, u.usuario, u.nome, u.papel, u.totp_ativo
  FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
  WHERE s.token_hash = ? AND s.expira_em > ? AND u.ativo = 1`;

export function sessaoPorToken(ctx, token) {
  if (!token || token.length > 200) return null;
  return ctx.db.prepare(SQL_SESSAO).get(sha256(token), Date.now()) ?? null;
}

export function obterSessao(ctx, req) {
  return sessaoPorToken(ctx, lerCookies(req.headers.cookie)[COOKIE_SESSAO]);
}

export function sessaoPorId(ctx, id) {
  return ctx.db.prepare(`SELECT s.id, s.usuario_id, s.expira_em, s.elevado_ate, u.usuario, u.nome, u.papel, u.totp_ativo
    FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = ? AND s.expira_em > ? AND u.ativo = 1`).get(id, Date.now()) ?? null;
}
