#!/usr/bin/env bash
# ---
# id: docker-reiniciar-container
# nome: "Docker - reiniciar ou parar container"
# descricao: "Reinicia, para ou inicia um container pelo nome e mostra os últimos logs."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [docker]
# variaveis:
#   - nome: CONTAINER
#     rotulo: "Nome do container"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "restart"
#     obrigatorio: true
#     opcoes: [restart, stop, start, logs]
# ---
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }

c="$FAROL_CONTAINER"; f_nome_ok "$c" || { echo "Nome inválido."; exit 1; }
docker inspect "$c" >/dev/null 2>&1 || { echo "Container não encontrado."; exit 1; }
case "$FAROL_ACAO" in restart|stop|start) docker "$FAROL_ACAO" "$c";; esac
docker ps -a --filter "name=^${c}$" --format '{{.Names}}: {{.Status}}'
docker logs --tail 30 "$c" 2>&1
exit 0
