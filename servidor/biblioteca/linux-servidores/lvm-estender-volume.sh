#!/usr/bin/env bash
# ---
# id: lvm-estender-volume
# nome: "LVM - estender volume lógico e filesystem"
# descricao: "Estende um LV com o espaço livre do VG (ou valor definido) e redimensiona o filesystem (ext4/xfs) online."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [lvm, expansao]
# variaveis:
#   - nome: LV
#     rotulo: "Caminho do LV (ex.: /dev/vg0/root)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: TAMANHO
#     rotulo: "Aumento (ex.: +10G ou 100%FREE)"
#     tipo: texto
#     padrao: "+10G"
#     obrigatorio: true
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
lv="$FAROL_LV"; t="$FAROL_TAMANHO"
printf '%s' "$lv" | grep -Eq '^/dev/[A-Za-z0-9_/.-]+$' || { echo "LV inválido."; exit 1; }
printf '%s' "$t" | grep -Eq '^(\+[0-9]+[MGT]|[0-9]+%(FREE|VG))$' || { echo "Tamanho inválido (use +10G ou 100%FREE)."; exit 1; }
lvs "$lv" >/dev/null 2>&1 || { echo "LV não encontrado."; exit 1; }
vgs --noheadings -o vg_name,vg_free "$(lvs --noheadings -o vg_name "$lv" | tr -d ' ')"
if ! f_confirmar; then echo "Estenderia $lv em $t. Defina CONFIRMAR=true."; exit 0; fi
case "$t" in *%*) lvextend -r -l "$t" "$lv";; *) lvextend -r -L "$t" "$lv";; esac
df -h "$lv" 2>/dev/null
exit 0
