#!/usr/bin/env bash
# ---
# id: docker-limpar-recursos
# nome: "Docker - limpar containers, imagens e redes não usados"
# descricao: "Remove containers parados, redes e imagens órfãs (dangling) e, opcionalmente, todas as imagens não usadas. Simulação por padrão."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [docker, limpeza]
# variaveis:
#   - nome: TODAS_IMAGENS
#     rotulo: "Remover todas as imagens não usadas"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_simular() { case "$(printf '%s' "$FAROL_SIMULAR" | tr 'A-Z' 'a-z')" in 0|false|nao|não|n|no|falso) return 1;; *) return 0;; esac; }

command -v docker >/dev/null 2>&1 || { echo "Docker não instalado."; exit 1; }
docker system df
if f_simular; then
  echo "SIMULAÇÃO. Seriam removidos:"; docker ps -a --filter status=exited --format '  container {{.Names}}'; docker images -f dangling=true --format '  imagem {{.ID}}'; echo "(SIMULAR=false para aplicar)"; exit 0
fi
docker container prune -f
docker network prune -f
if f_sim "$FAROL_TODAS_IMAGENS"; then docker image prune -a -f; else docker image prune -f; fi
docker system df
exit 0
