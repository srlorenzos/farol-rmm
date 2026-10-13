# Progresso — Farol RMM v2

Objetivo: RMM completo no nível do Datto RMM (funções + visual premium), identidade própria.

## Etapa 1 (em andamento, 2026-10-09)
- [x] Base modular + revisão + visual premium: núcleo modular, RBAC, alvos, relay WS (job em ~300 ms), agente em pacote, design system, Ctrl+K, todas as telas. 53 testes servidor + 26 agente; e2e ok; screenshots revisados. Pendente: `painel/DESIGN.md` e README "Como usar" da v2.
- [x] Biblioteca: 551 scripts (393 Windows, 141 Linux, 21 macOS; 88 monitores) em 31 categorias, validador com 0 erros, sintaxe ok (PS/bash/py), 97 scripts Windows executados de verdade sem erro. Linux/macOS só checados por sintaxe. `.ps1` em UTF-8 com BOM (o carregador precisa tolerar). Gerador fora do repo: scratchpad `gen.mjs` + `b/*.txt`.

## Etapa 2 (depois da etapa 1, em paralelo, cada um num módulo)
- [ ] Sites/grupos/filtros, descoberta de rede
- [x] Instaladores Windows (empacotamento/): `farol-agente.exe` (PyInstaller; build em pasta para o serviço pywin32 "Farol RMM Agent", build de arquivo único com Tarefa Agendada como plano B), `FarolAgenteSetup.exe` (Inno Setup, `/VERYSILENT /SERVIDOR= /TOKEN=`), `farol-servidor.exe` (Node SEA, node:sqlite ok, assets embutidos), ícone multi-resolução, versão única em `empacotamento/VERSION`, `build.ps1`, workflow `release.yml` (tag `v*`, assinatura opcional) e comando silencioso na API de tokens/painel. Testado: exes contra servidor temporário (registro, check-in, `modulos`, `status`), SEA servindo painel/biblioteca/.pyz. NÃO testado por falta de administrador: criar serviço de verdade, UAC, rodar o Setup. `farol-bandeja.exe`: spec pronto, depende de `agente/farol_bandeja.py` (outro agente); rebuildar quando existir.
- [ ] Ferramentas remotas: processos, serviços, arquivos, registro, eventos, terminal, tela remota
- [ ] Automação: jobs agendados, políticas de monitoramento, auto-resposta
- [ ] Patches (Windows Update, apt/dnf), software (winget), relatórios, dashboards
- [ ] Usuários/RBAC, notificações (e-mail/Teams/Discord), demo atualizada na vitrine

## Para retomar
Ler este arquivo, ARQUITETURA.md e `git log`. Itens não marcados: relançar o agente correspondente.
Não publicar: push e deploy só depois de revisar. Netlify está em ~75% dos créditos do mês — evitar deploys; considerar mover a vitrine para GitHub Pages.
