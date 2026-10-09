#!/usr/bin/env bash
# ---
# id: mon-linux-processo
# nome: "Monitor - processo em execução"
# descricao: "Verifica se um processo (por nome exato) está em execução."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [processos, monitor]
# variaveis:
#   - nome: PROCESSO
#     rotulo: "Nome do processo"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }

p="$FAROL_PROCESSO"
f_nome_ok "$p" || { echo "Nome inválido."; exit 2; }
if pgrep -x "$p" >/dev/null 2>&1; then f_status ok "Processo $p em execução ($(pgrep -x "$p" | wc -l) instância(s))"; else f_status critico "Processo $p não encontrado"; fi
exit 0
