#!/usr/bin/env bash
# ---
# id: linux-sessoes-e-logins
# nome: "Linux - sessões ativas e últimos logins"
# descricao: "Mostra quem está logado, últimos logins e logins com falha (lastb)."
# categoria: Usuários e contas
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [sessoes, logins]
# variaveis: []
# ---

echo "== Logados agora =="; w
echo "== Últimos logins =="; last -n 15 2>/dev/null
echo "== Falhas recentes =="; lastb -n 10 2>/dev/null || echo "(lastb sem acesso)"
exit 0
