// Criar/editar grupo dinâmico: monta um filtro (SO, site/cliente, nome contém, tag, campo personalizado) e
// mostra, ao vivo, quantos e quais dispositivos batem — antes mesmo de salvar (POST /api/grupos/preview).
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { get, post, put } from '../../nucleo/api.js';
import { estado } from '../../nucleo/estado.js';
import { NOMES_SO, fmtInt } from '../../nucleo/formato.js';
import { gaveta, toast, toastErro } from '../../ui/camadas.js';
import { campo, select, input, botao, selo, check, vazio, comCarregando } from '../../ui/componentes.js';

export async function abrirGrupoModal({ grupo } = {}) {
  let campos = [];
  try { campos = await get('/api/campos'); } catch { /* segue sem campos personalizados */ }

  gaveta({
    titulo: grupo ? 'Editar grupo' : 'Novo grupo dinâmico',
    descricao: 'Um grupo é só um filtro: dispositivos que passam a bater com ele aparecem sozinhos, sem editar nada aqui.',
    conteudo: (fecharGaveta) => {
      const f = grupo?.filtro ?? {};
      const nome = input({ valor: grupo?.nome ?? '', attrs: { required: true, maxlength: 120 } });

      const checksSo = ['windows', 'linux', 'macos'].map((so) => ({ so, c: check(NOMES_SO[so], { marcado: f.so?.includes(so) }) }));

      const opcoesSites = estado.clientes.flatMap((c) => c.sites.map((x) => [`site:${x.id}`, `Site · ${c.nome} · ${x.nome}`]));
      const opcoesClientes = estado.clientes.map((c) => [`cliente:${c.id}`, `Cliente · ${c.nome}`]);
      const valorLocal = f.site_id ? `site:${f.site_id}` : f.cliente_id ? `cliente:${f.cliente_id}` : '';
      const selLocal = select([['', 'Qualquer site ou cliente'], ...opcoesClientes, ...opcoesSites], valorLocal);

      const nomeContem = input({ valor: f.nome_contem ?? '', placeholder: 'ex.: srv-, caixa, financeiro', attrs: { maxlength: 100 } });
      const tag = input({ valor: f.tag ?? '', placeholder: 'ex.: critico', attrs: { maxlength: 60, list: 'farol-tags-sugeridas' } });
      const listaTags = h('datalist', { id: 'farol-tags-sugeridas' });
      get('/api/tags').then((t) => preencher(listaTags, t.map((x) => h('option', { value: x })))).catch(() => {});

      const selCampo = select([['', 'Nenhum'], ...campos.map((c) => [String(c.id), c.nome])], f.campo?.campo_id ? String(f.campo.campo_id) : '');
      const selOperador = select([['igual', 'é igual a'], ['contem', 'contém']], f.campo?.operador ?? 'igual');
      const valorCampo = input({ valor: f.campo?.valor ?? '', attrs: { maxlength: 200 } });
      const areaCampo = h('div', { class: 'linha mt-2', hidden: !f.campo?.campo_id }, selOperador, valorCampo);
      selCampo.addEventListener('change', () => { areaCampo.hidden = !selCampo.value; aoMudar(); });

      const previa = h('div', {}, h('p', { class: 'sutil pequeno', text: 'Ajuste o filtro para ver quais dispositivos entram.' }));

      function montarFiltro() {
        const filtro = {};
        const sos = checksSo.filter((x) => x.c.input.checked).map((x) => x.so);
        if (sos.length) filtro.so = sos;
        if (selLocal.value) { const [tipo, id] = selLocal.value.split(':'); filtro[tipo === 'site' ? 'site_id' : 'cliente_id'] = Number(id); }
        if (nomeContem.value.trim()) filtro.nome_contem = nomeContem.value.trim();
        if (tag.value.trim()) filtro.tag = tag.value.trim();
        if (selCampo.value) filtro.campo = { campo_id: Number(selCampo.value), operador: selOperador.value, valor: valorCampo.value.trim() };
        return filtro;
      }

      const atualizarPrevia = debounce(async () => {
        let r;
        try { r = await post('/api/grupos/preview', { filtro: montarFiltro() }); } catch (e) { toastErro(e); return; }
        preencher(previa,
          h('div', { class: 'linha-entre' }, h('strong', { text: `${fmtInt(r.total)} dispositivo${r.total === 1 ? '' : 's'}` }), selo('ao vivo', 'marca', { icone: 'raio' })),
          r.agentes.length ? h('div', { class: 'chips mt-2' }, r.agentes.slice(0, 12).map((a) => selo(a.hostname, 'neutro')), r.total > 12 ? selo(`+${r.total - 12}`, 'neutro') : null)
            : vazio({ titulo: 'Nenhum dispositivo bate com este filtro', compacto: true, ilustracao: 'busca' }));
      }, 250);
      function aoMudar() { atualizarPrevia(); }
      [nomeContem, tag, valorCampo].forEach((el) => el.addEventListener('input', aoMudar));
      [selLocal, selOperador].forEach((el) => el.addEventListener('change', aoMudar));
      checksSo.forEach((x) => x.c.input.addEventListener('change', aoMudar));
      atualizarPrevia();

      const salvar = botao(grupo ? 'Salvar' : 'Criar grupo', { variante: 'primario', icone: 'check' });
      salvar.addEventListener('click', () => {
        if (!nome.value.trim()) { toast('Dê um nome ao grupo.', 'erro'); nome.focus(); return; }
        const corpo = { nome: nome.value.trim(), filtro: montarFiltro() };
        comCarregando(salvar, async () => {
          try {
            const r = grupo ? await put(`/api/grupos/${grupo.id}`, corpo) : await post('/api/grupos', corpo);
            fecharGaveta(r);
            toast(grupo ? 'Grupo atualizado.' : 'Grupo criado.', 'sucesso', { titulo: corpo.nome });
          } catch (e) { toastErro(e); }
        });
      });

      return [
        campo('Nome do grupo', nome, { obrigatorio: true }),
        h('h3', { text: 'Filtro' }),
        h('fieldset', { class: 'campo' }, h('legend', { class: 'rotulo', text: 'Sistema operacional' }), h('div', { class: 'linha gap-4' }, checksSo.map((x) => x.c.el))),
        campo('Site ou cliente', selLocal),
        campo('Nome do dispositivo contém', nomeContem),
        campo('Tem a tag', tag), listaTags,
        campos.length ? [campo('Campo personalizado', selCampo), areaCampo]
          : h('p', { class: 'sutil pequeno', text: 'Nenhum campo personalizado criado ainda (Configurações → Campos personalizados).' }),
        h('h3', { text: 'Prévia (ao vivo)' }), previa,
        h('div', { class: 'linha mt-2' }, salvar),
      ];
    },
  });
}
