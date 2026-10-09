#!/usr/bin/env bash
# ---
# id: linux-ssh-hardening-basico
# nome: "Linux - SSH: endurecer configuração"
# descricao: "Cria um drop-in em sshd_config.d desabilitando login root e senha vazia, limitando tentativas. Não desabilita senha a menos que solicitado, para não bloquear o acesso. Valida com sshd -t antes de recarregar."
# categoria: Acesso remoto
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [ssh, hardening]
# variaveis:
#   - nome: DESABILITAR_SENHA
#     rotulo: "Desabilitar login por senha (exige chaves configuradas)"
#     tipo: booleano
#     padrao: false
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
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
if ! f_confirmar; then echo "Defina CONFIRMAR=true para aplicar. (Confirme que há chave SSH autorizada antes de desabilitar senha.)"; exit 0; fi
[ -d /etc/ssh/sshd_config.d ] || { echo "sshd_config.d ausente (OpenSSH antigo)."; exit 1; }
f=/etc/ssh/sshd_config.d/00-farol-hardening.conf
{ echo "PermitRootLogin no"; echo "PermitEmptyPasswords no"; echo "MaxAuthTries 4"; echo "X11Forwarding no"; echo "LoginGraceTime 30"; f_sim "$FAROL_DESABILITAR_SENHA" && echo "PasswordAuthentication no"; } > "$f"
if sshd -t 2>&1; then systemctl reload ssh 2>/dev/null || systemctl reload sshd; echo "Configuração aplicada e recarregada."; else rm -f "$f"; echo "Configuração inválida; alteração revertida."; exit 1; fi
exit 0
