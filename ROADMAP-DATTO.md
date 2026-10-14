# Roteiro: paridade com o Datto RMM

Objetivo do produto (2026-10-14): o Farol deve ter tudo que o Datto RMM tem, com foco
especial em **automação de verdade** (não só "rodar script sob demanda"). Levantado a
partir de datto.com/pt-br/products/rmm/features/ e da comparação da Kaseya com o
N-able — são páginas de marketing do fornecedor, então o texto abaixo já filtra isso
e organiza em recursos concretos e implementáveis, não em frases de venda.

Isto é um roteiro para as PRÓXIMAS etapas, depois que a Etapa 2 (ver PROGRESSO-V2.md)
estiver sólida e testada. Não lançar agentes para isto ainda.

## O que o Farol já tem (Etapa 1 + 2 + Automação)
Monitoramento em tempo real, alertas por limiar com webhook, janelas de manutenção
e overrides por agente, 551 scripts na biblioteca com variáveis tipadas, RBAC (3
papéis), 2FA com QR, terminal interativo remoto auditado, tela remota com controle de
mouse/teclado, chamados/helpdesk com bandeja no Windows, licenciamento e site de
vendas, instaladores .exe, downsampling de métricas em camadas. E agora (ver
"Automação" abaixo): jobs agendados (cron/intervalo), resposta automática a alerta,
grupos dinâmicos + campos personalizados (UDFs), e políticas (exceções de alerta +
agendamentos aplicados de uma vez a um site/grupo).

## O que falta para paridade real com o Datto (por categoria, igual à pesquisa)

### 1. Automação — PRIORIDADE MÁXIMA (o usuário pediu explicitamente)
Hoje o Farol só executa script sob pedido manual. O Datto tem automação de verdade:
- ✅ **Feito** — **Monitores viram gatilhos de automação**: quando um alerta (CPU/RAM/
  disco/offline) abre pela primeira vez, dispara automaticamente um script de resposta
  configurado por tipo, com limite de repetição (anti-flapping), auditado como
  automático (`alerta_resposta_disparada`/`alerta_resposta_falhou`). Configuração em
  Configurações → Respostas automáticas (`servidor/src/modulos/alertas/index.js`,
  `dispararRespostaAutomatica`).
- ✅ **Feito** — **Jobs agendados** (cron de 5 campos ou intervalo em minutos, por
  agente/site/cliente/todos/grupo): módulo `agendamentos`, reaproveita `ctx.agendador`
  e a mesma entrega de `jobs.executar()` da execução manual. Painel em Automação →
  Agendamentos, com atalho "Agendar..." a partir de Scripts/Biblioteca.
- ✅ **Feito** — **Políticas**: um pacote nomeado de exceções de alerta (overrides por
  tipo) + moldes de agendamento, aplicado de uma vez a um alvo (agente/site/cliente/
  todos/grupo). Reaplicar no mesmo alvo atualiza em vez de duplicar os agendamentos.
  Módulo `politicas`, nunca reinventa `alertas`/`agendamentos` — só chama os serviços
  deles. Painel em Automação → Políticas.
- ✅ **Feito** — **Grupos dinâmicos por filtro**: um grupo guarda só um filtro (SO,
  site/cliente, nome contém, tag, campo personalizado) e é resolvido de novo a cada
  uso — um dispositivo novo que bate com o filtro aparece sozinho, sem editar nada.
  Registrado como um novo tipo de alvo (`ctx.alvos.registrar('grupo', ...)`), então já
  funciona em execução manual, agendamentos e políticas sem nenhum código extra.
  Módulo `grupos`, painel em Gerenciar → Grupos (com prévia ao vivo no formulário).
- ✅ **Feito** — **UDFs (campos customizados tipados)** por dispositivo (texto/número/
  booleano/seleção) + tags livres, editáveis na aba "Campos" do dispositivo, usáveis
  como dimensão de filtro de grupo dinâmico. Mesmo módulo `grupos`.
- ⬜ **Não feito** — **Resposta a ransomware**: um monitor especializado (padrão de I/O
  de disco anômalo + extensões suspeitas) que isola a máquina da rede (desliga a placa
  de rede via comando do agente) e tenta encerrar o processo, com confirmação/auditoria
  forte (ação destrutiva — exige 2FA e fica bem documentada). Deixado de fora de
  propósito: é um monitor/resposta especializados de verdade (detecção de padrão, não
  só limiar), merece o próprio ciclo de design + teste, não cabia no mesmo lote das
  automações "genéricas" acima.

### 2. Patch management
- Windows Update: listar patches pendentes, aprovar/recusar por política, agendar
  janela de instalação, relatório de conformidade por dispositivo/site.
- Linux: apt/dnf upgrade como job agendado com relatório.
- Pontuação de severidade (se der para mapear CVE/CVSS dos patches do Windows, melhor;
  senão, usar a classificação que o próprio Windows Update já dá — crítico/importante).

### 3. Gerenciamento de software
- Inventário de software já existe (via biblioteca). Adicionar: instalar/atualizar/
  remover em lote via winget (Windows) e apt/dnf (Linux), com fila e relatório.
