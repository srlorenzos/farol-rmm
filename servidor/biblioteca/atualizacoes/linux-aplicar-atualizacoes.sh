#!/usr/bin/env bash
# ---
# id: linux-aplicar-atualizacoes
# nome: "Linux - aplicar atualizações"
# descricao: "Atualiza os pacotes do sistema (todos ou somente segurança em Debian/Ubuntu e RHEL) sem reiniciar. Informa se há reinício necessário."
# categoria: Atualizações
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [atualizacoes, patches]
# variaveis:
#   - nome: ESCOPO
#     rotulo: "Escopo"
#     tipo: selecao
#     padrao: "seguranca"
#     obrigatorio: false
#     opcoes: [seguranca, todas]
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
if ! f_confirmar; then echo "Defina CONFIRMAR=true para aplicar atualizações ($FAROL_ESCOPO)."; exit 0; fi
export DEBIAN_FRONTEND=noninteractive
case "$(f_pm)" in
  apt) apt-get update -qq
    if [ "$FAROL_ESCOPO" = "todas" ]; then apt-get -y -o Dpkg::Options::=--force-confold upgrade; else command -v unattended-upgrade >/dev/null 2>&1 && unattended-upgrade -v || apt-get -y -o Dpkg::Options::=--force-confold upgrade; fi;;
  dnf) if [ "$FAROL_ESCOPO" = "todas" ]; then dnf -y upgrade; else dnf -y upgrade --security; fi;;
  yum) if [ "$FAROL_ESCOPO" = "todas" ]; then yum -y update; else yum -y update --security; fi;;
  zypper) if [ "$FAROL_ESCOPO" = "todas" ]; then zypper -n up; else zypper -n patch --category security; fi;;
  pacman) pacman -Syu --noconfirm;;
  *) echo "Gerenciador não suportado."; exit 1;;
esac
rc=$?
[ -f /var/run/reboot-required ] && echo "ATENÇÃO: reinício necessário."
exit $rc
