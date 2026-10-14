"""Gera a página única (HTML + CSS + JS embutidos, sem CDN) da janela da bandeja: abas Sistema /
Chamados / Novo chamado. Mesma linguagem visual do painel (tokens de cor e forma iguais aos de
painel/css/tokens.css), mas é um arquivo autocontido — nada daqui importa nem referencia os arquivos do
painel. Tema escuro/claro segue o Windows via `prefers-color-scheme`.
"""
from __future__ import annotations

import html
import json

from farol import VERSAO

COR_MARCA_PADRAO = "#ff9a2e"


def _json_js(dados) -> str:
    """JSON seguro para colar dentro de uma <script>: escapa '</' para não fechar a tag por acidente."""
    return json.dumps(dados, ensure_ascii=False).replace("</", "<\\/")


def montar_html(*, porta_api: int, token: str, empresa: str = "Farol", cor_marca: str = COR_MARCA_PADRAO) -> str:
    cor = cor_marca if (cor_marca or "").startswith("#") and len(cor_marca) == 7 else COR_MARCA_PADRAO
    titulo = f"Suporte {html.escape(empresa or 'Farol')}"
    dados_iniciais = _json_js({"porta": porta_api, "token": token, "empresa": empresa or "Farol", "cor": cor, "versaoAgente": VERSAO})
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo}</title>
<style>{_CSS.replace("__COR_MARCA__", cor)}</style>
</head>
<body>
{_CORPO}
<script>window.__FAROL_BANDEJA__ = {dados_iniciais};</script>
<script>{_JS}</script>
</body>
</html>"""


_CSS = """
:root {
  color-scheme: dark;
  --marca: __COR_MARCA__;
  --marca-tinta: #1d1003;
  --fundo: #081217; --superficie-0: #0b171d; --superficie-1: #0f1d24; --superficie-2: #14262e; --superficie-3: #1a2f38;
  --borda: rgba(255,255,255,.09); --borda-forte: rgba(255,255,255,.16);
  --texto-1: #e9f1f3; --texto-2: #a8bcc3; --texto-3: #74898f;
  --ok: #2bb673; --ok-lavagem: rgba(43,182,115,.14);
  --aviso: #f2c94c; --aviso-lavagem: rgba(242,201,76,.14);
  --critico: #ef5350; --critico-lavagem: rgba(239,83,80,.14);
  --info: #4c9be8; --info-lavagem: rgba(76,155,232,.14);
  --neutro: #6b7f86; --neutro-lavagem: rgba(107,127,134,.16);
  --raio-1: 5px; --raio-2: 7px; --raio-3: 10px; --raio-4: 14px; --raio-pilula: 999px;
  --sombra-2: 0 6px 18px -6px rgba(0,0,0,.5), 0 2px 4px rgba(0,0,0,.25);
  --fonte: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --fonte-mono: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
}
@media (prefers-color-scheme: light) {
  :root {
    color-scheme: light;
    --fundo: #f3f6f7; --superficie-0: #f7f9fa; --superficie-1: #fff; --superficie-2: #f2f6f7; --superficie-3: #fff;
    --borda: rgba(13,40,50,.1); --borda-forte: rgba(13,40,50,.18);
    --texto-1: #0e1d23; --texto-2: #46595f; --texto-3: #6a7d83;
    --ok: #12985a; --ok-lavagem: rgba(18,152,90,.1);
    --aviso: #b88600; --aviso-lavagem: rgba(230,170,0,.14);
    --critico: #d93b38; --critico-lavagem: rgba(217,59,56,.09);
    --info: #2a78d6; --info-lavagem: rgba(42,120,214,.09);
    --neutro: #7b8b90; --neutro-lavagem: rgba(123,139,144,.13);
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--fundo); color: var(--texto-1); font: 13px/1.5 var(--fonte);
  display: flex; flex-direction: column; overflow: hidden;
}
button { font: inherit; }
.topo {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--superficie-1);
  border-bottom: 1px solid var(--borda); flex: 0 0 auto;
}
.topo .farol-logo { width: 26px; height: 26px; border-radius: var(--raio-2); flex: 0 0 auto; }
.topo .titulo { flex: 1 1 auto; min-width: 0; }
.topo .titulo strong { display: block; font-size: 13px; font-weight: 600; }
.topo .titulo span { display: block; font-size: 11px; color: var(--texto-3); }
.estado-ponto { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; flex: 0 0 auto; }
.estado-ponto.on { background: var(--ok); box-shadow: 0 0 0 3px var(--ok-lavagem); }
.estado-ponto.off { background: var(--neutro); }
.estado-linha { display: flex; align-items: center; font-size: 11px; color: var(--texto-3); white-space: nowrap; }
.abas { display: flex; gap: 2px; padding: 6px 10px 0; background: var(--superficie-1); border-bottom: 1px solid var(--borda); flex: 0 0 auto; }
.aba { flex: 1; text-align: center; padding: 8px 6px; border-radius: var(--raio-2) var(--raio-2) 0 0; border: none; background: transparent;
  color: var(--texto-2); cursor: pointer; font-size: 12.5px; font-weight: 500; position: relative; }