- "Advanced software management" do Datto é basicamente isso + lista maior de apps
  reconhecidos — não precisa replicar uma lista proprietária, só cobrir os apps comuns.

### 4. Ferramentas remotas (parte já existe: terminal + tela remota)
- Processos: listar e matar processo remoto.
- Serviços: listar, iniciar/parar/reiniciar, mudar tipo de inicialização.
- Arquivos: navegador de arquivos remoto básico (listar, baixar, enviar) — cuidado
  redobrado de segurança aqui (é a superfície mais perigosa).
- Registro do Windows: ler/editar chaves (também sensível, exigir 2FA/confirmação).
- Visualizador de eventos remoto (Application/System/Security, os últimos N).
- ✅ **Feito** — **Tela remota com controle** (o "acesso remoto com um clique" do
  Datto): protocolo próprio (JPEG via `mss`) sobre o relay já existente do terminal,
  não WebRTC — mais simples e reaproveita toda a infraestrutura de sessão/auditoria/
  2FA. Controle de mouse/teclado via `ctypes`/`user32.dll`, só Windows por ora (Linux/
  macOS mostram só a tela, documentado na UI). Aviso à pessoa na frente da máquina via
  bandeja, 1 sessão por dispositivo (`maxPorAgente` no núcleo do relay), auditada.
  Módulos `servidor/src/modulos/tela` e `agente/farol/modulos/tela.py`, painel em
  `painel/js/modulos/dispositivos/tela-remota.js`. Testado com agente real (captura e
  controle de verdade, não mock).

### 5. Descoberta de rede e inventário
- Varredura de rede local a partir de um agente (ARP/ping sweep + fingerprint básico)
  para achar dispositivos não gerenciados (impressoras, switches, IoT).
- Mapa visual simples da topologia (SVG, nós = dispositivos, arestas = mesma sub-rede).

### 6. Microsoft 365 / Intune
- Dado que o usuário já mexe com M365 em outros projetos: um módulo que usa Microsoft
  Graph (precisa de app registrado no Entra ID do cliente) para listar usuários,
  licenças, status de MFA, e dispositivos Intune associados, direto no painel do Farol.
  Escopo grande — avaliar demanda real antes de priorizar.

### 7. Relatórios e dashboards
- Relatórios agendados (PDF/e-mail) por site/cliente: uptime, patches aplicados,
  alertas do período, inventário.
- Dashboards configuráveis pelo usuário (arrastar widgets) — hoje os widgets existem
  mas o layout é fixo; permitir reordenar/esconder.

### 8. IA / insights em linguagem natural
- Um jeito de perguntar "quais dispositivos estão com pouco disco?" ou "o que mudou
  esta semana?" e receber resposta — isto é natural para o Farol, já que ele tem o
  mcp-pessoal como precedente: um endpoint que usa a API da Anthropic sobre os dados
  do próprio Farol (auditoria, métricas, alertas), ou até um servidor MCP do farol-rmm
  em paralelo ao mcp-pessoal existente.

### 9. API aberta
- REST API documentada, com chaves de API escopadas por site/grupo/dispositivo,
  revogáveis — não só a sessão do painel. Base para integrações futuras (PSA, etc).

### 10. Segurança / EDR
- Fora de escopo construir um EDR do zero. Caminho realista: um módulo de "status de
  segurança" que lê o que já existe na máquina (Windows Defender, firewall, BitLocker
  — scripts da biblioteca já fazem isso) e expõe como aba fixa no painel, com alerta
  quando algo está desligado. NÃO prometer detecção de ameaça própria.

### 11. Conformidade
- Já existem scripts CIS básicos na biblioteca (categoria compliance). Expandir para
  um "placar de conformidade" por dispositivo/site, não só scripts avulsos.

## Fora de escopo por ora (decisão consciente, não esquecimento)
- Integração com Autotask PSA, Datto BCDR, Datto WiFi — produtos de terceiros
  específicos do ecossistema Kaseya/Datto, sem equivalente a replicar.
- Certificação FIPS-140-3 — exige processo de certificação formal, não é código.
- App móvel nativo — o painel já é responsivo; um app dedicado é projeto à parte.

## Ordem sugerida das próximas etapas
1. ✅ **Automação** (item 1) — pedido explícito do usuário, maior valor. Feito: jobs
   agendados, resposta automática a alerta, grupos dinâmicos + UDFs, políticas.
   Pendente só a resposta a ransomware (monitor especializado, ciclo próprio).
2. ✅ **Tela remota com controle** (item 4, parte pesada) — feito antes do previsto,
   prioridade explícita do usuário (era a funcionalidade mais aguardada).
3. **Patch management (item 2) + software em lote (item 3) — próximo item.**
4. Ferramentas remotas que faltam (processos, serviços, arquivos, registro, eventos —
   resto do item 4).
5. Descoberta de rede (item 5).
6. Relatórios agendados (item 7).
7. IA/insights (item 8), API com chaves escopadas (item 9).
8. M365/Intune (item 6) e conformidade expandida (item 11) — conforme demanda real.

Cada etapa segue o mesmo padrão já estabelecido: módulo no núcleo (ARQUITETURA.md),
testes reais, screenshot revisado, sem tocar no servidor/agente reais do usuário.
