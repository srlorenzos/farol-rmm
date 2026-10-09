# ---
# id: listar-drivers-instalados
# nome: "Listar drivers de terceiros instalados"
# descricao: "Lista pacotes de driver de terceiros (pnputil/Get-WindowsDriver) com data, versão e provedor, para identificar drivers antigos."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: true
# tags: [drivers]
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

$d = Get-WindowsDriver -Online -ErrorAction SilentlyContinue | Sort-Object Date | Select-Object Driver, OriginalFileName, ProviderName, ClassName, Version, Date
Out-Dados ($d | Select-Object -First 80 Driver, ProviderName, ClassName, Version, Date)
exit 0
