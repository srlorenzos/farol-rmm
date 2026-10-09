#!/usr/bin/env bash
# ---
# id: linux-reparar-gerenciador-pacotes
# nome: "Linux - reparar gerenciador de pacotes"
# descricao: "Corrige pacotes quebrados e locks: dpkg --configure -a e apt -f install, ou dnf clean/ rpm --rebuilddb."
# categoria: Atualizações
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 900
# requer_admin: true
# tags: [apt, dpkg, reparo]
# variaveis:
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
if ! f_confirmar; then echo "Defina CONFIRMAR=true para executar o reparo."; exit 0; fi
case "$(f_pm)" in
  apt) fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 && { echo "Outro processo usa o dpkg; tente mais tarde."; exit 1; }; dpkg --configure -a; apt-get -f install -y; apt-get update -qq;;
  dnf|yum) rpm --rebuilddb; $(f_pm) clean all; $(f_pm) makecache;;
  zypper) zypper -n refresh -f;;
  *) echo "Não suportado."; exit 1;;
esac
echo "Reparo concluído."
exit 0
