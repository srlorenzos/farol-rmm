# Progresso — Farol RMM v2

Objetivo: RMM completo no nível do Datto RMM (funções + visual premium), identidade própria.

## Etapa 1 (em andamento, 2026-10-09)
- [x] Base modular + revisão + visual premium: núcleo modular, RBAC, alvos, relay WS (job em ~300 ms), agente em pacote, design system, Ctrl+K, todas as telas. 53 testes servidor + 26 agente; e2e ok; screenshots revisados. Pendente: `painel/DESIGN.md` e README "Como usar" da v2.
- [x] Biblioteca: 551 scripts (393 Windows, 141 Linux, 21 macOS; 88 monitores) em 31 categorias, validador com 0 erros, sintaxe ok (PS/bash/py), 97 scripts Windows executados de verdade sem erro. Linux/macOS só checados por sintaxe. `.ps1` em UTF-8 com BOM (o carregador precisa tolerar). Gerador fora do repo: scratchpad `gen.mjs` + `b/*.txt`.

## Etapa 2 (depois da etapa 1, em paralelo, cada um num módulo)
- [ ] Sites/grupos/filtros dinâmicos, descoberta de rede
- [x] Instaladores Windows (empacotamento/): `farol-agente.exe` (PyInstaller; build em pasta para o serviço pywin32 "Farol RMM Agent", build de arquivo único com Tarefa Agendada como plano B), `FarolAgenteSetup.exe` (Inno Setup, `/VERYSILENT /SERVIDOR= /TOKEN=`), `farol-servidor.exe` (Node SEA, node:sqlite ok, assets embutidos), ícone multi-resolução, versão única em `empacotamento/VERSION`, `build.ps1`, workflow `release.yml` (tag `v*`, assinatura opcional) e comando silencioso na API de tokens/painel. Testado: exes contra servidor temporário (registro, check-in, `modulos`, `status`), SEA servindo painel/biblioteca/.pyz. NÃO testado por falta de administrador: criar serviço de verdade, UAC, rodar o Setup. `farol-bandeja.exe`: spec pronto, build pendente (o código-fonte já está pronto, ver item de 14/10 abaixo).
- [x] Terminal interativo (ver "Automação" abaixo). Resto das ferramentas remotas (processos, serviços, arquivos,
  registro, eventos, **tela remota**) continua pendente — próximos itens do ROADMAP-DATTO.md depois de patches.
- [x] Automação — ver seção própria abaixo (2026-10-14): jobs agendados, resposta automática a alerta, grupos
  dinâmicos + UDFs, políticas. Pendente só a resposta a ransomware (ROADMAP-DATTO.md, item 1).
- [ ] Patches (Windows Update, apt/dnf), software (winget), relatórios, dashboards
- [x] Usuários/RBAC: módulo `usuarios` — convite por link (sem senha provisória), redefinição de senha por link do
  admin, papéis fixos (admin/técnico/leitura) já existentes desde a etapa 1. Testado (convite, duplicata,
  redefinição, token inválido/expirado).
- [ ] Notificações por e-mail/Teams/Discord nativas (hoje só webhook genérico — Discord/Slack/ntfy via isso). Demo
  atualizada na vitrine.
- [x] Licenças e site de vendas: módulo `licenca` no servidor (chave Ed25519 `FAROL-<payload>.<assinatura>` verificada offline; grátis até 5 dispositivos; carência de 7 dias; aviso 15 dias antes; recusa de registro com HTTP 402 via serviço `licenca.verificarRegistro()` chamado pelo módulo agentes; Configurações → Licença e aviso na visão geral), `servidor/scripts/emitir-licenca.js`, 62 testes do servidor passando. Site em `site/` (HTML/CSS/JS puro + funções Vercel: checkout Stripe, webhook, licença por sessão, contato; Blob privado), publicado em https://farol-rmm.vercel.app (projeto Vercel `farol-rmm`, time coube-studio; deploy sempre de cópia fora do repo, ver README). Pendente do dono: variáveis `STRIPE_*`, `LICENCA_CHAVE_PRIVADA`, `BLOB_READ_WRITE_TOKEN` e o webhook do Stripe. Chave privada e licença do dono em `..arol-segredos\` (fora do repo).

