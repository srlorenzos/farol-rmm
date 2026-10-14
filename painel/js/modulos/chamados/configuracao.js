// Configurações > Bandeja do agente: só os campos que servidor/src/modulos/chamados/index.js realmente
// expõe em configBandeja()/PUT /api/config/bandeja — empresa, cor, ícone, contato e recursos ligados/desligados.
import { h, preencher } from '../../nucleo/dom.js';
import { get, put } from '../../nucleo/api.js';
import { pode } from '../../nucleo/estado.js';
import { campo, input, botao, interruptor, aviso, comCarregando, skeleton } from '../../ui/componentes.js';
import { toast, toastErro } from '../../ui/camadas.js';

const MAX_ICONE_BYTES = 150_000; // folga sob o limite de 200_000 caracteres em base64 do schema do servidor

function lerArquivoComoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
    r.readAsDataURL(arquivo);
  });
}

export function secaoBandeja(el) {
  el.append(skeleton(6));
  get('/api/config/bandeja').then((cfg) => {
    const podeEditar = pode('chamados.configurar');
    let iconeBase64 = cfg.icone_base64 || null;

    const empresa = input({ valor: cfg.empresa || '', attrs: { maxlength: 120, disabled: !podeEditar } });
    const cor = input({ tipo: 'color', valor: /^#[0-9a-fA-F]{6}$/.test(cfg.cor) ? cfg.cor : '#2563eb', classe: 'input-curto', attrs: { disabled: !podeEditar } });
    const telefone = input({ valor: cfg.contato?.telefone || '', attrs: { maxlength: 40, disabled: !podeEditar } });
    const email = input({ tipo: 'email', valor: cfg.contato?.email || '', attrs: { maxlength: 150, disabled: !podeEditar } });
    const site = input({ valor: cfg.contato?.site || '', attrs: { maxlength: 200, disabled: !podeEditar, placeholder: 'https://…' } });

    const swChamados = interruptor('Chamados de suporte (abas "Chamados" e "Novo chamado")', { marcado: cfg.recursos?.chamados !== false });
    const swPrint = interruptor('Anexar print da tela ao abrir um chamado', { marcado: cfg.recursos?.print !== false });
    const swAcoes = interruptor('Ações rápidas (reiniciar o agente, copiar dados do sistema)', { marcado: cfg.recursos?.acoesRapidas !== false });
    for (const sw of [swChamados, swPrint, swAcoes]) sw.input.disabled = !podeEditar;

    const previewIcone = h('div', {});
    const desenharPreview = () => preencher(previewIcone, iconeBase64
      ? h('div', { class: 'linha gap-2' }, h('img', { src: `data:image/png;base64,${iconeBase64}`, alt: 'Ícone da bandeja', estilo: { width: '40px', height: '40px', borderRadius: 'var(--raio-2)', objectFit: 'contain', background: '#fff' } }),
        podeEditar ? botao('Remover', { tamanho: 'pequeno', onclick: () => { iconeBase64 = null; desenharPreview(); } }) : null)
      : h('span', { class: 'sutil pequeno', text: 'Sem ícone personalizado — usa o farol padrão.' }));
    desenharPreview();
    const arquivoIcone = h('input', { type: 'file', accept: 'image/png,image/jpeg', disabled: !podeEditar, onchange: async (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      if (f.size > MAX_ICONE_BYTES) { toastErro(new Error(`Imagem grande demais (máx. ${Math.round(MAX_ICONE_BYTES / 1024)} KB).`)); ev.target.value = ''; return; }
      try { iconeBase64 = await lerArquivoComoBase64(f); desenharPreview(); } catch (e) { toastErro(e); }
      ev.target.value = '';
    } });

    const salvar = botao('Salvar', { variante: 'primario', icone: 'check', tipo: 'submit', desabilitado: !podeEditar });
    const form = h('form', {
      class: 'pilha', onsubmit: (ev) => {
        ev.preventDefault();
        comCarregando(salvar, async () => {
          try {
            const novo = await put('/api/config/bandeja', {
              empresa: empresa.value.trim() || 'Farol', cor: cor.value, icone_base64: iconeBase64,
              contato: { telefone: telefone.value.trim(), email: email.value.trim(), site: site.value.trim() },
              recursos: { chamados: swChamados.input.checked, print: swPrint.input.checked, acoesRapidas: swAcoes.input.checked },
            });
            cfg.cor = novo.cor;
            toast('Configuração da bandeja salva.', 'sucesso');
          } catch (e) { toastErro(e); }
        });
      },
    },
    podeEditar ? null : aviso('Somente administradores alteram a bandeja do agente.', 'info'),
    h('div', { class: 'cartao', estilo: { padding: '16px' } },
      h('h3', { text: 'Marca' }),
      h('p', { class: 'sutil pequeno mt-1 mb-3', text: 'Mostrada no título da janela da bandeja e nas mensagens do usuário final.' }),
      h('div', { class: 'grade-2' },
        campo('Nome da empresa', empresa), campo('Cor da marca', cor)),
      h('div', { class: 'campo mt-3' }, h('span', { class: 'rotulo', text: 'Ícone (opcional, PNG/JPEG pequeno)' }), arquivoIcone, h('div', { class: 'mt-2' }, previewIcone))),
    h('div', { class: 'cartao', estilo: { padding: '16px' } },
      h('h3', { text: 'Contato do suporte' }),
      h('p', { class: 'sutil pequeno mt-1 mb-3', text: 'Aparece no botão "Contato do suporte" da bandeja, quando algum campo estiver preenchido.' }),
      h('div', { class: 'grade-3' }, campo('Telefone', telefone), campo('E-mail', email), campo('Site', site))),
    h('div', { class: 'cartao', estilo: { padding: '16px' } },
      h('h3', { text: 'Recursos da bandeja' }),
      h('p', { class: 'sutil pequeno mt-1 mb-3', text: 'Desligue o que não quiser oferecer ao usuário final nesta instalação.' }),
      h('div', { class: 'pilha-2' }, swChamados.el, swPrint.el, swAcoes.el)),
    h('div', { class: 'linha' }, salvar));
    preencher(el, form);
  }).catch(toastErro);
}
