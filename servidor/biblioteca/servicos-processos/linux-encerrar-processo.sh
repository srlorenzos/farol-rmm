#!/usr/bin/env bash
# ---
# id: linux-encerrar-processo
# nome: "Linux - encerrar processo"
# descricao: "Envia SIGTERM (ou SIGKILL) a um PID ou a processos por nome. Recusa PID 1 e processos do kernel."
# categoria: Serviços e processos
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [processos, kill]
# variaveis:
#   - nome: ALVO
#     rotulo: "PID ou nome exato"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: FORCAR
#     rotulo: "Usar SIGKILL"
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
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

a="$FAROL_ALVO"; sig=TERM; f_sim "$FAROL_FORCAR" && sig=KILL
printf '%s' "$a" | grep -Eq '^[A-Za-z0-9._+-]+$' || { echo "Alvo inválido."; exit 1; }
if printf '%s' "$a" | grep -Eq '^[0-9]+$'; then
  [ "$a" -gt 1 ] || { echo "Recusado."; exit 1; }; ps -p "$a" -o pid,user,etime,comm || { echo "PID não encontrado."; exit 0; }
  if ! f_confirmar; then echo "Defina CONFIRMAR=true para enviar SIG$sig."; exit 0; fi; kill -"$sig" "$a"
else
  pgrep -xl "$a" || { echo "Processo não encontrado."; exit 0; }
  if ! f_confirmar; then echo "Defina CONFIRMAR=true para enviar SIG$sig."; exit 0; fi; pkill -"$sig" -x "$a"
fi
echo "Sinal SIG$sig enviado."
exit 0
