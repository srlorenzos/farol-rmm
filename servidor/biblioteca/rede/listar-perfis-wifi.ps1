# ---
# id: listar-perfis-wifi
# nome: "Listar perfis Wi-Fi salvos"
# descricao: "Lista os perfis de Wi-Fi salvos no computador e a rede atualmente conectada, sem exibir senhas."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [wifi]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

netsh wlan show profiles 2>&1
Write-Output ""
netsh wlan show interfaces 2>&1
exit 0
