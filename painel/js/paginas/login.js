// Tela de login (e de criação do primeiro administrador, se ainda não houver usuários).
import { h, icone } from '../util.js';
import { post } from '../api.js';
import { campoCodigo } from '../ui.js';

export function telaLogin(raiz, { precisaSetup, aoEntrar }) {
  const erro = h('p', { class: 'erro-campo', role: 'alert' });
  const usuario = h('input', { id: 'usuario', class: 'input', autocomplete: 'username', required: true, autofocus: true, maxlength: 64 });
  const senha = h('input', { id: 'senha', class: 'input', type: 'password', autocomplete: precisaSetup ? 'new-password' : 'current-password', required: true, maxlength: 256 });
  const confirma = h('input', { id: 'senha2', class: 'input', type: 'password', autocomplete: 'new-password', required: true, maxlength: 256 });
  const codigo = campoCodigo('codigo-login');
  const grupoCodigo = h('div', { class: 'campo', hidden: true },
    h('label', { for: 'codigo-login', class: 'rotulo' }, 'Código do autenticador'), codigo);
  const botao = h('button', { class: 'btn btn-primario btn-largo', type: 'submit' }, precisaSetup ? 'Criar administrador' : 'Entrar');

  const form = h('form', {
    class: 'form', novalidate: true,
    onsubmit: async (ev) => {
      ev.preventDefault();
      erro.textContent = '';
      if (precisaSetup && senha.value !== confirma.value) { erro.textContent = 'As senhas não conferem.'; return; }
      botao.disabled = true;
      try {
        if (precisaSetup) {
          await post('/api/setup', { usuario: usuario.value.trim(), senha: senha.value });
        } else {
          const corpo = { usuario: usuario.value.trim(), senha: senha.value };
          if (!grupoCodigo.hidden && codigo.value) corpo.codigo = codigo.value.trim();
          await post('/api/login', corpo);
        }
        await aoEntrar();
      } catch (e) {
        if (e.dados?.precisa2fa) {
          grupoCodigo.hidden = false;
          if (codigo.value) erro.textContent = e.message;
          codigo.value = '';
          codigo.focus();
        } else {
          erro.textContent = e.dados?.detalhes ? `${e.message}: verifique os campos.` : e.message;
        }
      } finally {
        botao.disabled = false;
      }
    },
  },
  h('div', { class: 'campo' }, h('label', { for: 'usuario', class: 'rotulo' }, 'Usuário'), usuario),
  h('div', { class: 'campo' }, h('label', { for: 'senha', class: 'rotulo' }, 'Senha'), senha,
    precisaSetup ? h('p', { class: 'ajuda' }, 'Mínimo de 10 caracteres, com pelo menos 3 tipos: minúsculas, maiúsculas, números e símbolos.') : null),
  precisaSetup ? h('div', { class: 'campo' }, h('label', { for: 'senha2', class: 'rotulo' }, 'Confirme a senha'), confirma) : null,
  grupoCodigo, erro, botao);

  codigo.addEventListener('input', () => {
    codigo.value = codigo.value.replace(/\D/g, '').slice(0, 6);
    if (codigo.value.length === 6) form.requestSubmit();
  });

  raiz.append(h('main', { class: 'tela-login' },
    h('div', { class: 'cartao-login' },
      h('div', { class: 'marca marca-grande' }, logo(), h('span', {}, 'Farol', h('b', {}, ' RMM'))),
      h('h1', { text: precisaSetup ? 'Primeiro acesso' : 'Entrar no painel' }),
      h('p', { class: 'muted', text: precisaSetup
        ? 'Crie a conta de administrador. Depois, ative o 2FA em Configurações.'
        : 'Monitoramento e gestão remota dos seus computadores.' }),
      form)));
}

export function logo() {
  return h('span', { class: 'logo', 'aria-hidden': 'true' }, icone('farol', { tamanho: 22 }));
}
