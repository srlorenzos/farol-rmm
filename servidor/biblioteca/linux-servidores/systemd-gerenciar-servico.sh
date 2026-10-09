#!/usr/bin/env bash
# ---
# id: systemd-gerenciar-servico
# nome: "systemd - iniciar, parar, reiniciar ou habilitar serviço"
# descricao: "Executa uma ação em um serviço systemd e mostra o status resultante."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 180
# requer_admin: true
# tags: [systemd, servicos]
# variaveis:
#   - nome: SERVICO
#     rotulo: "Nome do serviço"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "restart"
#     obrigatorio: true
#     opcoes: [start, stop, restart, reload, enable, disable, status]
# ---
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }

f_root
s="$FAROL_SERVICO"
f_nome_ok "$s" || { echo "Nome de serviço inválido."; exit 1; }
case "$FAROL_ACAO" in start|stop|restart|reload|enable|disable|status) ;; *) echo "Ação inválida."; exit 1;; esac
systemctl cat "$s" >/dev/null 2>&1 || { echo "Serviço não encontrado: $s"; exit 1; }
systemctl "$FAROL_ACAO" "$s" --no-pager
rc=$?
systemctl status "$s" --no-pager -n 5 2>&1 | head -12
exit $rc
