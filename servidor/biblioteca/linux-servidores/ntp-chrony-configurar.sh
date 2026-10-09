#!/usr/bin/env bash
# ---
# id: ntp-chrony-configurar
# nome: "chrony - instalar e configurar servidor de hora"
# descricao: "Instala o chrony (se necessário), define o servidor NTP e sincroniza."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [chrony, ntp]
# variaveis:
#   - nome: SERVIDOR
#     rotulo: "Servidor NTP"
#     tipo: texto
#     padrao: "a.st1.ntp.br"
#     obrigatorio: false
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
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }
f_pm_install() { case "$(f_pm)" in apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@";; dnf) dnf install -y "$@";; yum) yum install -y "$@";; zypper) zypper -n install "$@";; pacman) pacman -S --noconfirm "$@";; *) echo "ERRO: gerenciador de pacotes não suportado."; return 1;; esac; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
s="${FAROL_SERVIDOR:-a.st1.ntp.br}"; printf '%s' "$s" | grep -Eq '^[A-Za-z0-9.-]+$' || { echo "Servidor inválido."; exit 1; }
if ! f_confirmar; then echo "Defina CONFIRMAR=true para configurar o chrony com $s."; exit 0; fi
command -v chronyd >/dev/null 2>&1 || f_pm_install chrony || exit 1
conf=/etc/chrony/chrony.conf; [ -f "$conf" ] || conf=/etc/chrony.conf
[ -f "$conf" ] && cp -n "$conf" "$conf.farol.bak"
printf '# Gerado pelo Farol RMM\nserver %s iburst\ndriftfile /var/lib/chrony/drift\nmakestep 1.0 3\nrtcsync\n' "$s" > "$conf"
systemctl enable --now chrony 2>/dev/null || systemctl enable --now chronyd
sleep 3; chronyc tracking | head -5
exit 0
