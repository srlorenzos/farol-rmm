// Peças compartilhadas do módulo de dispositivos.
import { h } from '../../nucleo/dom.js';
import { get, qs } from '../../nucleo/api.js';
import { paramsEscopo } from '../../nucleo/estado.js';
import { iconeSo } from '../../nucleo/icones.js';

/** Lista de dispositivos do escopo atual (cache curto para a paleta e widgets). */
let cache = { chave: '', em: 0, dados: null };
export async function listarDispositivos({ forcar = false } = {}) {
  const chave = qs(paramsEscopo());
  if (!forcar && cache.dados && cache.chave === chave && Date.now() - cache.em < 15_000) return cache.dados;
  const dados = await get(`/api/agentes${chave}`);
  cache = { chave, em: Date.now(), dados };
  return dados;
}
export const invalidarCache = () => { cache.em = 0; };

/** Célula "dispositivo": ícone do SO + hostname (link) + descrição/IP. */
export function celulaDispositivo(a) {
  return h('div', { class: 'celula-dispositivo' }, iconeSo(a.so),
    h('div', { class: 'celula-duas-linhas' },
      h('a', { class: 'nome', href: `#/dispositivos/${a.id}`, text: a.hostname }),
      h('span', { class: 'sub', text: a.descricao || [a.ip_local, a.usuario_logado].filter(Boolean).join(' · ') || a.so_versao || '' })));
}

/** Nome curto do sistema: "Windows 11 Pro 23H2" → mantém; versão longa é encurtada. */
export const nomeSo = (a) => (a.so_versao || a.so || 'Desconhecido').replace(/\s*\(build \d+\)/, '');
