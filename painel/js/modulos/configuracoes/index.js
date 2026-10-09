// Módulo Configurações: página com seções registráveis (farol.secaoConfig). Este módulo registra
// Minha conta (2FA e senha), Usuários e papéis, e Clientes e sites.
import { h, preencher, limpar } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { get, post, put, del } from '../../nucleo/api.js';
import { estado, pode, aoEvento } from '../../nucleo/estado.js';
import { registro, visiveis } from '../../nucleo/registro.js';
import { relativo, fmtInt, iniciais } from '../../nucleo/formato.js';
import { cabecalhoPagina, botao, campo, input, select, campoCodigo, aviso, selo, botaoCopiar, vazio, skeleton, cartao, comCarregando } from '../../ui/componentes.js';
import { modal, confirmar, toast, toastErro } from '../../ui/camadas.js';
import { comElevacao } from '../../ui/elevar.js';
import { abrirMenu } from '../../ui/flutuante.js';

const PAPEIS = { admin: 'Administrador', tecnico: 'Técnico', leitura: 'Somente leitura' };

function paginaConfig(raiz, { params }) {
  const secoes = visiveis(registro.secoesConfig);
  const atual = secoes.find((s) => s.id === params.secao) ?? secoes[0];
  const nav = h('nav', { class: 'cartao', 'aria-label': 'Seções', estilo: { overflow: 'hidden' } }, h('ul', { class: 'lista-linhas' }, secoes.map((s) => h('li', {},
    h('a', { class: 'linha-item', href: `#/configuracoes/${s.id}`, 'aria-current': s === atual ? 'page' : null, estilo: s === atual ? { background: 'var(--marca-lavagem)' } : {} },
      h('span', { class: 'paleta-icone', estilo: { display: 'grid', placeItems: 'center', width: '30px', height: '30px', borderRadius: '8px', background: s === atual ? 'var(--marca-lavagem-forte)' : 'var(--superficie-2)', color: s === atual ? 'var(--marca)' : 'var(--texto-2)' } }, icone(s.icone, { tamanho: 16 })),
      h('span', { class: 'linha-texto' }, h('span', { class: 'forte', text: s.rotulo }), s.descricao ? h('small', { text: s.descricao }) : null))))));
  const area = h('section', { class: 'pilha' });
  raiz.append(cabecalhoPagina({ titulo: 'Configurações', migalhas: [['Administração'], ['Configurações'], [atual?.rotulo ?? '']] }), h('div', { class: 'dividido' }, nav, area));
  if (!atual) { area.append(vazio({ titulo: 'Nenhuma seção disponível' })); return null; }
  area.append(h('div', {}, h('h2', { text: atual.rotulo }), atual.descricao ? h('p', { class: 'muted mt-1', text: atual.descricao }) : null));
  const corpo = h('div', {});
  area.append(corpo);
  return atual.render(corpo) || null;
}

