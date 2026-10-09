# ---
# id: listar-aplicativos-appx
# nome: "Listar aplicativos da Microsoft Store (AppX)"
# descricao: "Lista pacotes AppX instalados para todos os usuários, com versão e publicador."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [appx, store]
# variaveis:
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Dados($d) { if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json -Depth 4 } else { ($d | Format-Table -AutoSize | Out-String -Width 220).TrimEnd() } }

$d = Get-AppxPackage -AllUsers | Where-Object { -not $_.IsFramework -and $_.SignatureKind -ne 'System' } | Select-Object Name, Version, Publisher -Unique | Sort-Object Name
Out-Dados $d
exit 0
