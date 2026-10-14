#!/usr/bin/env bash
# ---
# id: cron-adicionar-tarefa
# nome: "cron - adicionar tarefa em /etc/cron.d"
# descricao: "Cria um arquivo em /etc/cron.d com uma tarefa agendada. Valida o formato do agendamento e executa como o usuário informado."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [cron, agendamento]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome do arquivo (id da tarefa)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: AGENDA
#     rotulo: "Agendamento cron (5 campos)"
#     tipo: texto
#     padrao: "0 3 * * *"
#     obrigatorio: true
#     opcoes: []
#   - nome: USUARIO
#     rotulo: "Usuário de execução"
#     tipo: texto
#     padrao: "root"
#     obrigatorio: false
#     opcoes: []
#   - nome: COMANDO
#     rotulo: "Comando"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
n="$FAROL_NOME"; ag="$FAROL_AGENDA"; u="${FAROL_USUARIO:-root}"; cmd="$FAROL_COMANDO"
printf '%s' "$n" | grep -Eq '^[A-Za-z0-9_-]{1,40}$' || { echo "Nome inválido."; exit 1; }
printf '%s' "$ag" | grep -Eq '^([0-9*/,-]+ +){4}[0-9*/,A-Za-z-]+$' || { echo "Agendamento inválido."; exit 1; }
id "$u" >/dev/null 2>&1 || { echo "Usuário inexistente."; exit 1; }
[ -n "$cmd" ] || { echo "Comando obrigatório."; exit 1; }
if ! f_confirmar; then echo "Criaria /etc/cron.d/farol-$n: $ag $u $cmd"; echo "Defina CONFIRMAR=true para aplicar."; exit 0; fi
printf '# Criado pelo Farol RMM\nSHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n%s %s %s\n' "$ag" "$u" "$cmd" > "/etc/cron.d/farol-$n"
chmod 644 "/etc/cron.d/farol-$n"
echo "Tarefa criada em /etc/cron.d/farol-$n"
exit 0
