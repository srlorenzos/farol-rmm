#!/usr/bin/env bash
# ---
# id: mon-linux-docker-containers
# nome: "Monitor - containers Docker"
# descricao: "Verifica containers parados inesperadamente ou unhealthy; opcionalmente exige containers específicos em execução."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [docker, monitor]
# variaveis:
#   - nome: OBRIGATORIOS
#     rotulo: "Nomes de containers obrigatórios (vírgula)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }

command -v docker >/dev/null 2>&1 || { f_status ok "Docker não instalado"; exit 0; }
docker info >/dev/null 2>&1 || { f_status critico "Daemon Docker inacessível"; exit 0; }
ruins=$(docker ps -a --filter health=unhealthy --format '{{.Names}}' | tr '\n' ' ')
falta=""
for c in $(printf '%s' "$FAROL_OBRIGATORIOS" | tr ',' ' '); do
  f_nome_ok "$c" || continue
  [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ] || falta="$falta $c"
done
reinicios=$(docker ps --format '{{.Names}} {{.Status}}' | grep -c 'Restarting')
if [ -n "$falta" ]; then f_status critico "Containers parados:$falta"
elif [ -n "$ruins" ]; then f_status alerta "Containers unhealthy: $ruins"
elif [ "$reinicios" -gt 0 ]; then f_status alerta "$reinicios container(s) em loop de reinício"
else f_status ok "$(docker ps -q | wc -l) container(s) em execução"; fi
exit 0
