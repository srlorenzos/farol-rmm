#!/usr/bin/env bash
# ---
# id: mon-linux-atualizacoes-seguranca
# nome: "Monitor - atualizações pendentes"
# descricao: "Conta pacotes com atualização disponível (apt/dnf/yum/zypper) e alerta pelos limites."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 180
# requer_admin: false
# tags: [atualizacoes, patches, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (qtde)"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (qtde)"
#     tipo: numero
#     padrao: 50
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }

a=$(f_num "$FAROL_ALERTA" 10); c=$(f_num "$FAROL_CRITICO" 50)
case "$(f_pm)" in
  apt) n=$(apt-get -s upgrade 2>/dev/null | grep -c '^Inst ');;
  dnf) n=$(dnf -q check-update --refresh 2>/dev/null | grep -Ec '^[A-Za-z0-9_.+-]+\.[A-Za-z0-9_]+ +[0-9]');;
  yum) n=$(yum -q check-update 2>/dev/null | grep -Ec '^[A-Za-z0-9_.+-]+\.[A-Za-z0-9_]+ +[0-9]');;
  zypper) n=$(zypper -q lu 2>/dev/null | grep -c '^v ');;
  *) f_status alerta "Gerenciador de pacotes não suportado"; exit 0;;
esac
msg="$n pacote(s) com atualização pendente"
if [ "$n" -ge "$c" ]; then f_status critico "$msg"; elif [ "$n" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
