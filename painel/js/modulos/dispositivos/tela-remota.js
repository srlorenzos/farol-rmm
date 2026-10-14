// Tela remota: abre uma sessão de relay tipo 'tela' (servidor/src/modulos/tela + agente/farol/modulos/
// tela.py) e desenha os quadros (JPEG) recebidos num <canvas>, mandando de volta mouse e teclado. Sem
// controle remoto de verdade (RDP/VNC) — é "o bastante": clique, digite, role, como se estivesse na frente
// da máquina. Só funciona com controle no Windows por ora (documentado na própria UI se o agente avisar).
import { h, preencher } from '../../nucleo/dom.js';
import { abrirSessao } from '../../nucleo/estado.js';
import { botao, aviso, select, campo } from '../../ui/componentes.js';
import { gaveta, toast, toastErro } from '../../ui/camadas.js';
import { garantirElevado } from '../../ui/elevar.js';

const FPS_OPCOES = [['2', '2 fps'], ['5', '5 fps'], ['8', '8 fps (padrão)'], ['12', '12 fps']];
const QUALIDADE_OPCOES = [['30', 'Baixa (mais rápido)'], ['45', 'Média (padrão)'], ['65', 'Alta (mais nítido)']];
const BOTAO_MOUSE = { 0: 'esquerdo', 1: 'meio', 2: 'direito' };

export function abrirTelaRemota(agente) {
  const canvas = h('canvas', {
    tabindex: '0', 'aria-label': `Tela remota de ${agente.hostname}`,
    estilo: { width: '100%', height: 'auto', display: 'block', background: '#0b0f12', borderRadius: 'var(--raio-2)', cursor: 'crosshair', outline: 'none' },
  });
  const ctxDesenho = canvas.getContext('2d');
  const status = h('span', { class: 'sutil pequeno', text: 'Conectando…' });
  const fpsTexto = h('span', { class: 'mono pequeno sutil' });
  const selFps = select(FPS_OPCOES, '8');
  const selQualidade = select(QUALIDADE_OPCOES, '45');

  let sessao = null;
  let fechada = false;
  let quadros = 0;
  let ultimoQuadroEm = 0;
  let mediaIntervaloMs = null;

  function enviarControle(obj) {
    if (!sessao || fechada) return;
    try { sessao.enviar(JSON.stringify(obj)); } catch { /* sessão pode ter acabado de fechar */ }
  }

  function desenharQuadro(base64) {
    const img = new Image();
    img.onload = () => {
      if (canvas.width !== img.width || canvas.height !== img.height) { canvas.width = img.width; canvas.height = img.height; }
      ctxDesenho.drawImage(img, 0, 0);
      const agora = performance.now();
      if (ultimoQuadroEm) {
        const intervalo = agora - ultimoQuadroEm;
        mediaIntervaloMs = mediaIntervaloMs == null ? intervalo : mediaIntervaloMs * 0.8 + intervalo * 0.2;
      }
      ultimoQuadroEm = agora;
      quadros++;
      const fps = mediaIntervaloMs ? (1000 / mediaIntervaloMs) : 0;
      fpsTexto.textContent = `${img.width}×${img.height} · ${fps.toFixed(1)} fps · ${quadros} quadro(s)`;
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  }

  // ---------------------------------------------------------------- mouse
  function posNormalizada(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) };
  }
  let ultimoMoveEm = 0;
  canvas.addEventListener('mousemove', (ev) => {
    const agora = performance.now();
    if (agora - ultimoMoveEm < 40) return; // ~25/s é o bastante, não trava a sessão
    ultimoMoveEm = agora;
    enviarControle({ tipo: 'mouse_mover', ...posNormalizada(ev) });
  });
  canvas.addEventListener('mousedown', (ev) => { ev.preventDefault(); canvas.focus(); enviarControle({ tipo: 'mouse_descer', ...posNormalizada(ev), botao: BOTAO_MOUSE[ev.button] ?? 'esquerdo' }); });
  canvas.addEventListener('mouseup', (ev) => { ev.preventDefault(); enviarControle({ tipo: 'mouse_subir', ...posNormalizada(ev), botao: BOTAO_MOUSE[ev.button] ?? 'esquerdo' }); });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); enviarControle({ tipo: 'mouse_scroll', delta: ev.deltaY }); }, { passive: false });

  // ---------------------------------------------------------------- teclado (só com o canvas focado)
  canvas.addEventListener('keydown', (ev) => { ev.preventDefault(); enviarControle({ tipo: 'tecla', codigo: ev.keyCode || ev.which, acao: 'descer' }); });
  canvas.addEventListener('keyup', (ev) => { ev.preventDefault(); enviarControle({ tipo: 'tecla', codigo: ev.keyCode || ev.which, acao: 'subir' }); });

  selFps.addEventListener('change', () => enviarControle({ tipo: 'config', fps: Number(selFps.value) }));
  selQualidade.addEventListener('change', () => enviarControle({ tipo: 'config', qualidade: Number(selQualidade.value) }));

  const camada = gaveta({
    titulo: `Tela remota — ${agente.hostname}`,
    descricao: 'Você pode ver e controlar o mouse/teclado deste dispositivo; a pessoa na frente é avisada (se a bandeja estiver rodando).',
    larga: true,
    conteudo: () => h('div', { class: 'pilha' },
      aviso('Controle de mouse/teclado só funciona com agentes Windows por ora; em outros sistemas esta sessão mostra só a tela. Clique na tela pra focar e poder digitar.', 'info'),
      h('div', { estilo: { background: '#0b0f12', borderRadius: 'var(--raio-2)', padding: '4px', display: 'grid', placeItems: 'center' } }, canvas),
      h('div', { class: 'linha-entre' }, h('div', { class: 'linha gap-2' }, status, fpsTexto),
        h('div', { class: 'linha gap-2' }, campo('Taxa', selFps), campo('Qualidade', selQualidade)))),
    rodape: (fechar) => h('div', { class: 'linha-entre' },
      h('span', { class: 'sutil pequeno' }, 'Exige 2FA · fica na auditoria'),
      h('button', { class: 'btn', type: 'button', onclick: () => fechar(null) }, 'Fechar')),
  });

  (async () => {
    if (!(await garantirElevado(`Abrir a tela remota de ${agente.hostname}.`))) { camada.fechar(null); return; }
    try {
      sessao = await abrirSessao(agente.id, 'tela', { fps: Number(selFps.value), qualidade: Number(selQualidade.value) }, {
        aoDados: (d) => desenharQuadro(d),
        aoFechar: (motivo) => { fechada = true; status.textContent = `Sessão encerrada${motivo ? ` (${motivo})` : ''}.`; },
      });
      status.textContent = 'Conectado.';
      canvas.focus();
    } catch (e) {
      fechada = true;
      status.textContent = 'Não foi possível abrir a sessão.';
      toastErro(e);
    }
  })();

  const fecharOriginal = camada.fechar.bind(camada);
  camada.fechar = (v) => { try { sessao?.fechar(); } catch { /* já fechada */ } fecharOriginal(v); };
  return camada;
}
