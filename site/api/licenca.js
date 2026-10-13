// Devolve a licença de UMA sessão de pagamento já concluída (a página /sucesso.html usa isto).
// Segurança: o session_id do Stripe é um segredo longo e imprevisível; só existe registro para sessões pagas;
// o caminho é montado a partir de um id validado por regex (sem travessia) e nada além da própria licença é exposto.
import { responder, exigirMetodo, excedeu } from '../lib/http.js';
import { ler, disponivel, caminhoSessao } from '../lib/armazenamento.js';

const SESSAO = /^cs_(?:test|live)_[A-Za-z0-9]{20,200}$/;

export default async function handler(req, res) {
  if (!exigirMetodo(req, res, 'GET')) return;
  if (excedeu(req, 'licenca', 30, 5 * 60_000)) return responder(res, 429, { erro: 'Muitas consultas. Aguarde um pouco.' });
  const id = new URL(req.url, 'http://x').searchParams.get('session_id') || '';
  if (!SESSAO.test(id)) return responder(res, 400, { erro: 'Sessão inválida.' });
  if (!disponivel()) return responder(res, 503, { erro: 'Armazenamento de licenças não configurado.' });
  let reg;
  try { reg = await ler(caminhoSessao(id)); } catch (e) { console.error('leitura da licença falhou:', e.message); return responder(res, 502, { erro: 'Não foi possível consultar agora.' }); }
  // Ainda sem registro: o webhook do Stripe costuma chegar em segundos. O site tenta de novo.
  if (!reg || reg.sessao !== id) return responder(res, 202, { pendente: true });
  const l = reg.licenca;
  return responder(res, 200, { chave: reg.chave, cliente: l.cliente, plano: l.plano, dispositivos_max: l.dispositivos_max, emitida_em: l.emitida_em, expira_em: l.expira_em, intervalo: reg.intervalo });
}