// ------------------------------------------------------------------ Minha conta
function secaoConta(el) {
  const area2fa = h('div', {});
  const desenhar2fa = () => {
    limpar(area2fa);
    if (estado.totpAtivo) {
      area2fa.append(aviso(h('span', {}, h('strong', { text: '2FA ativo. ' }), 'Ações remotas pedem um código novo a cada 10 minutos.'), 'ok'));
      return;
    }
    const iniciar = botao('Configurar 2FA', { variante: 'primario', icone: 'chave' });
    area2fa.append(aviso('O 2FA é obrigatório para executar scripts, comandos e ações de energia nos dispositivos.', 'alerta'), h('div', { class: 'mt-3' }, iniciar));
    iniciar.addEventListener('click', () => comCarregando(iniciar, async () => {
      try {
        const r = await post('/api/2fa/iniciar');
        const codigo = campoCodigo();
        const erro = h('p', { class: 'erro-campo', role: 'alert' });
        const form = h('form', {
          class: 'form', onsubmit: async (ev) => {
            ev.preventDefault();
            erro.textContent = '';
            try {
              await post('/api/2fa/ativar', { codigo: codigo.value.trim() });
              estado.totpAtivo = true;
              toast('2FA ativado com sucesso.', 'sucesso');
              desenhar2fa();
            } catch (e) { erro.textContent = e.message; codigo.select(); }
          },
        },
        h('ol', { class: 'passos' },
          h('li', {}, 'Abra seu aplicativo autenticador (Google Authenticator, Aegis, 1Password, Bitwarden…).'),
          h('li', {}, 'Adicione uma conta manualmente com a chave abaixo (baseada em tempo) ou cole a URI otpauth.'),
          h('li', {}, 'Digite o código de 6 dígitos que aparecer.')),
        h('div', { class: 'campo' }, h('span', { class: 'rotulo', text: 'Chave secreta' }),
          h('div', { class: 'linha' }, h('code', { class: 'token-texto', text: r.segredo.match(/.{1,4}/g).join(' ') }), botaoCopiar(r.segredo, 'Copiar chave', { toast }))),
        h('div', { class: 'campo' }, h('span', { class: 'rotulo', text: 'URI otpauth' }),
          h('div', { class: 'linha' }, h('code', { class: 'token-texto pequeno', text: r.uri }), botaoCopiar(r.uri, 'Copiar URI', { toast }))),
        campo('Código', codigo), erro, h('div', {}, botao('Ativar 2FA', { variante: 'primario', tipo: 'submit' })));
        preencher(area2fa, form);
        codigo.focus();
      } catch (e) { toastErro(e); }
    }));
  };
  desenhar2fa();

  const atual = input({ tipo: 'password', attrs: { autocomplete: 'current-password', required: true } });
  const nova = input({ tipo: 'password', attrs: { autocomplete: 'new-password', required: true, minlength: 10 } });
  const salvarSenha = botao('Trocar senha', { tipo: 'submit' });
  const formSenha = h('form', {
    class: 'form', onsubmit: (ev) => {
      ev.preventDefault();
      comCarregando(salvarSenha, async () => {
        try { await post('/api/senha', { atual: atual.value, nova: nova.value }); atual.value = nova.value = ''; toast('Senha alterada. Suas outras sessões foram encerradas.', 'sucesso'); } catch (e) { toastErro(e); }
      });
    },
  }, h('div', { class: 'grade-2' }, campo('Senha atual', atual), campo('Nova senha', nova, { ajuda: 'Mínimo de 10 caracteres com 3 tipos (minúsculas, maiúsculas, números, símbolos).' })), h('div', {}, salvarSenha));

  el.append(h('div', { class: 'pilha' },
    cartao({ corpo: h('div', { class: 'linha gap-4' }, h('span', { class: 'avatar', estilo: { width: '48px', height: '48px', fontSize: '16px' }, text: iniciais(estado.nome || estado.usuario) }),
      h('div', {}, h('div', { class: 'forte', text: estado.nome || estado.usuario }), h('div', { class: 'sutil pequeno', text: `@${estado.usuario} · ${PAPEIS[estado.papel]}` }))) }),
    cartao({ titulo: 'Verificação em duas etapas (2FA)', corpo: area2fa }),
    cartao({ titulo: 'Senha', corpo: formSenha })));
}

