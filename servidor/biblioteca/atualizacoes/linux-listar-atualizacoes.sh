#!/usr/bin/env bash
# ---
# id: linux-listar-atualizacoes
# nome: "Linux - listar atualizações disponíveis"
# descricao: "Lista pacotes com atualização pendente (apt/dnf/yum/zypper) e destaca as de segurança quando possível."
# categoria: Atualizações
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 300
# requer_admin: true
# tags: [atualizacoes, patches]
# variaveis: []
# ---
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }

case "$(f_pm)" in
  apt) apt-get update -qq 2>&1 | tail -2; apt list --upgradable 2>/dev/null | tail -n +2 | head -80; echo "Total: $(apt-get -s upgrade | grep -c '^Inst ')"; echo "Segurança:"; apt-get -s upgrade | grep '^Inst' | grep -i security | head -20;;
  dnf) dnf -q check-update 2>/dev/null | head -80; echo "Segurança:"; dnf -q updateinfo list security 2>/dev/null | head -30;;
  yum) yum -q check-update 2>/dev/null | head -80;;
  zypper) zypper -q lu | head -80; zypper -q lp --category security 2>/dev/null | head -20;;
  pacman) pacman -Qu | head -80;;
  *) echo "Gerenciador não suportado."; exit 1;;
esac
exit 0
