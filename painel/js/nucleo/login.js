// Tela de login (e de criação do primeiro administrador, enquanto não houver usuários).
import { h } from './dom.js';
import { logo, icone } from './icones.js';
import { post } from './api.js';
import { campo, campoCodigo } from '../ui/componentes.js';

export function telaLogin(raiz, { precisaSetup, aoEntrar }) {
  const erro = h('p', { class: 'erro-campo', role: 'alert' });
  const usuario = h('input', { class: 'input', autocomplete: 'username', required: true, autofocus: true, maxlength: 64 });
  const senha = h('input', { class: 'input', type: 'password', autocomplete: precisaSetup ? 'new-password' : 'current-password', required: true, maxlength: 256 });
  const confirma = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', required: true, maxlength: 256 });
  const codigo = campoCodigo('codigo-login');
  const grupoCodigo = campo('Código do autenticador', codigo);
  grupoCodigo.hidden = true;
  const botao = h('button', { class: 'btn btn-primario btn-grande btn-largo', type: 'submit' },
    h('span', { text: precisaSetup ? 'Criar administrador' : 'Entrar' }), icone('seta'));

  const form = h('form', {
    class: 'form', novalidate: true,
    onsubmit: async (ev) => {
      ev.preventDefault();
      erro.textContent = '';
      if (precisaSetup && senha.value !== confirma.value) { erro.textContent = 'As senhas não conferem.'; return; }
      botao.classList.add('carregando');
      try {
        if (precisaSetup) await post('/api/setup', { usuario: usuario.value.trim(), senha: senha.value });
        else {
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
        botao.classList.remove('carregando');
      }
    },
  },
  campo('Usuário', usuario),
  campo('Senha', senha, { ajuda: precisaSetup ? 'Mínimo de 10 caracteres, com pelo menos 3 tipos: minúsculas, maiúsculas, números e símbolos.' : null }),
  precisaSetup ? campo('Confirme a senha', confirma) : null,
  grupoCodigo, erro, botao);
  codigo.addEventListener('input', () => { if (codigo.value.length === 6) form.requestSubmit(); });

  raiz.append(h('main', { class: 'tela-login' },
    h('div', { class: 'cartao-login' },
      h('div', { class: 'marca-login' }, logo(), h('span', { class: 'marca-texto' }, 'Farol')),
      h('h1', { text: precisaSetup ? 'Primeiro acesso' : 'Entrar no console' }),
      h('p', { text: precisaSetup ? 'Crie a conta de administrador. Depois, ative o 2FA em Minha conta.' : 'Monitoramento e gestão remota dos seus dispositivos.' }),
      form,
      h('p', { class: 'login-rodape', text: 'Conexão protegida · sessões auditadas' }))));
}
