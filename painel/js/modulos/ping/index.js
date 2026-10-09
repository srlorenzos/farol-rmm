// Módulo de exemplo do tempo real (modelo para terminal/tela remota):
//  - "Testar conexão": comando tipado 'ping' (POST /api/agentes/:id/ping) com a latência ida e volta;
//  - sessão de relay 'eco' aberta pelo WebSocket do painel: o que for enviado volta do agente ('ping' → 'pong').
import { h, preencher } from '../../nucleo/dom.js';
import { post } from '../../nucleo/api.js';
import { abrirSessao } from '../../nucleo/estado.js';
import { fmtNum } from '../../nucleo/formato.js';
import { botao, input, aviso, blocoMono, selo } from '../../ui/componentes.js';
import { modal } from '../../ui/camadas.js';

function testar(agente) {
  modal({
    titulo: `Testar conexão · ${agente.hostname}`, icone: 'raio', largura: 'md',
    descricao: 'Comando tipado e sessão de relay pelo canal em tempo real do agente.',
    conteudo: (fechar) => {
      const resultadoPing = h('div', { class: 'linha' }, h('span', { class: 'sutil pequeno', text: 'Ainda não testado.' }));
      const log = blocoMono('');
      const linhas = [];
      const registrar = (t) => { linhas.push(`${new Date().toLocaleTimeString('pt-BR')}  ${t}`); log.firstChild.textContent = linhas.slice(-14).join('\n'); };
      let sessao = null;
      const texto = input({ valor: 'ping', attrs: { 'aria-label': 'Texto a enviar' } });
      const enviar = botao('Enviar', { tamanho: 'pequeno', desabilitado: true });
      const abrir = botao('Abrir sessão de eco', { tamanho: 'pequeno', icone: 'link' });
      let enviadoEm = 0;

      const pingar = async () => {
        preencher(resultadoPing, h('span', { class: 'giro' }), h('span', { class: 'sutil pequeno', text: ' testando…' }));
        try {
          const r = await post(`/api/agentes/${agente.id}/ping`);
          preencher(resultadoPing, selo('pong', 'ok', { icone: 'check' }), h('strong', { class: 'tabular', text: `${fmtNum(r.latencia_ms, 1)} ms` }), h('span', { class: 'sutil pequeno', text: `agente v${r.versao}` }));
        } catch (e) {
          preencher(resultadoPing, selo('falhou', 'critico'), h('span', { class: 'pequeno', text: e.message }));
        }
      };
      abrir.addEventListener('click', async () => {
        if (sessao) { sessao.fechar(); return; }
        try {
          registrar('abrindo sessão de eco…');
          sessao = await abrirSessao(agente.id, 'eco', {}, {
            aoDados: (d) => registrar(`← ${d}${enviadoEm ? `  (${Math.round(performance.now() - enviadoEm)} ms)` : ''}`),
            aoFechar: (m) => { registrar(`sessão encerrada: ${m}`); sessao = null; enviar.disabled = true; preencher(abrir, 'Abrir sessão de eco'); },
          });
          registrar(`sessão aberta (${sessao.id.slice(0, 8)})`);
          enviar.disabled = false;
          preencher(abrir, 'Fechar sessão');
        } catch (e) { registrar(`erro: ${e.message}`); }
      });
      enviar.addEventListener('click', () => { if (!sessao) return; enviadoEm = performance.now(); registrar(`→ ${texto.value}`); sessao.enviar(texto.value); });
      texto.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); enviar.click(); } });
      pingar();
      return [
        agente.tempo_real ? null : aviso('Este dispositivo não está com o canal em tempo real conectado; o teste vai falhar até ele reconectar.', 'alerta'),
        h('div', { class: 'linha-entre mt-2' }, h('h3', { text: 'Comando ping' }), botao('Testar de novo', { tamanho: 'pequeno', icone: 'atualizar', onclick: pingar })),
        h('div', { class: 'mt-2 mb-4' }, resultadoPing),
        h('div', { class: 'linha-entre' }, h('h3', { text: 'Sessão de relay (eco)' }), abrir),
        h('div', { class: 'linha mt-2 mb-2' }, h('div', { class: 'cresce' }, texto), enviar),
        log,
        h('div', { class: 'modal-acoes' }, botao('Fechar', { onclick: () => { sessao?.fechar(); fechar(); } })),
      ];
    },
  });
}

export default {
  nome: 'ping',
  iniciar(farol) {
    farol.acaoDispositivo({ id: 'ping', rotulo: 'Testar conexão', icone: 'raio', ordem: 50, menu: true, permissao: 'dispositivos.ver', executar: testar });
  },
};