// ------------------------------------------------------------------ Usuários
function secaoUsuarios(el) {
  const lista = h('div', {}, skeleton(5));
  const novo = botao('Novo usuário', { variante: 'primario', icone: 'mais', tamanho: 'pequeno', onclick: () => formUsuario() });
  el.append(cartao({ titulo: 'Usuários', sub: 'Papéis: Administrador (tudo), Técnico (opera dispositivos e scripts), Somente leitura.', acoes: [novo], semPadding: true, corpo: lista }));
  const carregar = async () => {
    try {
      const us = await get('/api/usuarios');
      preencher(lista, h('ul', { class: 'lista-linhas' }, us.map((u) => h('li', {},
        h('div', { class: 'linha-item' },
          h('span', { class: 'avatar', 'aria-hidden': 'true', text: iniciais(u.nome || u.usuario) }),
          h('div', { class: 'linha-texto' }, h('span', { class: 'forte', text: u.nome || u.usuario }),
            h('small', { text: `@${u.usuario} · ${u.ultimo_login ? `último acesso ${relativo(u.ultimo_login)}` : 'nunca entrou'}` })),
          h('span', { class: 'linha gap-1' }, selo(PAPEIS[u.papel], u.papel === 'admin' ? 'marca' : 'neutro'),
            u.totp_ativo ? selo('2FA', 'ok', { icone: 'check' }) : selo('sem 2FA', 'aviso'), u.ativo ? null : selo('Desativado', 'critico')),
          h('button', { class: 'btn-icone pequeno', 'aria-label': `Ações de ${u.usuario}`, onclick: (ev) => abrirMenu(ev.currentTarget, [
            ...Object.entries(PAPEIS).map(([p, r]) => ({ rotulo: `Papel: ${r}`, marcado: u.papel === p, onclick: () => alterar(u, { papel: p }) })), '-',
            { rotulo: 'Redefinir 2FA', icone: 'chave', onclick: () => alterar(u, { redefinir2fa: true }, 'O usuário precisará configurar o 2FA de novo.') },
            { rotulo: u.ativo ? 'Desativar' : 'Reativar', icone: u.ativo ? 'revogar' : 'check', perigo: u.ativo, onclick: () => alterar(u, { ativo: !u.ativo }) },
            u.usuario !== estado.usuario ? { rotulo: 'Excluir', icone: 'lixo', perigo: true, onclick: () => excluir(u) } : null,
          ].filter(Boolean), { alinhar: 'fim' }) }, icone('reticencias')))))));
    } catch (e) { toastErro(e); }
  };
  const alterar = async (u, corpo, aviso2) => {
    if (aviso2 && !(await confirmar({ titulo: `Alterar ${u.usuario}`, mensagem: aviso2, rotulo: 'Confirmar' }))) return;
    const r = await comElevacao(`Alterar o usuário ${u.usuario}.`, () => put(`/api/usuarios/${u.id}`, corpo));
    if (r) { toast('Usuário atualizado.', 'sucesso'); carregar(); }
  };
  const excluir = async (u) => {
    if (!(await confirmar({ titulo: `Excluir ${u.usuario}?`, mensagem: 'A conta é removida e as sessões encerradas. O histórico de auditoria é mantido.', rotulo: 'Excluir', perigo: true }))) return;
    const r = await comElevacao(`Excluir o usuário ${u.usuario}.`, () => del(`/api/usuarios/${u.id}`));
    if (r) { toast('Usuário excluído.', 'sucesso'); carregar(); }
  };
  const formUsuario = () => modal({
    titulo: 'Novo usuário', icone: 'usuarios', largura: 'sm',
    conteudo: (fechar) => {
      const nome = input({ placeholder: 'Nome completo' });
      const usuario = input({ attrs: { autocomplete: 'off', required: true, pattern: '[A-Za-z0-9._@-]{3,64}' } });
      const senha = input({ tipo: 'password', attrs: { autocomplete: 'new-password', required: true, minlength: 10 } });
      const papel = select(Object.entries(PAPEIS), 'tecnico');
      const criar = botao('Criar usuário', { variante: 'primario', tipo: 'submit' });
      return h('form', {
        class: 'form', onsubmit: (ev) => {
          ev.preventDefault();
          comCarregando(criar, async () => {
            const r = await comElevacao('Criar um usuário.', () => post('/api/usuarios', { usuario: usuario.value.trim(), senha: senha.value, papel: papel.value, ...(nome.value.trim() ? { nome: nome.value.trim() } : {}) }));
            if (r) { toast('Usuário criado. Peça para ativar o 2FA no primeiro acesso.', 'sucesso'); fechar(); carregar(); }
          });
        },
      }, campo('Nome', nome), campo('Usuário', usuario, { obrigatorio: true }), campo('Senha inicial', senha, { obrigatorio: true, ajuda: 'Mínimo de 10 caracteres com 3 tipos.' }), campo('Papel', papel),
      h('div', { class: 'modal-acoes' }, h('button', { class: 'btn', type: 'button', onclick: () => fechar() }, 'Cancelar'), criar));
    },
  });
  carregar();
}

