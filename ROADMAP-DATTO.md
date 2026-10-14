# Roteiro: paridade com o Datto RMM

Objetivo do produto (2026-10-14): o Farol deve ter tudo que o Datto RMM tem, com foco
especial em **automação de verdade** (não só "rodar script sob demanda"). Levantado a
partir de datto.com/pt-br/products/rmm/features/ e da comparação da Kaseya com o
N-able — são páginas de marketing do fornecedor, então o texto abaixo já filtra isso
e organiza em recursos concretos e implementáveis, não em frases de venda.

Isto é um roteiro para as PRÓXIMAS etapas, depois que a Etapa 2 (ver PROGRESSO-V2.md)
estiver sólida e testada. Não lançar agentes para isto ainda.

## O que o Farol já tem (Etapa 1 + 2)
Monitoramento em tempo real, alertas por limiar com webhook, janelas de manutenção
e overrides por agente, 551 scripts na biblioteca com variáveis tipadas, RBAC (3
papéis), 2FA com QR, terminal remoto auditado, chamados/helpdesk com bandeja no
Windows, licenciamento e site de vendas, instaladores .exe.

## O que falta para paridade real com o Datto (por categoria, igual à pesquisa)

### 1. Automação — PRIORIDADE MÁXIMA (o usuário pediu explicitamente)
Hoje o Farol só executa script sob pedido manual. O Datto tem automação de verdade:
- **Monitores viram gatilhos de automação**: quando um monitor entra em alerta, disparar
  automaticamente um script de resposta (ex. disco cheio → roda limpeza; serviço
  parado → reinicia o serviço), não só notificar. "Resposta automática" com registro
  de que foi automático na auditoria.
- **Jobs agendados** (cron por agente/site/grupo): rodar um script toda terça às 22h,
  todo dia às 3h, etc. Reaproveitar o `ctx.agendador` do núcleo.
- **Políticas**: um conjunto de regras (quais monitores, quais limiares, quais scripts
  de resposta, qual agenda de patch) aplicado a um SITE ou GRUPO inteiro, não por
  máquina. Mudar a política do grupo muda todas as máquinas nele.
- **Grupos dinâmicos por filtro**: um grupo cuja lista de membros é calculada por uma
  condição (SO = Windows Server, site = X, tag = "financeiro"), e quando uma máquina
  nova bate com o filtro, herda a política automaticamente — sem ação manual.
- **UDFs (campos customizados tipados)** por dispositivo, usáveis nos filtros de grupo.
- **Resposta a ransomware**: um monitor especializado (padrão de I/O de disco anômalo
  + extensões suspeitas) que isola a máquina da rede (desliga a placa de rede via
  comando do agente) e tenta encerrar o processo, com confirmação/auditoria forte
  (isto é uma ação destrutiva — exige 2FA e fica bem documentado).

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

### 4. Ferramentas remotas (parte já existe: terminal)
- Processos: listar e matar processo remoto.
- Serviços: listar, iniciar/parar/reiniciar, mudar tipo de inicialização.
- Arquivos: navegador de arquivos remoto básico (listar, baixar, enviar) — cuidado
  redobrado de segurança aqui (é a superfície mais perigosa).
- Registro do Windows: ler/editar chaves (também sensível, exigir 2FA/confirmação).
- Visualizador de eventos remoto (Application/System/Security, os últimos N).
- **Tela remota com controle** (o item que falta do "acesso remoto com um clique" do
  Datto): WebRTC ou um protocolo próprio sobre o relay já existente; maior esforço
  de todo o roteiro, avaliar depois de automação/patch estarem prontos.

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
1. **Automação** (item 1) — é o pedido explícito do usuário, maior valor.
2. Patch management (item 2) + software em lote (item 3).
3. Ferramentas remotas que faltam, exceto tela remota (item 4, sem o controle de tela).
4. Descoberta de rede (item 5).
5. Relatórios agendados (item 7).
6. Tela remota com controle (item 4, parte pesada) — maior esforço de engenharia.
7. IA/insights (item 8), API com chaves escopadas (item 9).
8. M365/Intune (item 6) e conformidade expandida (item 11) — conforme demanda real.

Cada etapa segue o mesmo padrão já estabelecido: módulo no núcleo (ARQUITETURA.md),
testes reais, screenshot revisado, sem tocar no servidor/agente reais do usuário.
