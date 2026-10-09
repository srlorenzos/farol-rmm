#!/usr/bin/env bash
# ---
# id: linux-rsync-backup
# nome: "Linux - backup incremental com rsync"
# descricao: "Sincroniza uma origem para um destino local ou remoto (SSH) com rsync, preservando permissões. Modo simulação por padrão (dry-run); --delete só quando ESPELHAR=true."
# categoria: Backup e recuperação
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 7200
# requer_admin: true
# tags: [rsync, backup]
# variaveis:
#   - nome: ORIGEM
#     rotulo: "Diretório de origem"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DESTINO
#     rotulo: "Destino (/pasta ou usuario@host:/pasta)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ESPELHAR
#     rotulo: "Remover do destino o que não existe na origem"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_simular() { case "$(printf '%s' "$FAROL_SIMULAR" | tr 'A-Z' 'a-z')" in 0|false|nao|não|n|no|falso) return 1;; *) return 0;; esac; }

o="$FAROL_ORIGEM"; d="$FAROL_DESTINO"
[ -d "$o" ] || { echo "Origem inexistente."; exit 1; }
printf '%s' "$d" | grep -Eq '^([A-Za-z0-9._-]+@[A-Za-z0-9._-]+:)?/[A-Za-z0-9._/ -]+$' || { echo "Destino inválido."; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo "rsync não instalado."; exit 1; }
opts="-aHAX --info=stats2 --exclude=lost+found"
f_sim "$FAROL_ESPELHAR" && opts="$opts --delete"
f_simular && { opts="$opts -n"; echo "SIMULAÇÃO (dry-run): nada será copiado."; }
# shellcheck disable=SC2086
rsync $opts -- "${o%/}/" "${d%/}/"
rc=$?
echo "rsync terminou com código $rc"
exit $rc
