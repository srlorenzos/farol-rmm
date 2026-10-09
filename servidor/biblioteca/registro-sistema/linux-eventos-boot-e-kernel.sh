#!/usr/bin/env bash
# ---
# id: linux-eventos-boot-e-kernel
# nome: "Linux - reinicializações e mensagens do kernel"
# descricao: "Lista boots anteriores, motivo do último desligamento e erros do kernel do boot atual."
# categoria: Registro e logs do sistema
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [boot, kernel]
# variaveis: []
# ---

echo "== Boots registrados"; journalctl --list-boots --no-pager 2>/dev/null | tail -8 || last reboot | head -8
echo "== Últimos reinícios/desligamentos"; last -x reboot shutdown 2>/dev/null | head -8
echo "== Erros do kernel (boot atual)"; journalctl -k -p err -b --no-pager 2>/dev/null | tail -15 || dmesg --level=err,crit,alert,emerg | tail -15
exit 0
