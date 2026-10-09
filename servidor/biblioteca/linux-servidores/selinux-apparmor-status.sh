#!/usr/bin/env bash
# ---
# id: selinux-apparmor-status
# nome: "SELinux e AppArmor - status"
# descricao: "Mostra o modo do SELinux (getenforce) ou perfis do AppArmor carregados e negações recentes."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [selinux, apparmor]
# variaveis: []
# ---

if command -v getenforce >/dev/null 2>&1; then echo "SELinux: $(getenforce)"; command -v ausearch >/dev/null 2>&1 && { echo "Negações recentes:"; ausearch -m avc -ts recent 2>/dev/null | tail -5; }; fi
if command -v aa-status >/dev/null 2>&1; then aa-status 2>/dev/null | head -12; fi
command -v getenforce >/dev/null 2>&1 || command -v aa-status >/dev/null 2>&1 || echo "Nenhum MAC (SELinux/AppArmor) detectado."
exit 0
