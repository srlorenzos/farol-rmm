// Configurações: conta (2FA, senha), regras de alerta e webhook.
import { h, icone, preencher } from '../util.js';
import { get, post, put } from '../api.js';
import { cabecalhoPagina, skeleton, toastErro, toast, campoCodigo, botaoCopiar } from '../ui.js';
import { estado } from '../estado.js';

export function render(raiz) {
  const conta = h('section', { class: 'painel-bloco' });
  const regras = h('section', { class: 'painel-bloco' }, skeleton(6));
  raiz.append(cabecalhoPagina('Configurações'), h('div', { class: 'grade-2 grade-config' }, conta, regras));
  desenharConta(conta);
  desenharRegras(regras);
}

function desenharConta(el) {
  preencher(el, h('h2', { text: 'Sua conta' }), h('p', { class: 'muted' }, 'Conectado como ', h('strong', { text: estado.usuario })));
  const area2fa = h('div', { class: 'bloco-2fa' });
  el.append(h('h3', { text: 'Verificação em duas etapas (2FA)' }), area2fa, h('h3', { text: 'Trocar senha' }), formSenha());

  if (estado.totpAtivo) {
    area2fa.append(h('p', { class: 'aviso-sucesso' }, icone('check'), h('span', {}, '2FA ativo. Execuções de scripts pedem um código novo a cada 10 minutos.')));
    return;
  }
  const iniciar = h('button', { class: 'btn btn-primario', type: 'button' }, icone('chave', { tamanho: 14 }), 'Configurar 2FA');
  area2fa.append(
    h('p', { class: 'aviso' }, icone('aviso'), h('span', {}, 'O 2FA é obrigatório para executar scripts e comandos nos agentes.')),
    iniciar);
  iniciar.addEventListener('click', async () => {
    iniciar.disabled = true;
    try {
      const r = await post('/api/2fa/iniciar');
      const codigo = campoCodigo('codigo-ativar');
      const erro = h('p', { class: 'erro-campo', role: 'alert' });
      const segredoFmt = r.segredo.match(/.{1,4}/g).join(' ');
      const form = h('form', {
        class: 'form', onsubmit: async (ev) => {
          ev.preventDefault();
          erro.textContent = '';
          try {
            await post('/api/2fa/ativar', { codigo: codigo.value.trim() });
            estado.totpAtivo = true;
            toast('2FA ativado com sucesso.', 'sucesso');
            desenharConta(el);
          } catch (e) { erro.textContent = e.message; codigo.select(); }
        },
      },
      h('ol', { class: 'passos' },
        h('li', {}, 'Abra seu aplicativo autenticador (Google Authenticator, Aegis, 1Password, Bitwarden…).'),
        h('li', {}, 'Adicione uma conta manualmente com a chave abaixo (tipo: baseada em tempo) ou cole a URI otpauth.'),
        h('li', {}, 'Digite o código de 6 dígitos que aparecer.')),
      h('div', { class: 'campo' }, h('span', { class: 'rotulo' }, 'Chave secreta'),
        h('div', { class: 'linha-entre' }, h('code', { class: 'token-texto', text: segredoFmt }), botaoCopiar(r.segredo, 'Copiar chave'))),
      h('div', { class: 'campo' }, h('span', { class: 'rotulo' }, 'URI otpauth'),
        h('div', { class: 'linha-entre' }, h('code', { class: 'token-texto quebra pequeno', text: r.uri }), botaoCopiar(r.uri, 'Copiar URI'))),
      h('div', { class: 'campo' }, h('label', { for: 'codigo-ativar', class: 'rotulo' }, 'Código'), codigo), erro,
      h('button', { class: 'btn btn-primario', type: 'submit' }, 'Ativar 2FA'));
      preencher(area2fa, form);
      codigo.focus();
    } catch (e) { toastErro(e); iniciar.disabled = false; }
  });
}

function formSenha() {
  const atual = h('input', { id: 'senha-atual', class: 'input', type: 'password', autocomplete: 'current-password', required: true });
  const nova = h('input', { id: 'senha-nova', class: 'input', type: 'password', autocomplete: 'new-password', required: true, minlength: 10 });
  const erro = h('p', { class: 'erro-campo', role: 'alert' });
  return h('form', {
    class: 'form', onsubmit: async (ev) => {
      ev.preventDefault();
      erro.textContent = '';
      try {
        await post('/api/senha', { atual: atual.value, nova: nova.value });
        atual.value = nova.value = '';
        toast('Senha alterada. Outras sessões foram encerradas.', 'sucesso');
      } catch (e) { erro.textContent = e.dados?.detalhes ? 'A nova senha precisa de pelo menos 10 caracteres.' : e.message; }
    },
  },
  h('div', { class: 'campo' }, h('label', { for: 'senha-atual', class: 'rotulo' }, 'Senha atual'), atual),
  h('div', { class: 'campo' }, h('label', { for: 'senha-nova', class: 'rotulo' }, 'Nova senha'), nova,
    h('p', { class: 'ajuda' }, 'Mínimo de 10 caracteres com 3 tipos (minúsculas, maiúsculas, números, símbolos).')),
  erro, h('button', { class: 'btn', type: 'submit' }, 'Trocar senha'));
}