// ------------------------------------------------------------------ Clientes e sites
function secaoOrganizacao(el) {
  const lista = h('div', { class: 'pilha' }, skeleton(5));
  const podeGerenciar = pode('organizacao.gerenciar');
  el.append(h('div', { class: 'linha-entre mb-4' }, h('p', { class: 'muted pequeno', text: 'Todo dispositivo pertence a um site; sites pertencem a clientes. O seletor no topo filtra o console inteiro.' }),
    podeGerenciar ? botao('Novo cliente', { variante: 'primario', icone: 'mais', tamanho: 'pequeno', onclick: () => pedirNome('Novo cliente', '', (nome) => post('/api/clientes', { nome })) }) : null), lista);
  const pedirNome = (titulo, valor, salvar) => modal({
    titulo, largura: 'sm', icone: 'predio',
    conteudo: (fechar) => {
      const nome = input({ valor, attrs: { required: true, maxlength: 120 } });
      return h('form', { class: 'form', onsubmit: async (ev) => { ev.preventDefault(); try { await salvar(nome.value.trim()); fechar(); toast('Salvo.', 'sucesso'); } catch (e) { toastErro(e); } } },
        campo('Nome', nome), h('div', { class: 'modal-acoes' }, h('button', { class: 'btn', type: 'button', onclick: () => fechar() }, 'Cancelar'), botao('Salvar', { variante: 'primario', tipo: 'submit' })));
    },
  });
  const desenhar = async () => {
    try {
      const clientes = await get('/api/clientes');
      estado.clientes = clientes;
      preencher(lista, clientes.map((c) => cartao({
        titulo: c.nome, sub: `${c.sites.length} site(s) · ${fmtInt(c.dispositivos)} dispositivo(s)`, semPadding: true,
        acoes: podeGerenciar ? [botao('Novo site', { tamanho: 'pequeno', icone: 'mais', onclick: () => pedirNome(`Novo site em ${c.nome}`, '', (nome) => post('/api/sites', { cliente_id: c.id, nome })) }),
          h('button', { class: 'btn-icone pequeno', 'aria-label': `Ações de ${c.nome}`, onclick: (ev) => abrirMenu(ev.currentTarget, [
            { rotulo: 'Renomear', icone: 'editar', onclick: () => pedirNome('Renomear cliente', c.nome, (nome) => put(`/api/clientes/${c.id}`, { nome })) },
            { rotulo: 'Excluir', icone: 'lixo', perigo: true, onclick: async () => { if (await confirmar({ titulo: `Excluir ${c.nome}?`, mensagem: 'Só é possível excluir clientes sem dispositivos.', rotulo: 'Excluir', perigo: true })) { try { await del(`/api/clientes/${c.id}`); toast('Cliente excluído.', 'sucesso'); } catch (e) { toastErro(e); } } } },
          ], { alinhar: 'fim' }) }, icone('reticencias'))] : null,
        corpo: h('ul', { class: 'lista-linhas' }, c.sites.map((s) => h('li', {}, h('div', { class: 'linha-item' }, icone('site', { tamanho: 16 }),
          h('div', { class: 'linha-texto' }, h('span', { class: 'forte', text: s.nome }), h('small', { text: `${fmtInt(s.dispositivos)} dispositivo(s) · ${fmtInt(s.online)} online` })),
          podeGerenciar ? h('span', { class: 'linha gap-1' },
            h('button', { class: 'btn-icone pequeno', 'aria-label': `Renomear ${s.nome}`, 'data-dica': 'Renomear', onclick: () => pedirNome('Renomear site', s.nome, (nome) => put(`/api/sites/${s.id}`, { nome })) }, icone('editar')),
            h('button', { class: 'btn-icone pequeno', 'aria-label': `Excluir ${s.nome}`, 'data-dica': 'Excluir', onclick: async () => { if (await confirmar({ titulo: `Excluir o site ${s.nome}?`, mensagem: 'Só é possível excluir sites sem dispositivos.', rotulo: 'Excluir', perigo: true })) { try { await del(`/api/sites/${s.id}`); toast('Site excluído.', 'sucesso'); } catch (e) { toastErro(e); } } } }, icone('lixo'))) : null)))),
      })));
    } catch (e) { toastErro(e); }
  };
  desenhar();
  return aoEvento('organizacao', desenhar);
}

export default {
  nome: 'configuracoes',
  iniciar(farol) {
    farol.menu({ id: 'configuracoes', rotulo: 'Configurações', icone: 'config', secao: 'Administração', ordem: 90, href: '#/configuracoes' });
    farol.rota('/configuracoes', { titulo: 'Configurações', render: paginaConfig });
    farol.rota('/configuracoes/:secao', { titulo: 'Configurações', menu: 'configuracoes', render: paginaConfig });
    farol.secaoConfig({ id: 'conta', rotulo: 'Minha conta', descricao: 'Perfil, 2FA e senha', icone: 'usuario', ordem: 10, render: secaoConta });
    farol.secaoConfig({ id: 'usuarios', rotulo: 'Usuários e papéis', descricao: 'Quem acessa o console e o que pode fazer', icone: 'usuarios', ordem: 20, permissao: 'usuarios.gerenciar', render: secaoUsuarios });
    farol.secaoConfig({ id: 'organizacao', rotulo: 'Clientes e sites', descricao: 'Estrutura multi-cliente', icone: 'predio', ordem: 30, permissao: 'organizacao.ver', render: secaoOrganizacao });
    farol.comando({ id: 'ativar-2fa', rotulo: 'Minha conta e 2FA', icone: 'chave', palavras: 'senha autenticador totp', executar: () => { location.hash = '#/configuracoes/conta'; } });
  },
};
