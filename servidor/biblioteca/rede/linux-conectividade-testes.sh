#!/usr/bin/env bash
# ---
# id: linux-conectividade-testes
# nome: "Linux - teste de conectividade"
# descricao: "Testa gateway, DNS, internet, resolução e rota para uma lista de hosts."
# categoria: Rede
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [rede, ping]
# variaveis:
#   - nome: HOSTS
#     rotulo: "Hosts separados por vírgula"
#     tipo: texto
#     padrao: "8.8.8.8,1.1.1.1,google.com"
#     obrigatorio: false
#     opcoes: []
# ---

gw=$(ip route | awk '/^default/ {print $3; exit}'); echo "Gateway: ${gw:-nenhum}"
[ -n "$gw" ] && { ping -c 2 -W 2 "$gw" >/dev/null 2>&1 && echo "  gateway responde" || echo "  gateway NÃO responde"; }
echo "DNS: $(grep -E '^nameserver' /etc/resolv.conf | awk '{print $2}' | tr '\n' ' ')"
for h in $(printf '%s' "${FAROL_HOSTS:-8.8.8.8,1.1.1.1,google.com}" | tr ',' ' '); do
  printf '%s' "$h" | grep -Eq '^[A-Za-z0-9._:-]+$' || { echo "Host inválido: $h"; continue; }
  r=$(ping -c 3 -W 2 "$h" 2>&1 | tail -2 | tr '\n' ' '); echo "$h -> ${r:-sem resposta}"
done
exit 0
