#!/usr/bin/env bash
# ---
# id: systemd-listar-servicos
# nome: "systemd - listar serviços e estado"
# descricao: "Lista serviços em execução, habilitados na inicialização e com falha."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [systemd]
# variaveis:
#   - nome: FILTRO
#     rotulo: "Mostrar"
#     tipo: selecao
#     padrao: "executando"
#     obrigatorio: false
#     opcoes: [executando, habilitados, falhos]
# ---

case "$FAROL_FILTRO" in
  habilitados) systemctl list-unit-files --type=service --state=enabled --no-pager;;
  falhos) systemctl --failed --no-pager;;
  *) systemctl list-units --type=service --state=running --no-pager;;
esac
exit 0
