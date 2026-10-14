// Modo elevado: ações remotas exigem 2FA ativo e um código TOTP recente (vale 10 min).
import { h } from '../nucleo/dom.js';
import { post } from '../nucleo/api.js';
import { estado, emitir } from '../nucleo/estado.js';
import { modal, toast, toastErro } from './camadas.js';
import { campoCodigo } from './componentes.js';
import { icone } from '../nucleo/icones.js';

/** Garante o modo elevado; pede o código se preciso. Resolve true quando liberado. */
export async function garantirElevado(descricao = 'Esta ação roda nos dispositivos.') {
  if (!estado.totpAtivo) {
    toast('Ative o 2FA em Configurações → Minha conta para executar ações remotas.', 'aviso', { titulo: '2FA necessário' });
    location.hash = '#/configuracoes/conta';
    return false;
  }
  if (estado.elevadoAte > Date.now() + 5000) return true;
  const r = await modal({
    titulo: 'Confirme com o 2FA', largura: 'sm', icone: 'cadeado',
    descricao,
    conteudo: (fechar) => {
      const codigo = campoCodigo();
      const erro = h('p', { class: 'erro-campo', role: 'alert' });
      const botao = h('button', { class: 'btn btn-primario', type: 'submit' }, icone('check'), h('span', { text: 'Confirmar' }));
      const form = h('form', {
        class: 'form', onsubmit: async (ev) => {
          ev.preventDefault();
          botao.disabled = true;
          erro.textContent = '';
          try {
            const resp = await post('/api/elevar', { codigo: codigo.value.trim() });
            estado.elevadoAte = resp.elevadoAte;
            emitir('elevado', resp.elevadoAte);
            fechar(true);
          } catch (e) {
            erro.textContent = e.message;
            codigo.select();
            botao.disabled = false;
          }
        },
      },
      h('p', { class: 'muted pequeno', text: 'Digite o código do aplicativo autenticador. A confirmação vale por 10 minutos.' }),
      codigo, erro,
      h('div', { class: 'modal-acoes' }, h('button', { class: 'btn', type: 'button', onclick: () => fechar(false) }, 'Cancelar'), botao));
      codigo.addEventListener('input', () => { if (codigo.value.length === 6) form.requestSubmit(); });
      return form;
    },
  }).promessa;
  return !!r;
}

/**
 * Executa uma chamada que exige modo elevado, pedindo o código antes (e de novo se expirar no meio).
 * Devolve o resultado ou null se o usuário cancelou / deu erro (o erro já vira toast).
 */
export async function comElevacao(descricao, chamada) {
  if (!(await garantirElevado(descricao))) return null;
  try {
    return await chamada();
  } catch (e) {
    if (e.dados?.precisaElevar) {
      estado.elevadoAte = 0;
      if (await garantirElevado(descricao)) return comElevacao(descricao, chamada);
      return null;
    }
    toastErro(e);
    return null;
  }
}