.aba.ativa { color: var(--marca); background: var(--superficie-0); }
.aba.ativa::after { content: ""; position: absolute; left: 10%; right: 10%; bottom: -1px; height: 2px; background: var(--marca); border-radius: 2px 2px 0 0; }
.aba .bolha { display: inline-block; min-width: 15px; height: 15px; line-height: 15px; border-radius: 999px; background: var(--critico);
  color: #fff; font-size: 10px; font-weight: 700; margin-left: 5px; padding: 0 3px; }
.painel { flex: 1 1 auto; overflow-y: auto; padding: 14px; background: var(--superficie-0); }
.painel[hidden] { display: none; }
.cartao { background: var(--superficie-1); border: 1px solid var(--borda); border-radius: var(--raio-3); padding: 12px 14px; margin-bottom: 10px; }
.cartao h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--texto-3); font-weight: 600; }
.fatos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin: 0; }
.fatos dt { font-size: 11px; color: var(--texto-3); margin: 0; }
.fatos dd { font-size: 12.5px; margin: 1px 0 0; font-weight: 500; }
.fatos dd.mono { font-family: var(--fonte-mono); font-size: 11.5px; }
.medidor { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.medidor .trilho { flex: 1; height: 6px; border-radius: 999px; background: var(--superficie-2); overflow: hidden; }
.medidor .valor { height: 100%; border-radius: 999px; background: var(--info); }
.medidor .valor.alerta { background: var(--aviso); }
.medidor .valor.critico { background: var(--critico); }
.medidor .texto { font-size: 11px; color: var(--texto-2); width: 34px; text-align: right; flex: 0 0 auto; }
.linha-disco { margin-bottom: 8px; }
.linha-disco .rotulo { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--texto-2); margin-bottom: 2px; }
.acoes-rapidas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.btn { border: 1px solid var(--borda-forte); background: var(--superficie-2); color: var(--texto-1); border-radius: var(--raio-2);
  padding: 8px 10px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
.btn:hover { background: var(--superficie-3); }
.btn:disabled { opacity: .5; cursor: default; }
.btn[hidden] { display: none; } /* .btn já declara display: flex, que por si vence o display:none do atributo hidden */
.btn-primario { background: var(--marca); color: var(--marca-tinta); border-color: transparent; font-weight: 600; }
.btn-primario:hover { filter: brightness(1.06); }
.btn-largo { width: 100%; }
.selo { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 600; }
.selo-ok { background: var(--ok-lavagem); color: var(--ok); }
.selo-aviso { background: var(--aviso-lavagem); color: var(--aviso); }
.selo-critico { background: var(--critico-lavagem); color: var(--critico); }
.selo-info { background: var(--info-lavagem); color: var(--info); }
.selo-neutro { background: var(--neutro-lavagem); color: var(--neutro); }
.lista-chamados { display: flex; flex-direction: column; gap: 8px; }
.item-chamado { background: var(--superficie-1); border: 1px solid var(--borda); border-radius: var(--raio-3); padding: 10px 12px; cursor: pointer; text-align: left; }
.item-chamado:hover { border-color: var(--borda-forte); }
.item-chamado .linha1 { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.item-chamado .assunto { font-weight: 600; font-size: 12.5px; }
.item-chamado .quando { font-size: 10.5px; color: var(--texto-3); flex: 0 0 auto; }
.item-chamado .resumo { font-size: 11.5px; color: var(--texto-2); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vazio { text-align: center; color: var(--texto-3); font-size: 12px; padding: 30px 10px; }
.campo { display: block; margin-bottom: 10px; }
.campo label { display: block; font-size: 11.5px; color: var(--texto-2); margin-bottom: 4px; font-weight: 500; }
.input, select.input, textarea.input {
  width: 100%; background: var(--superficie-0); border: 1px solid var(--borda-forte); color: var(--texto-1);
  border-radius: var(--raio-2); padding: 7px 9px; font: inherit; font-size: 12.5px;
}
textarea.input { resize: vertical; min-height: 64px; }
.linha2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.print-preview { position: relative; margin-bottom: 10px; border-radius: var(--raio-2); overflow: hidden; border: 1px solid var(--borda-forte); }
.print-preview img { width: 100%; display: block; }
.print-preview button { position: absolute; top: 6px; right: 6px; background: rgba(8,18,23,.75); color: #fff; border: none;
  border-radius: 999px; width: 22px; height: 22px; cursor: pointer; font-size: 13px; line-height: 1; }
.timeline { display: flex; flex-direction: column; gap: 10px; }
.msg { max-width: 86%; padding: 8px 10px; border-radius: var(--raio-3); font-size: 12.5px; }
.msg-usuario { align-self: flex-end; background: var(--marca); color: var(--marca-tinta); border-radius: var(--raio-3) var(--raio-3) 4px var(--raio-3); }
.msg-tecnico { align-self: flex-start; background: var(--superficie-2); border-radius: var(--raio-3) var(--raio-3) var(--raio-3) 4px; }
.msg-sistema { align-self: center; color: var(--texto-3); font-size: 11px; background: transparent; }
.msg .quando { display: block; font-size: 10px; opacity: .7; margin-top: 3px; }
.msg img { max-width: 100%; border-radius: var(--raio-2); margin-top: 6px; cursor: zoom-in; }
.toast { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); background: var(--superficie-3); color: var(--texto-1);
  border: 1px solid var(--borda-forte); border-radius: var(--raio-2); padding: 8px 14px; font-size: 12px; box-shadow: var(--sombra-2);
  opacity: 0; transition: opacity .2s; pointer-events: none; z-index: 50; }
.toast.ver { opacity: 1; }
.rodape-chamado { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid var(--borda); margin-top: 10px; }
.rodape-chamado textarea { flex: 1; }
.voltar { background: transparent; border: none; color: var(--texto-2); font-size: 12px; cursor: pointer; padding: 4px 0 10px; display: flex; align-items: center; gap: 4px; }
.sutil { color: var(--texto-3); font-size: 11px; }
.contato-lista { display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.lightbox { position: fixed; inset: 0; background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center; z-index: 60; cursor: zoom-out; }
.lightbox img { max-width: 92%; max-height: 92%; border-radius: var(--raio-2); }
"""

_CORPO = """
<header class="topo">
  <svg class="farol-logo" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="var(--marca)" opacity=".18"/>
    <rect x="23" y="46" width="18" height="4" rx="1" fill="var(--marca)"/>
    <polygon points="27,46 37,46 34.5,20 29.5,20" fill="var(--marca)"/>
    <rect x="26" y="18" width="12" height="6" fill="var(--texto-1)"/></svg>
  <div class="titulo">
    <strong id="tituloEmpresa">Suporte</strong>
    <span class="estado-linha"><span id="pontoEstado" class="estado-ponto off"></span><span id="textoEstado">verificando…</span></span>
  </div>
</header>
<nav class="abas" role="tablist">
  <button class="aba ativa" data-aba="sistema" role="tab">Sistema</button>
  <button class="aba" data-aba="chamados" role="tab">Chamados<span id="bolhaChamados" class="bolha" hidden>0</span></button>
  <button class="aba" data-aba="novo" role="tab">Novo chamado</button>
</nav>

<section id="painelSistema" class="painel" role="tabpanel"></section>

<section id="painelChamados" class="painel" role="tabpanel" hidden>
  <div id="listaChamados" class="lista-chamados"></div>
</section>

<section id="painelChamado" class="painel" role="tabpanel" hidden>
  <button class="voltar" id="btnVoltarLista">&larr; Voltar aos chamados</button>
  <div id="detalheChamado"></div>
</section>

<section id="painelNovo" class="painel" role="tabpanel" hidden>
  <form id="formNovo">
    <div class="campo"><label for="campoAssunto">Assunto</label><input class="input" id="campoAssunto" maxlength="200" required></div>
    <div class="linha2">
      <div class="campo"><label for="campoCategoria">Categoria</label>
        <select class="input" id="campoCategoria">
          <option value="acesso">Acesso</option><option value="desempenho">Desempenho</option><option value="rede">Rede</option>
          <option value="impressora">Impressora</option><option value="software">Software</option><option value="hardware">Hardware</option>
          <option value="email">E-mail</option><option value="outro" selected>Outro</option>
        </select></div>
      <div class="campo"><label for="campoPrioridade">Prioridade</label>
        <select class="input" id="campoPrioridade">
          <option value="baixa">Baixa</option><option value="normal" selected>Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
        </select></div>
    </div>
    <div class="campo"><label for="campoDescricao">Descreva o problema</label>
      <textarea class="input" id="campoDescricao" rows="4" maxlength="8000" required></textarea></div>
    <div id="previewPrint"></div>
    <button type="button" class="btn btn-largo" id="btnAnexarPrint">Anexar um print da tela</button>
    <p class="sutil" style="margin:8px 0 14px">Os dados deste computador são anexados automaticamente.</p>
    <button type="submit" class="btn btn-primario btn-largo" id="btnEnviarChamado">Abrir chamado</button>
  </form>
</section>

<div id="toast" class="toast"></div>
"""

_JS = r"""
(function () {
  'use strict';
  var F = window.__FAROL_BANDEJA__;
  var base = 'http://127.0.0.1:' + F.porta;

  function pedir(metodo, caminho, corpo) {
    var opts = { method: metodo, headers: { Authorization: 'Bearer ' + F.token } };
    if (corpo !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(corpo); }
    return fetch(base + caminho, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (dados) {
        if (!r.ok) throw new Error(dados.erro || ('Erro ' + r.status));
        return dados;
      });
    });
  }
  var get = function (c) { return pedir('GET', c); };
  var post = function (c, b) { return pedir('POST', c, b || {}); };

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k === 'html5') { /* nunca: sem innerHTML com dados do usuário */ }
      else n.setAttribute(k, attrs[k]);
    }
    (filhos || []).forEach(function (f) { if (f) n.append(f); });
    return n;
  }

  function toast(msg, erro) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.style.color = erro ? 'var(--critico)' : '';
    t.classList.add('ver');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('ver'); }, 3200);
  }

  function fmtData(ts) {
    if (!ts) return '—';
    var ms = ts > 2e10 ? ts : ts * 1000;
    return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function fmtBytes(b) {
    if (b == null) return '—';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0, v = Number(b);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(i >= 2 ? 1 : 0) + ' ' + u[i];
  }
  function nivel(pct) { if (pct == null) return ''; if (pct >= 90) return 'critico'; if (pct >= 75) return 'alerta'; return ''; }
  function medidor(pct, rotulo) {
    pct = pct == null ? 0 : pct;
    return el('div', { class: 'linha-disco' }, [
      el('div', { class: 'rotulo' }, [el('span', { text: rotulo }), el('span', { text: pct.toFixed(0) + '%' })]),
      el('div', { class: 'medidor' }, [el('div', { class: 'trilho' }, [
        (function () { var v = el('div', { class: 'valor ' + nivel(pct) }); v.style.width = Math.min(100, Math.max(0, pct)) + '%'; return v; })(),
      ])]),
    ]);
  }

  // ---------------------------------------------------------------- abas
  var abas = Array.prototype.slice.call(document.querySelectorAll('.aba'));
  var paineis = { sistema: painelSistema(), chamados: document.getElementById('painelChamados'), novo: document.getElementById('painelNovo') };
  function painelSistema() { return document.getElementById('painelSistema'); }
  function mostrarAba(nome) {
    abas.forEach(function (a) { a.classList.toggle('ativa', a.dataset.aba === nome); });
    document.getElementById('painelSistema').hidden = nome !== 'sistema';
    document.getElementById('painelChamados').hidden = nome !== 'chamados';
    document.getElementById('painelChamado').hidden = true;
    document.getElementById('painelNovo').hidden = nome !== 'novo';
    if (nome === 'chamados') carregarChamados();
    if (nome === 'sistema') carregarSistema();
  }
  abas.forEach(function (a) { a.addEventListener('click', function () { mostrarAba(a.dataset.aba); }); });
  document.getElementById('btnVoltarLista').addEventListener('click', function () {
    document.getElementById('painelChamado').hidden = true;
    document.getElementById('painelChamados').hidden = false;
  });

  // ---------------------------------------------------------------- marca
  document.getElementById('tituloEmpresa').textContent = 'Suporte ' + F.empresa;
  document.title = 'Suporte ' + F.empresa;
  get('/api/bandeja/config').then(function (cfg) {
    F.config = cfg;
    if (cfg.empresa) { document.getElementById('tituloEmpresa').textContent = 'Suporte ' + cfg.empresa; document.title = 'Suporte ' + cfg.empresa; }
    montarSobreEContato();
    aplicarRecursos();
  }).catch(function () { montarSobreEContato(); });

  // ---------------------------------------------------------------- recursos ligados/desligados (admin)
  // Espelha Configurações > Bandeja do agente no painel (servidor/src/modulos/chamados: configBandeja().recursos).
  function recursoAtivo(nome) {
    var r = F.config && F.config.recursos;
    return !r || r[nome] !== false; // sem config carregada ainda (ou campo ausente): assume ligado
  }
  function aplicarRecursos() {
    var abaChamados = document.querySelector('.aba[data-aba="chamados"]');
    var abaNovo = document.querySelector('.aba[data-aba="novo"]');
    var semChamados = !recursoAtivo('chamados');
    if (abaChamados) abaChamados.hidden = semChamados;
    if (abaNovo) abaNovo.hidden = semChamados;
    if (semChamados) {
      var ativa = document.querySelector('.aba.ativa');
      if (ativa && (ativa.dataset.aba === 'chamados' || ativa.dataset.aba === 'novo')) mostrarAba('sistema');
    }
    var btnPrint = document.getElementById('btnAnexarPrint');
    if (btnPrint) btnPrint.hidden = !recursoAtivo('print');
  }

  // ---------------------------------------------------------------- sistema
  function carregarSistema() {
    var raiz = document.getElementById('painelSistema');
    raiz.textContent = '';
    raiz.append(el('div', { class: 'cartao', text: 'Carregando…' }));
    get('/api/sistema').then(function (s) {
      raiz.textContent = '';
      var ponto = document.getElementById('pontoEstado'), txt = document.getElementById('textoEstado');
      ponto.className = 'estado-ponto ' + (s.farol.conectado ? 'on' : 'off');
      txt.textContent = s.farol.conectado ? 'Conectado' : ('Desconectado' + (s.farol.ultimo_contato ? ' · último contato ' + fmtData(s.farol.ultimo_contato) : ''));

      var geral = el('div', { class: 'cartao' }, [
        el('h3', { text: 'Este computador' }),
        el('dl', { class: 'fatos' }, [
          el('dt', { text: 'Nome' }), el('dd', { text: s.hostname || '—' }),
          el('dt', { text: 'Usuário' }), el('dd', { text: s.usuario || '—' }),
          el('dt', { text: 'Sistema' }), el('dd', { text: (s.so || '') + ' ' + (s.so_versao || '') }),
          el('dt', { text: 'IP' }), el('dd', { class: 'mono', text: s.ip || '—' }),
          el('dt', { text: 'Fabricante' }), el('dd', { text: s.fabricante || '—' }),
          el('dt', { text: 'Modelo' }), el('dd', { text: s.modelo || '—' }),
          el('dt', { text: 'Uptime' }), el('dd', { text: s.uptime ? Math.floor(s.uptime / 3600) + ' h' : '—' }),
          el('dt', { text: 'Agente' }), el('dd', { text: 'v' + s.versao_agente }),
        ]),
      ]);
      raiz.append(geral);

      var desempenho = el('div', { class: 'cartao' }, [el('h3', { text: 'Desempenho' })]);
      desempenho.append(medidor(s.cpu_pct, 'CPU (' + (s.cpu_modelo || 'processador') + ')'));
      desempenho.append(medidor(s.ram_total ? (s.ram_usada / s.ram_total) * 100 : null,
        'Memória (' + fmtBytes(s.ram_usada) + ' de ' + fmtBytes(s.ram_total) + ')'));
      (s.discos || []).forEach(function (d) { desempenho.append(medidor(d.pct, 'Disco ' + (d.ponto || ''))); });
      raiz.append(desempenho);

      if (recursoAtivo('acoesRapidas')) {
        var acoes = el('div', { class: 'cartao' }, [el('h3', { text: 'Ações rápidas' }),
          el('div', { class: 'acoes-rapidas' })]);
        var grade = acoes.querySelector('.acoes-rapidas');
        grade.append(botaoAcao('Reiniciar o Farol', function (b) {
          b.disabled = true;
          post('/api/sistema/reiniciar').then(function () { toast('Pedido enviado. O agente vai reiniciar em instantes.'); })
            .catch(function (e) { toast(e.message, true); }).finally(function () { b.disabled = false; });
        }));
        grade.append(botaoAcao('Copiar dados do sistema', function () {
          var texto = Object.keys(s).filter(function (k) { return k !== 'farol' && k !== 'discos'; })
            .map(function (k) { return k + ': ' + s[k]; }).join('\n');
          (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject())
            .then(function () { toast('Copiado.'); }).catch(function () { toast('Não foi possível copiar.', true); });
        }));
        grade.append(botaoAcao('Sobre', function () { mostrarSobre(s); }));
        var btnContato = botaoAcao('Contato do suporte', function () { mostrarContato(); });
        btnContato.id = 'btnContato';
        btnContato.hidden = true;
        grade.append(btnContato);
        raiz.append(acoes);
        montarSobreEContato();
      }
    }).catch(function (e) { raiz.textContent = ''; raiz.append(el('div', { class: 'cartao vazio', text: 'Não foi possível falar com o agente: ' + e.message })); });
  }
  function botaoAcao(rotulo, onclick) {
    var b = el('button', { class: 'btn', type: 'button', text: rotulo });
    b.addEventListener('click', function () { onclick(b); });
    return b;
  }
  var ultimoSistema = null;
  function mostrarSobre(s) {
    ultimoSistema = s;
    alertaModal('Sobre a bandeja do Farol', 'Versão do agente: ' + s.versao_agente + '\nServidor: ' + (s.farol.servidor || '—'));
  }
  function mostrarContato() {
    var c = (F.config && F.config.contato) || {};
    var linhas = [];
    if (c.telefone) linhas.push('Telefone: ' + c.telefone);
    if (c.email) linhas.push('E-mail: ' + c.email);
    if (c.site) linhas.push('Site: ' + c.site);
    alertaModal('Contato do suporte', linhas.join('\n') || 'Nenhum contato configurado.');
  }
  function alertaModal(titulo, texto) { toast(titulo + ' — ' + texto.replace(/\n/g, ' · ')); }
  function montarSobreEContato() {
    var c = (F.config && F.config.contato) || {};
    var btn = document.getElementById('btnContato');
    if (btn) btn.hidden = !(c.telefone || c.email || c.site);
  }

  // ---------------------------------------------------------------- chamados
  var selos = { aberto: ['Aberto', 'info'], em_andamento: ['Em andamento', 'info'], aguardando_usuario: ['Sua vez', 'aviso'],
    resolvido: ['Resolvido', 'ok'], fechado: ['Fechado', 'neutro'] };
  function seloChamado(status) {
    var p = selos[status] || [status, 'neutro'];
    return el('span', { class: 'selo selo-' + p[1], text: p[0] });
  }
  function carregarChamados() {
    var raiz = document.getElementById('listaChamados');
    raiz.textContent = '';
    get('/api/chamados').then(function (lista) {
      raiz.textContent = '';
      atualizarBolha(lista);
      if (!lista.length) { raiz.append(el('div', { class: 'vazio', text: 'Você ainda não abriu nenhum chamado.' })); return; }
      lista.forEach(function (c) {
        var item = el('button', { class: 'item-chamado', type: 'button' }, [
          el('div', { class: 'linha1' }, [el('span', { class: 'assunto', text: c.assunto }), el('span', { class: 'quando', text: fmtData(c.atualizado_em) })]),
          el('div', { class: 'resumo' }, [seloChamado(c.status), ' ', c.ultima_mensagem ? c.ultima_mensagem.texto : '']),
        ]);
        item.addEventListener('click', function () { abrirChamado(c.id); });
        raiz.append(item);
      });
    }).catch(function (e) { raiz.append(el('div', { class: 'vazio', text: e.message })); });
  }
  function atualizarBolha(lista) {
    var n = (lista || []).filter(function (c) { return c.status === 'aguardando_usuario'; }).length;
    var b = document.getElementById('bolhaChamados');
    b.hidden = !n; b.textContent = n;
  }

  function abrirChamado(id) {
    document.getElementById('painelChamados').hidden = true;
    document.getElementById('painelChamado').hidden = false;
    var raiz = document.getElementById('detalheChamado');
    raiz.textContent = 'Carregando…';
    get('/api/chamados/' + id).then(function (c) {
      raiz.textContent = '';
      var cab = el('div', { class: 'cartao' }, [
        el('div', { class: 'linha1', style: '' }, []),
      ]);
      cab.querySelector('.linha1').append(el('strong', { text: c.assunto }), seloChamado(c.status));
      raiz.append(cab);
      var linha = el('div', { class: 'timeline' });
      (c.mensagens || []).forEach(function (m) {
        var bolha = el('div', { class: 'msg msg-' + m.autor_tipo }, [document.createTextNode(m.texto), el('span', { class: 'quando', text: fmtData(m.criado_em) })]);
        linha.append(bolha);
      });
      (c.anexos || []).forEach(function (a) {
        var img = document.createElement('img');
        img.src = base + '/api/chamados/' + c.id + '/anexos/' + a.id + '?token=' + encodeURIComponent(F.token);
        img.alt = a.nome_arquivo;
        img.addEventListener('click', function () { abrirLightbox(img.src); });
        var ultima = linha.lastElementChild;
        if (ultima) ultima.append(img); else linha.append(el('div', { class: 'msg msg-sistema' }, [img]));
      });
      raiz.append(linha);
      if (c.status !== 'fechado') {
        var rodape = el('div', { class: 'rodape-chamado' });
        var texto = el('textarea', { class: 'input', rows: '2', placeholder: 'Escreva uma resposta…' });
        var enviar = el('button', { class: 'btn btn-primario', type: 'button', text: 'Enviar' });
        enviar.addEventListener('click', function () {
          var t = texto.value.trim();
          if (!t) return;
          enviar.disabled = true;
          post('/api/chamados/' + id + '/mensagens', { texto: t }).then(function () { texto.value = ''; abrirChamado(id); })
            .catch(function (e) { toast(e.message, true); }).finally(function () { enviar.disabled = false; });
        });
        rodape.append(texto, enviar);
        raiz.append(rodape);
        var fechar = el('button', { class: 'btn', type: 'button', text: 'Marcar como resolvido para mim', style: 'margin-top:8px' });
        fechar.addEventListener('click', function () {
          post('/api/chamados/' + id + '/fechar').then(function () { toast('Chamado encerrado.'); abrirChamado(id); }).catch(function (e) { toast(e.message, true); });
        });
        raiz.append(fechar);
      }
    }).catch(function (e) { raiz.textContent = ''; raiz.append(el('div', { class: 'vazio', text: e.message })); });
  }
  function abrirLightbox(src) {
    var lb = el('div', { class: 'lightbox' }, [el('img', { src: src })]);
    lb.addEventListener('click', function () { lb.remove(); });
    document.body.append(lb);
  }

  // ---------------------------------------------------------------- novo chamado
  var printBase64 = null, printTipo = null;
  document.getElementById('btnAnexarPrint').addEventListener('click', function () {
    // Captura é feita pela própria janela da bandeja (mesma origem desta página), não pelo agente: o
    // agente roda como SYSTEM e não tem acesso à área de trabalho interativa do usuário.
    fetch('/_bandeja/print', { method: 'POST', headers: { Authorization: 'Bearer ' + F.token } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (r) {
      printBase64 = r.base64; printTipo = r.tipo;
      var raiz = document.getElementById('previewPrint');
      raiz.textContent = '';
      var caixa = el('div', { class: 'print-preview' });
      var img = el('img', { src: 'data:' + printTipo + ';base64,' + printBase64 });
      var remover = el('button', { type: 'button', text: '×', 'aria-label': 'Remover print' });
      remover.addEventListener('click', function () { printBase64 = null; raiz.textContent = ''; });
      caixa.append(img, remover);
      raiz.append(caixa);
    }).catch(function (e) { toast('Não foi possível capturar a tela: ' + e.message, true); });
  });
  document.getElementById('formNovo').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = document.getElementById('btnEnviarChamado');
    btn.disabled = true;
    var corpo = {
      assunto: document.getElementById('campoAssunto').value.trim(),
      categoria: document.getElementById('campoCategoria').value,
      prioridade: document.getElementById('campoPrioridade').value,
      descricao: document.getElementById('campoDescricao').value.trim(),
    };
    if (printBase64) { corpo.anexo_base64 = printBase64; corpo.anexo_tipo = printTipo; corpo.anexo_nome = 'print.png'; }
    post('/api/chamados', corpo).then(function () {
      toast('Chamado aberto. Acompanhe na aba Chamados.');
      ev.target.reset();
      printBase64 = null;
      document.getElementById('previewPrint').textContent = '';
      mostrarAba('chamados');
    }).catch(function (e) { toast(e.message, true); }).finally(function () { btn.disabled = false; });
  });

  // ---------------------------------------------------------------- notificações (polling)
  function verificarNotificacoes() {
    get('/api/notificacoes').then(function (r) {
      (r.itens || []).forEach(function (n) {
        toast('Resposta no chamado: ' + (n.assunto || ('#' + n.chamado_id)));
        if (window.__farolNotificar) window.__farolNotificar(n);
      });
    }).catch(function () {});
  }
  setInterval(verificarNotificacoes, 8000);
  setInterval(function () { if (!document.getElementById('painelSistema').hidden) carregarSistema(); }, 30000);
  carregarSistema();
})();
"""
