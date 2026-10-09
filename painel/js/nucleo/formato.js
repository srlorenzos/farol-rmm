// Formatação pt-BR de números, bytes, datas e durações.

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export const fmtInt = (v) => (v == null ? '—' : nf0.format(v));
export const fmtNum = (v, casas = 1) => (v == null ? '—' : (casas ? nf1 : nf0).format(v));
export const fmtCompacto = (v) => (v == null ? '—' : v < 10_000 ? nf0.format(v) : compacto.format(v));
export const fmtPct = (v) => (v == null ? '—' : `${nf0.format(v)}%`);

export function fmtBytes(b) {
  if (b == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let v = Number(b);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${(i >= 3 ? nf1 : nf0).format(v)} ${u[i]}`;
}

export function fmtDuracao(seg) {
  if (seg == null) return '—';
  const d = Math.floor(seg / 86400);
  const h = Math.floor((seg % 86400) / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}min`;
  return `${m} min`;
}

export function fmtMs(ms) {
  if (ms == null) return '—';
  return ms < 1000 ? `${nf0.format(ms)} ms` : ms < 60_000 ? `${nf1.format(ms / 1000)} s` : fmtDuracao(Math.round(ms / 1000));
}

const dtf = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dtfSeg = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
const hf = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const df = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
export const fmtData = (ms, { segundos = false } = {}) => (ms ? (segundos ? dtfSeg : dtf).format(new Date(ms)) : '—');
export const fmtHora = (ms) => hf.format(new Date(ms));
export const fmtDia = (ms) => df.format(new Date(ms)).replace('.', '');

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
export function relativo(ms) {
  if (!ms) return 'nunca';
  const seg = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(seg);
  if (abs < 10) return 'agora';
  if (abs < 60) return rtf.format(seg, 'second');
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
  return rtf.format(Math.round(seg / 86400), 'day');
}

export const ramPct = (a) => (a?.ram_total ? (a.ram_usada / a.ram_total) * 100 : null);

export const NOMES_SHELL = { powershell: 'PowerShell', cmd: 'CMD', bash: 'Bash', python: 'Python' };
export const NOMES_SO = { windows: 'Windows', linux: 'Linux', macos: 'macOS' };

export function soChave(so) {
  const t = String(so ?? '').toLowerCase();
  if (t.startsWith('win')) return 'windows';
  if (t === 'darwin' || t.startsWith('mac')) return 'macos';
  return t ? 'linux' : null;
}

export function iniciais(nome) {
  const partes = String(nome ?? '?').split(/[\s._@-]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase();
}

export const plural = (n, um, varios) => `${fmtInt(n)} ${n === 1 ? um : varios}`;

/** Remove acentos e caixa (busca tolerante). */
export const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