## Etapa 2 — passagem de qualidade (2026-10-14)
Sessão única terminando o que ficou pela metade de agentes anteriores + fechando os gaps críticos. Tudo testado de
ponta a ponta contra servidor/agente/bandeja **temporários** (nunca o servidor real :8420 nem o agente real deste PC).
- [x] **2FA com QR Code real**: gerador de QR em JS puro (`painel/js/modulos/configuracoes/qr-encode.js` + `qr-svg.js`,
  ISO/IEC 18004 completo — Reed-Solomon, máscaras, informação de formato/versão), renderizado como SVG preto sobre
  branco. A URI `otpauth://` nunca sai do navegador. Testado com `jsqr` (leitor real) decodificando de volta em
  vários tamanhos de chave/usuário, e confirmado visualmente (QR nítido, 2FA ativado de ponta a ponta).
- [x] **Janelas de manutenção + exceções de alerta por agente**: já estava quase pronto no servidor
  (`alertas/index.js`); terminei e testei (10 testes: supressão, expiração, cancelamento, overrides). Construí a
  parte do painel que faltava inteira: cartão "Manutenção" e "Exceções de alerta" na aba Alertas do dispositivo,
  seção "Janelas de manutenção" em Configurações, badge "Manut." na lista de dispositivos. Testado ao vivo: janela
  curta, CPU forçada acima do limite, supressão confirmada (0 no resumo, 0 webhook), cancelamento destrava na hora.
- [x] **Detecção de shell incompatível**: agente reporta no check-in quais interpretadores existem de verdade
  (`interpretador:cmd|powershell|bash|sh|python3`, via `shutil.which`), falha rápido com mensagem acionável (como
  instalar o que falta) em vez do erro genérico do `subprocess`. Painel avisa na gaveta "Executar script" quando
  algum dispositivo selecionado não tem o interpretador do script. 8 testes novos no agente.
- [x] **Retenção de métricas em camadas (downsampling)** — maior item novo, não tinha nada pronto: granularidade
  fina (1 ponto/min) só por 48 h; três tarefas periódicas agregam em 15 min (14 dias)/1 h (90 dias)/1 dia (365 dias),
  cada balde com min/max/média/p95 calculados sempre a partir do dado cru. Poda nunca apaga dado que uma camada
  ainda não processou. A rota de histórico escolhe a granularidade certa pelo período pedido. 7 testes novos + teste
  de carga real (50 agentes × 7 dias × 1 ponto/min = 504 mil linhas): inserção 3,4 s, agregação do backlog inteiro
  6,8 s, poda reduz o cru de 504 mil pra 144 mil linhas em 2 s, banco cai de 83,5 MB pra 29 MB após VACUUM manual.
  Consulta de 30 dias já agregada: 3,7 ms. Gráfico de 30/90 dias confirmado no painel.
- [x] **Bandeja do Windows**: revisei e terminei ~2200 linhas que já existiam (ícone pystray com status
  verde/cinza/laranja, janela pywebview com fallback no navegador, abas Sistema/Chamados/Novo chamado, API local
  127.0.0.1:8421 com token/Host/Origin). Achei e corrigi um bug real: a API local não mandava cabeçalhos CORS nem
  respondia `OPTIONS` — o caminho sem pywebview (navegador padrão, que o próprio código já previa como alternativa)
  falhava com "Failed to fetch" em qualquer chamada autenticada. Também liguei os recursos configuráveis
  (chamados/print/ações-rápidas) que o painel já ia expor mas a bandeja ainda ignorava, e corrigi um `.btn[hidden]`
  que não escondia (CSS `display:flex` vencendo o `display:none` do atributo `hidden` — mesmo bug que
  `.painel[hidden]` já tratava). 85 testes do agente (78 + 7 de CORS). Testado com agente real + bandeja real contra
  servidor temporário: abriu chamado pela API local, confirmou que chegou no painel.
- [x] **Interface de chamados no painel** — gap crítico: o backend (`servidor/src/modulos/chamados`) estava
  commitado há tempo sem nenhuma tela. Módulo novo `painel/js/modulos/chamados/`: lista com filtros e ação em
  massa, tela de conversa em linha do tempo com prints ampliáveis, aba no dispositivo, widget na Visão Geral, seção
  "Bandeja do agente" em Configurações. Acrescentei o filtro `?agente=` que faltava em `GET /api/chamados` pra aba
  do dispositivo funcionar. Testado de ponta a ponta: responder pelo painel fecha o ciclo aberto pela bandeja.