async function desenharRegras(el) {
  let cfg;
  try { cfg = await get('/api/config'); } catch (e) { toastErro(e); return; }
  const r = cfg.regras;
  const campos = {};
  const linhaRegra = (chave, titulo, descricao, extras) => {
    const ativo = h('input', { type: 'checkbox', id: `r-${chave}`, checked: r[chave].ativo });
    campos[chave] = { ativo };
    const grupo = h('fieldset', { class: 'regra' },
      h('legend', {}, h('label', { class: 'interruptor', for: `r-${chave}` }, ativo, h('span', { class: 'interruptor-trilho', 'aria-hidden': 'true' }), titulo)),
      h('p', { class: 'muted pequeno', text: descricao }),
      h('div', { class: 'regra-campos' }, extras.map(([k, rotulo, min, max, sufixo]) => {
        const input = h('input', { id: `r-${chave}-${k}`, class: 'input input-curto', type: 'number', min, max, required: true, value: r[chave][k] });
        campos[chave][k] = input;
        return h('label', { class: 'campo-inline', for: `r-${chave}-${k}` }, rotulo, input, sufixo);
      })));
    return grupo;
  };
  const webhook = h('input', { id: 'webhook', class: 'input', type: 'url', maxlength: 500, placeholder: 'https://discord.com/api/webhooks/…', value: cfg.webhook_url || '' });
  const salvar = h('button', { class: 'btn btn-primario', type: 'submit' }, icone('check', { tamanho: 14 }), 'Salvar regras');
  const form = h('form', {
    class: 'form', onsubmit: async (ev) => {
      ev.preventDefault();
      const ler = (k, n) => Number(campos[k][n].value);
      const corpo = {
        regras: {
          cpu: { ativo: campos.cpu.ativo.checked, limite: ler('cpu', 'limite'), ciclos: ler('cpu', 'ciclos') },
          ram: { ativo: campos.ram.ativo.checked, limite: ler('ram', 'limite'), ciclos: ler('ram', 'ciclos') },
          disco: { ativo: campos.disco.ativo.checked, limite: ler('disco', 'limite') },
          offline: { ativo: campos.offline.ativo.checked, minutos: ler('offline', 'minutos') },
        },
        webhook_url: webhook.value.trim(),
      };
      salvar.disabled = true;
      try { await put('/api/config', corpo); toast('Regras salvas.', 'sucesso'); } catch (e) { toastErro(e); } finally { salvar.disabled = false; }
    },
  },
  linhaRegra('cpu', 'CPU alta', 'Abre quando a CPU passa do limite por vários check-ins seguidos (cada check-in ≈ 15 s).',
    [['limite', 'Acima de', 1, 100, '%'], ['ciclos', 'por', 1, 100, 'check-ins']]),
  linhaRegra('ram', 'Memória alta', 'Uso de RAM acima do limite por vários check-ins seguidos.',
    [['limite', 'Acima de', 1, 100, '%'], ['ciclos', 'por', 1, 100, 'check-ins']]),
  linhaRegra('disco', 'Disco cheio', 'Qualquer partição acima do limite.', [['limite', 'Acima de', 1, 100, '%']]),
  linhaRegra('offline', 'Agente offline', 'Sem check-in pelo tempo definido. O agente aparece como offline após 60 s.',
    [['minutos', 'Por mais de', 1, 10080, 'min']]),
  h('fieldset', { class: 'regra' }, h('legend', {}, 'Webhook'),
    h('p', { class: 'muted pequeno', text: 'POST JSON quando um alerta abre. Compatível com Discord (content), Slack (text) e ntfy.' }),
    h('div', { class: 'linha-entre' }, webhook,
      h('button', {
        class: 'btn', type: 'button', onclick: async () => {
          try { await put('/api/config', { regras: (await get('/api/config')).regras, webhook_url: webhook.value.trim() }); await post('/api/config/webhook-teste'); toast('Webhook respondeu com sucesso.', 'sucesso'); } catch (e) { toastErro(e); }
        },
      }, 'Testar'))),
  salvar);
  preencher(el, h('h2', { text: 'Regras de alerta' }), form);
}
