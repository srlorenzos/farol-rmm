#!/usr/bin/env bash
# ---
# id: linux-compliance-permissoes-arquivos
# nome: "Linux - arquivos com permissões perigosas"
# descricao: "Procura arquivos graváveis por todos, sem dono e diretórios sem sticky bit em locais de sistema."
# categoria: Compliance
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 900
# requer_admin: true
# tags: [permissoes, compliance]
# variaveis: []
# ---

echo "== World-writable em /etc /usr /var (excluindo /var/tmp)"
find /etc /usr /var -xdev -type f -perm -0002 -not -path '/var/tmp/*' -not -path '/var/lib/docker/*' 2>/dev/null | head -20
echo "== Sem dono/grupo"; find / -xdev \( -nouser -o -nogroup \) 2>/dev/null | head -10
echo "== Diretórios graváveis sem sticky"; find / -xdev -type d -perm -0002 ! -perm -1000 2>/dev/null | head -10
exit 0
