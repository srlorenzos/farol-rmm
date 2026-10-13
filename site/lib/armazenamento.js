// Armazenamento em Vercel Blob privado. Sem BLOB_READ_WRITE_TOKEN, `disponivel()` é false.
// Em testes, `definirArmazenamento(objeto)` troca por um armazenamento em memória.
import { put, get } from '@vercel/blob';

let substituto = null;
export const definirArmazenamento = (s) => { substituto = s; };
export const disponivel = () => !!substituto || !!process.env.BLOB_READ_WRITE_TOKEN;

export async function ler(caminho) {
  if (substituto) return substituto.ler(caminho);
  const r = await get(caminho, { access: 'private', useCache: false });
  if (!r || !r.stream) return null;
  try { return JSON.parse(await new Response(r.stream).text()); } catch { return null; }
}

export async function gravar(caminho, valor) {
  if (substituto) return substituto.gravar(caminho, valor);
  await put(caminho, JSON.stringify(valor), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
}

export const caminhoSessao = (id) => `farol/licencas/sessao-${id}.json`;
export const caminhoAssinatura = (id) => `farol/licencas/assinatura-${id}.json`;
