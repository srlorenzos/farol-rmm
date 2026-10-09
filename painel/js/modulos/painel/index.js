// Módulo Painel (dashboard): grade de widgets registrados pelos outros módulos via farol.widget().
import { h } from '../../nucleo/dom.js';
import { estado } from '../../nucleo/estado.js';
import { registro, visiveis } from '../../nucleo/registro.js';
import { cabecalhoPagina, botao, vazio } from '../../ui/componentes.js';

function saudacao() {
  const hora = new Date().getHours();
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

function rotuloEscopo() {
  const e = estado.escopo;
  for (const c of estado.clientes) {
    if (e.cliente === c.id) return c.nome;
    const s = c.sites.find((x) => x.id === e.site);
    if (s) return `${c.nome} · ${s.nome}`;
  }
  return 'todos os clientes';
}

export default {
  nome: 'painel',
  iniciar(farol) {
    farol.menu({ id: 'painel', rotulo: 'Painel', icone: 'painel', secao: 'Visão geral', ordem: 0, href: '#/' });
    farol.rota('/', {
      titulo: 'Painel',
      render(raiz) {
        const nome = (estado.nome || estado.usuario || '').split(/\s+/)[0];
        raiz.append(cabecalhoPagina({
          titulo: `${saudacao()}, ${nome}`,
          subtitulo: `Visão geral de ${rotuloEscopo()} · atualiza ao vivo`,
          acoes: [botao('Dispositivos', { icone: 'dispositivos', href: '#/dispositivos' })],
        }));
        const widgets = visiveis(registro.widgets);
        if (!widgets.length) {
          raiz.append(vazio({ titulo: 'Nenhum widget disponível', texto: 'Os módulos instalados não registraram widgets para o seu papel.' }));
          return null;
        }
        const grade = h('div', { class: 'grade-widgets' });
        const limpezas = [];
        for (const w of widgets) {
          const el = h('section', { class: 'cartao widget', 'aria-label': w.titulo, dataset: { tamanho: String(w.tamanho), widget: w.id } });
          grade.append(el);
          try {
            const l = w.render(el, { escopo: estado.escopo });
            if (typeof l === 'function') limpezas.push(l);
          } catch (e) {
            console.error(e);
            el.append(vazio({ titulo: `${w.titulo}: erro`, texto: e.message, compacto: true, ilustracao: 'erro' }));
          }
        }
        raiz.append(grade);
        return () => limpezas.forEach((f) => f());
      },
    });
  },
};