- [x] **Passagem de qualidade visual completa**: todas as telas (Visão Geral, Dispositivos, as 8 abas do detalhe,
  Biblioteca, Scripts, Execuções, Alertas, Auditoria, todas as seções de Configurações, #/estilo) em 1440px e 500px,
  claro e escuro, Edge headless com log de console. Zero erro de console em qualquer combinação. Achei e corrigi 3
  problemas reais: ações de auditoria dos módulos novos apareciam como `snake_case` cru (faltavam no `ROTULOS` de
  `painel/js/modulos/auditoria/index.js`); "Windows Windows 11 Pro" duplicado no painel lateral do chamado; coluna
  Status meio apertada na lista de chamados. Confirmei que o CSS responsivo (`.dividido`, tabela virtual) e os
  tokens de tema claro/escuro funcionam sem ajuste nenhum pros módulos novos, por terem reaproveitado só
  componentes existentes (nenhum CSS novo em `painel/css/` — proibido pelas regras de módulo).
- [x] Testes completos: 87 testes do servidor (`npm test`), 85 do agente (1 skip esperado no Windows), validador da
  biblioteca com 0 erros (551 scripts). README.md e este arquivo atualizados.

## Etapa 2 — Automação (2026-10-14, continuação)
Sessão seguinte, mesmo padrão (tudo contra servidor/agente temporários, nunca o :8420 real nem o agente real deste
PC). Ordem: A) terminal interativo, B) automação — prioridade máxima explícita do usuário ("quero o melhor RMM do
mundo, com automações").
- [x] **A — Terminal interativo**: faltava o lado do agente inteiro (a reivindicação anterior de que já existia era
  falsa — conferido, não existia). Módulo `agente/farol/modulos/terminal.py` novo: shell de verdade (PowerShell/cmd/
  bash/sh conforme o SO) sobre a sessão de relay já existente, sem PTY (local-echo no painel, documentado como
  limitação — sem suporte a apps de tela cheia tipo vim/htop). `painel/js/modulos/dispositivos/terminal.js` novo:
  parser ANSI/SGR, aviso de gravação. Corrigido um bug real durante o teste: `cmd.exe` herdava a code page OEM da
  máquina e saía com acento quebrado ("vers?o"); corrigido mandando `chcp 65001` automaticamente logo após abrir.
  Testado ao vivo: comandos reais (`dir`, `whoami`, `echo`) com saída correta, CTRL+C encerrando o processo sem
  matar o agente. 7 testes novos no agente, 2 no servidor (permissão/2FA).
- [x] **B1 — Jobs agendados**: módulo `agendamentos` novo (intervalo em minutos ou cron de 5 campos,
  `servidor/src/modulos/agendamentos/cron.js`, busca força-bruta minuto a minuto até 2 anos à frente). Nunca duplica
  a entrega ao agente — o disparo (tarefa periódica a cada 20s) sempre chama a mesma `jobs.executar()` da execução
  manual (extraída para `ctx.servicos.jobs.resolverScript()`/`.executar()`, reaproveitada também por B2/B4). Painel
  em Automação → Agendamentos, atalho "Agendar..." em Meus scripts/Biblioteca. **Achado e corrigido durante o teste
  visual**: `ui/camadas.js` → `gaveta()` fazia `painel.append(..., rodape ? h(...) : null)` — `Element.append(null)`
  cria um nó de texto "null" visível; já afetava TODA gaveta sem rodapé em produção (inclusive "Executar script").
  14 testes novos. **Testado ao vivo com relógio de parede real** (sem simular): agendamento "a cada 1 minuto"
  disparou sozinho 60s depois — tarefa periódica real, `setInterval` real —, criou o job, o agente (fake, só HTTP)
  buscou pelo check-in normal, reportou resultado, reagendou a próxima rodada.
- [x] **B2 — Resposta automática a alerta**: cada tipo de regra (cpu/ram/disco/offline) ganha um script de resposta
  opcional, disparado só na ABERTURA do alerta (não a cada atualização de um já aberto), com limite de repetição
  configurável (anti-flapping) e suprimido durante manutenção — mesma regra do webhook. Fogo-e-esquece, sempre
  auditado (sucesso ou falha), uma falha nunca derruba o alerta em si. Painel em Configurações → Respostas
  automáticas (reaproveita o seletor de script de "Executar script"). 8 testes novos. **Testado ao vivo**: CPU alta
  de verdade por 4 check-ins reais (regra padrão) abriu o alerta sozinho, a resposta configurada disparou sozinha
  (nada forçado na mão), job real na fila do agente marcado `criado_por: "sistema (resposta a alerta)"`.
- [x] **B3 — Grupos dinâmicos + campos personalizados (UDFs)**: módulo `grupos` novo. Um grupo guarda só um filtro
  (SO, site/cliente, nome contém, tag, campo personalizado) — nunca uma lista de membros — e é resolvido de novo a
  cada uso, registrado como um novo tipo de alvo (`ctx.alvos.registrar('grupo', ...)`, já previsto no comentário do
  núcleo). UDFs tipados (texto/número/booleano/seleção) + tags livres, editáveis na nova aba "Campos" do
  dispositivo. Painel em Gerenciar → Grupos, com prévia ao vivo no formulário (conta e lista quem bate com o filtro
  antes mesmo de salvar). 9 testes novos. **Testado ao vivo o ponto central** (dinâmico de verdade): criado um grupo
  "Windows" com 1 dispositivo, registrado um SEGUNDO dispositivo Windows depois — sem tocar no grupo — e ele passou
  a aparecer sozinho, tanto na API quanto na prévia ao vivo do painel.
- [x] **B4 — Políticas**: módulo `politicas` novo. Um pacote nomeado de exceções de alerta + moldes de agendamento,
  aplicado de uma vez a um alvo (agente/site/cliente/todos/grupo) — nunca reinventa nada, só chama
  `ctx.servicos.alertas.definirOverride()` e `ctx.servicos.agendamentos.criar()/atualizar()` (extraídos de
  PUT /api/alertas/overrides e POST/PUT /api/agendamentos pra virarem serviços reaproveitáveis). Reaplicar no mesmo
  alvo ATUALIZA os agendamentos já criados em vez de duplicar (`politicas_agendamentos` rastreia por
  política+alvo+índice do molde). Painel em Automação → Políticas. **Achado e corrigido durante o teste visual**:
  `lista.js` tinha um parêntese de fechamento faltando (faltava fechar o `preencher()` mais externo) — `SyntaxError`
  que `node --check arquivo.js` não detecta (não força o modo módulo/estrito); só apareceu no navegador de verdade.
  Revalidei TODOS os arquivos do painel desta sessão com `node --input-type=module --check`, que reproduz o parser
  real — só esse tinha o problema. 7 testes novos. **Testado ao vivo**: política com exceção de CPU (75%/2 ciclos) +
  agendamento aplicada em "todos os dispositivos" — overrides gravados de verdade nos 2 dispositivos (conferido via
  GET /api/alertas/overrides), agendamento real disparando pelo agendador de verdade, reaplicar confirmado como
  idempotente (atualiza, não duplica), aplicação num grupo dinâmico confirmado afetando só quem bate com o filtro.
- [x] **Bug real de produção corrigido no meio do lote** (achado pelo usuário testando o instalador de verdade
  nesta máquina): o instalador registrava o dispositivo no servidor (token consumido, config.json gravado) mas
  NADA ficava rodando depois — nem serviço nem Tarefa Agendada —, e não existia log nenhum pra diagnosticar. Causas
  reais: `logging.basicConfig()` nunca escrevia em arquivo (só console, invisível numa instalação via Setup/
  `/VERYSILENT`); `_instalar_servico()`/`_instalar_tarefa()` só tratavam `ErroInstalacao`, uma exceção crua do
  pywin32/SCM escapava sem virar mensagem legível; e não havia fallback de verdade entre serviço e Tarefa Agendada
  — se o modo escolhido falhasse, a instalação só parava ali. Corrigido: `agente.log` sempre gravado (cai pra
  `%TEMP%` se não der), `except Exception` final no `main()`, qualquer exceção do SCM/schtasks vira `ErroInstalacao`
  com o motivo real, fallback automático serviço↔tarefa sem `--modo` explícito, e nunca mais um "sucesso" silencioso
  — se os dois falharem, código de saída ≠ 0 com mensagem explicando os dois motivos e como rodar manualmente.
  8 testes novos. **Testado com chamadas reais** (não só mockadas): com `eh_admin()` forçado `True` neste shell sem
  privilégio de admin de verdade, o serviço falhou com "Acesso negado" de verdade (`OpenSCManager`), caiu pra Tarefa
  Agendada, que também falhou de verdade (schtasks "Acesso negado") — log em arquivo, código de saída 5, nada
  instalado no sistema. Build real via `build.ps1`: o exe sem admin pede elevação UAC de verdade (confirmado:
  `consent.exe` real na tela, não deu pra fechar programaticamente sem admin — dispensado manualmente depois).
  Não testado o caminho COM admin de verdade (ambiente sem como aprovar UAC interativamente) — limitação honesta.
- [x] **QA visual consolidada de A + B1-B4**: todas as telas novas (Agendamentos, Respostas automáticas, Grupos,
  aba Campos do dispositivo, Campos personalizados, Políticas) em 1440px e 500px, claro e escuro, Edge headless,
  navegação completa por TODAS as rotas (novas + antigas) numa sessão só. Zero erro de console/página em qualquer
  combinação depois dos dois bugs acima corrigidos.
- [x] Testes completos: 125 testes do servidor (`npm test`, eram 87), 100 do agente (eram 85, 1 skip esperado no
  Windows). ROADMAP-DATTO.md, README.md e este arquivo atualizados.

## Etapa 2 — Bandeja (crash real) + Tela remota (2026-10-14, continuação)
Sessão seguinte: dois bugs reais de produção encontrados pelo usuário testando nesta máquina, corrigidos com
prioridade máxima; depois a funcionalidade mais aguardada pelo usuário, tela remota, construída do zero.
- [x] **Bug real de produção corrigido primeiro**: ícone da bandeja sumia e o processo morria ao fechar a janela
  pelo X (não pelo "Sair" do menu) — confirmado pelo usuário ao vivo ("consegui abrir, agora sumiu de novo"; nenhum
  `farol_bandeja.py` rodando depois). Causa real: `JanelaWebview._ao_fechar()` chamava `self.janela.hide()`
  SINCRONAMENTE dentro do handler `closing` do pywebview — o `Event.set()` do pywebview roda os handlers de forma
  síncrona e só decide cancelar o fechamento DEPOIS que todos terminam; chamar `hide()` ali no meio corrompe essa
  decisão e a janela fecha de verdade apesar do handler devolver `False`. Corrigido adiando o `hide()` por 50ms via
  `threading.Timer`, fora do handler. 3 testes novos (`test_bandeja_janela.py`). **Testado ao vivo o fluxo exato
  pedido**: ícone aparece → clique abre a janela → fechar pelo X (WM_CLOSE real na HWND real) → ícone CONTINUA lá e
  o processo CONTINUA vivo, confirmado antes/depois por PID exato (sem matar processo nenhum do usuário — só o de
  teste, por PID rastreado).
- [x] **Tela remota** — construída em ordem (cada etapa testada e commitada antes da próxima), reaproveitando a
  infraestrutura de relay do terminal: 1) captura de tela (`mss`) → relay (só visualização); 2) canvas no painel com
  fps/qualidade configuráveis; 3) controle de mouse/teclado injetado via `ctypes`/`user32.dll`; 4) segurança (2FA/
  elevação, auditoria, aviso à pessoa na frente da máquina via bandeja, limitação documentada em sistemas não-
  Windows); 5) limite de 1 sessão simultânea por dispositivo. Duas primitivas novas e genéricas no núcleo do relay
  (`servidor/src/nucleo/relay.js`): `maxPorAgente` (limite de sessões simultâneas por tipo+agente) e `aoAbrir`
  (callback disparado quando uma sessão abre — usado aqui pra mandar `tela.notificar` à bandeja, best-effort).
  Módulos novos: `servidor/src/modulos/tela/index.js`, `agente/farol/modulos/tela.py`,
  `painel/js/modulos/dispositivos/tela-remota.js`. 4 testes novos no servidor, 10 no agente (captura e injeção de
  cursor reais nesta máquina, não mock). **Testado de ponta a ponta com agente REAL** (processo python de verdade,
  não um stand-in HTTP): servidor e agente temporários, painel real no Edge headless clicando em "Tela remota",
  quadro JPEG de verdade desenhando no canvas (screenshot confirmado), e um `mousemove` disparado pelo painel
  movendo o cursor real desta máquina ~125px (confirmado via `GetCursorPos`/`Cursor.Position`) — prova a cadeia
  completa navegador → WebSocket → relay → agente → `user32.dll` → cursor do SO. Zero erros de console. Controle de
  teclado foi construído e testado só por unidade (guarda de código inválido); o pipeline de controle é o mesmo do
  mouse, já provado ao vivo.
- [x] Testes completos: 129 testes do servidor (eram 125), 114 do agente (eram 100, 1 skip esperado no Windows).
  ROADMAP-DATTO.md, README.md e este arquivo atualizados.

## Para retomar
Ler este arquivo, ARQUITETURA.md e `git log`. Itens não marcados: relançar o agente correspondente.
Não publicar: push e deploy só depois de revisar. Netlify está em ~75% dos créditos do mês — evitar deploys; considerar mover a vitrine para GitHub Pages.
Próximo item óbvio (ROADMAP-DATTO.md): patch management (item 2) + software em lote (item 3).
