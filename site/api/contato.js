// Formulário "Fale com vendas". Guarda o contato em farol/contatos/ (Vercel Blob privado).
// Sem Blob configurado responde { salvo: false } e o site abre um mailto para o e-mail de contato.
import { randomUUID } from 'node:crypto';
import { responder, lerJson, excedeu, exigirMetodo } from '../lib/http.js';
import { gravar, disponivel } from '../lib/armazenamento.js';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const limpar = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '');

export default async function handler(req, res) {
  if (!exigirMetodo(req, res, 'POST')) return;
  if (excedeu(req, 'contato', 5, 10 * 60_000)) return responder(res, 429, { erro: 'Muitos envios. Tente de novo em alguns minutos.' });
  let c;
  try { c = await lerJson(req); } catch (e) { return responder(res, e.status || 400, { erro: e.message }); }
  // Campo isca invisível para humanos: se vier preenchido, finge sucesso e descarta.
  if (limpar(c.site, 50)) return responder(res, 200, { ok: true, salvo: true });
  const nome = limpar(c.nome, 100);
  const email = limpar(c.email, 254);
  const empresa = limpar(c.empresa, 100);
  const mensagem = limpar(c.mensagem, 2000);
  const dispositivos = c.dispositivos == null || c.dispositivos === '' ? null : Number(c.dispositivos);
  if (!nome) return responder(res, 400, { erro: 'Informe seu nome.' });
  if (!EMAIL.test(email)) return responder(res, 400, { erro: 'Informe um e-mail válido.' });
  if (dispositivos != null && !(Number.isInteger(dispositivos) && dispositivos >= 1 && dispositivos <= 100_000)) return responder(res, 400, { erro: 'Quantidade de dispositivos inválida.' });
  if (!disponivel()) return responder(res, 200, { ok: true, salvo: false });
  const registro = { id: randomUUID(), recebido_em: new Date().toISOString(), nome, email, empresa, dispositivos, mensagem };
  try {
    await gravar(`farol/contatos/${registro.recebido_em.replace(/[:.]/g, '-')}-${registro.id.slice(0, 8)}.json`, registro);
    return responder(res, 200, { ok: true, salvo: true });
  } catch (e) {
    console.error('contato não salvo:', e.message);
    return responder(res, 200, { ok: true, salvo: false });
  }
}
