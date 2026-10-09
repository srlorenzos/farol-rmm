# Progresso — Farol RMM v2

Objetivo: RMM completo no nível do Datto RMM (funções + visual premium), identidade própria.

## Etapa 1 (em andamento, 2026-10-09)
- [~] Base modular + revisão + visual premium (agente arquiteto). FEITO e commitado: núcleo modular do servidor (módulos, migrações, RBAC, alvos, relay WS) com testes; agente como pacote `farol/` com canal WS; design system + shell + paleta Ctrl+K; todas as telas migradas para módulos do painel. FALTA (próxima janela): teste ponta a ponta, screenshots e refino visual, `painel/DESIGN.md`, README "Como usar", conferir ARQUITETURA.md.
- [x] Biblioteca: 551 scripts (393 Windows, 141 Linux, 21 macOS; 88 monitores) em 31 categorias, validador com 0 erros, sintaxe ok (PS/bash/py), 97 scripts Windows executados de verdade sem erro. Linux/macOS só checados por sintaxe. `.ps1` em UTF-8 com BOM (o carregador precisa tolerar). Gerador fora do repo: scratchpad `gen.mjs` + `b/*.txt`.

## Etapa 2 (depois da etapa 1, em paralelo, cada um num módulo)
- [ ] Sites/grupos/filtros, instalador do agente (.exe via PyInstaller), descoberta de rede
- [ ] Ferramentas remotas: processos, serviços, arquivos, registro, eventos, terminal, tela remota
- [ ] Automação: jobs agendados, políticas de monitoramento, auto-resposta
- [ ] Patches (Windows Update, apt/dnf), software (winget), relatórios, dashboards
- [ ] Usuários/RBAC, notificações (e-mail/Teams/Discord), demo atualizada na vitrine

## Para retomar
Ler este arquivo, ARQUITETURA.md e `git log`. Itens não marcados: relançar o agente correspondente.
Não publicar: push e deploy só depois de revisar. Netlify está em ~75% dos créditos do mês — evitar deploys; considerar mover a vitrine para GitHub Pages.
