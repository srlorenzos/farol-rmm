// Módulo Licença (painel): Configurações → Licença (colar a chave, plano, uso, validade) e um aviso discreto
// na visão geral quando o plano grátis está perto do limite ou a licença está para vencer.
import { h, preencher, limpar } from '../../nucleo/dom.js';
import { get, put, del } from '../../nucleo/api.js';
import { pode, aoEvento } from '../../nucleo/estado.js';
import { fmtData, fmtInt } from '../../nucleo/formato.js';
import { botao, campo, aviso, selo, medidor, skeleton, cartao } from '../../ui/componentes.js';
import { toast, toastErro, confirmar } from '../../ui/camadas.js';

const PLANOS = { gratis: 'Grátis', profissional: 'Profissional', msp: 'MSP', dono: 'Proprietário' };
const plano = (p) => PLANOS[p] ?? p;

/** Texto de aviso (ou null) para o estado devolvido por GET /api/licenca. */
function avisoDe(e) {
  if (e.invalida) return { tom: 'critico', texto: `A chave instalada não é válida: ${e.invalida}` };
  if (e.estado === 'carencia') return { tom: 'alerta', texto: `Licença vencida. Você está na carência de ${e.carencia_dias} dias (restam ${e.carencia_restante}); renove para não voltar ao limite de ${e.limite_gratis} dispositivos.` };
  if (e.estado === 'expirada') return { tom: 'critico', texto: `Licença vencida e fora da carência: o limite voltou a ser de ${e.limite_gratis} dispositivos. Os já registrados continuam funcionando, mas novos registros são recusados acima disso.` };
  if (e.estado === 'ativa' && e.aviso_expiracao) return { tom: 'alerta', texto: `A licença vence em ${e.dias_restantes} ${e.dias_restantes === 1 ? 'dia' : 'dias'} (${fmtData(e.expira_em)}).` };
  if (e.perto_do_limite && !e.ilimitado) return { tom: 'info', texto: `${e.usados} de ${e.limite} dispositivos em uso. Ao atingir o limite, novos dispositivos não conseguem se registrar.` };
  return null;
}

function secaoLicenca(el) {
  const corpo = h('div', { class: 'pilha' });
  el.append(corpo);
  let vivo = true;

  const linha = (rotulo, valor) => h('div', { class: 'linha-entre', estilo: { padding: '8px 0', borderBottom: '1px solid var(--borda)' } },
    h('span', { class: 'sutil', text: rotulo }), h('span', { class: 'forte', text: valor }));

  async function carregar() {
    let e;
    try { e = await get('/api/licenca'); } catch (err) { preencher(corpo, aviso(err.message, 'critico')); return; }
    if (!vivo) return;
    const a = avisoDe(e);
    const situacao = { gratis: ['Grátis', 'neutro'], ativa: ['Ativa', 'ok'], carencia: ['Em carência', 'aviso'], expirada: ['Expirada', 'critico'] }[e.estado];
    const uso = e.ilimitado ? null : (e.limite ? Math.min(100, (e.usados / e.limite) * 100) : 0);

    const resumo = cartao({
      titulo: `Plano ${plano(e.plano)}`,
      sub: e.cliente ? `Licenciado para ${e.cliente}` : `Sem chave instalada: até ${e.limite_gratis} dispositivos, sem validade.`,
      acoes: [selo(situacao[0], situacao[1])],
      corpo: h('div', {},
        linha('Dispositivos em uso', e.ilimitado ? `${fmtInt(e.usados)} (ilimitado)` : `${fmtInt(e.usados)} de ${fmtInt(e.limite)}`),
        uso != null ? h('div', { class: 'mt-2' }, medidor(uso, 'Uso de dispositivos')) : null,
        linha('Validade', e.expira_em ? `${fmtData(e.expira_em)}${e.estado === 'ativa' && e.dias_restantes != null ? ` · ${e.dias_restantes} d` : ''}` : (e.estado === 'gratis' ? '—' : 'Sem validade')),
        e.id ? linha('Código da licença', e.id.slice(0, 8)) : null),
    });

    const area = h('textarea', { class: 'input', rows: 4, spellcheck: 'false', placeholder: 'FAROL-…', 'aria-label': 'Chave de licença', estilo: { fontFamily: 'var(--fonte-mono, monospace)', width: '100%' } });
    const campoChave = campo('Chave de licença', area, { ajuda: 'Cole a chave recebida por e-mail ou na página de sucesso da compra. A validação é feita aqui, offline.' });
    const instalar = botao('Instalar chave', { icone: 'chave', variante: 'primario' });
    instalar.addEventListener('click', async () => {
      campoChave.definirErro('');
      if (!area.value.trim()) { campoChave.definirErro('Cole a chave.'); return; }
      instalar.disabled = true;
      try { await put('/api/licenca', { chave: area.value }); toast('Licença instalada.', 'sucesso'); area.value = ''; await carregar(); }
      catch (err) { campoChave.definirErro(err.message); }
      finally { instalar.disabled = false; }
    });
    const remover = e.cliente ? botao('Remover licença', { icone: 'lixo', variante: 'fantasma', onclick: async () => {
      if (!(await confirmar({ titulo: 'Remover a licença?', mensagem: `O servidor volta ao plano grátis (${e.limite_gratis} dispositivos). Dispositivos já registrados continuam funcionando.`, rotulo: 'Remover', perigo: true }))) return;
      try { await del('/api/licenca'); toast('Licença removida.'); await carregar(); } catch (err) { toastErro(err); }
    } }) : null;

    preencher(corpo,
      a ? aviso(a.texto, a.tom) : null,
      resumo,
      pode('licenca.gerenciar')
        ? cartao({ titulo: e.cliente ? 'Trocar a chave' : 'Ativar uma licença', corpo: h('div', { class: 'pilha' }, campoChave, h('div', { class: 'linha' }, instalar, remover)) })
        : aviso('Só administradores podem instalar ou remover a licença.', 'info'),
      h('p', { class: 'sutil pequeno' }, 'Precisa de mais dispositivos? Veja os planos no site do Farol RMM (https://farol-rmm.vercel.app/#precos).'));
  }
  preencher(corpo, skeleton(4));
  carregar();
  const cancelar = aoEvento('licenca', carregar);
  const cancelar2 = aoEvento('agente', carregar);
  return () => { vivo = false; cancelar?.(); cancelar2?.(); };
}

function widgetAviso(el) {
  el.style.cssText = 'display:none;background:none;border:none;box-shadow:none;min-height:0;padding:0';
  const desenhar = async () => {
    let e;
    try { e = await get('/api/licenca'); } catch { return; }
    const a = avisoDe(e);
    if (!a) { el.style.display = 'none'; limpar(el); return; }
    el.style.display = 'block';
    preencher(el, aviso(h('span', {}, a.texto, ' ', h('a', { href: '#/configuracoes/licenca', text: 'Ver licença' })), a.tom));
  };
  desenhar();
  const c1 = aoEvento('licenca', desenhar);
  const c2 = aoEvento('agente', desenhar);
  return () => { c1?.(); c2?.(); };
}

export default {
  nome: 'licenca',
  iniciar(farol) {
    farol.secaoConfig({ id: 'licenca', rotulo: 'Licença', descricao: 'Plano, uso de dispositivos e validade', icone: 'chave', ordem: 90, permissao: 'licenca.ver', render: secaoLicenca });
    farol.widget({ id: 'licenca-aviso', titulo: 'Licença', tamanho: 12, ordem: 1, permissao: 'licenca.ver', render: widgetAviso });
  },
};
