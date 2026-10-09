#!/usr/bin/env bash
# ---
# id: linux-desempenho-diagnostico-rapido
# nome: "Linux - diagnóstico rápido de desempenho"
# descricao: "Load, CPU (vmstat), memória, I/O de disco (iostat se houver), swap em uso, top processos e contagem de threads."
# categoria: Desempenho
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [lentidao, triagem]
# variaveis: []
# ---

echo "Load: $(cat /proc/loadavg) | CPUs: $(nproc)"
echo "== vmstat (3 amostras)"; vmstat 1 3
command -v iostat >/dev/null 2>&1 && { echo "== iostat"; iostat -xz 1 2 | tail -15; }
echo "== Memória"; free -h
echo "== Swap por processo"; for f in /proc/[0-9]*/status; do awk '/^(Name|VmSwap)/ {printf $2" "}' "$f" 2>/dev/null; echo; done | awk '$2 > 0 {print $2, $1}' | sort -rn | head -5
echo "== Top 5 CPU"; ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu | head -6
exit 0
