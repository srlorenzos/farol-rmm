#!/usr/bin/env bash
# ---
# id: linux-compliance-kernel-modulos-seguranca
# nome: "Linux - proteções do kernel e boot"
# descricao: "Verifica Secure Boot, módulos USB-storage, ptrace_scope, core dumps, kernel lockdown e SELinux/AppArmor."
# categoria: Compliance
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [kernel, hardening]
# variaveis: []
# ---

command -v mokutil >/dev/null 2>&1 && mokutil --sb-state 2>&1 | head -1
echo "ptrace_scope: $(cat /proc/sys/kernel/yama/ptrace_scope 2>/dev/null || echo n/d)"
echo "core_pattern: $(cat /proc/sys/kernel/core_pattern)"
echo "lockdown: $(cat /sys/kernel/security/lockdown 2>/dev/null || echo n/d)"
echo "usb-storage carregado: $(lsmod | grep -c usb_storage)"
getenforce 2>/dev/null || (command -v aa-status >/dev/null 2>&1 && aa-status --enabled && echo "AppArmor ativo")
echo "fs.suid_dumpable: $(sysctl -n fs.suid_dumpable)"
exit 0
