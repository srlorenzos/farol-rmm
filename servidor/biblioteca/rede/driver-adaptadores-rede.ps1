# ---
# id: driver-adaptadores-rede
# nome: "Adaptadores de rede e versões de driver"
# descricao: "Lista todos os adaptadores de rede com estado, driver, versão e data, para localizar drivers desatualizados."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [drivers, rede]
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

$d = Get-NetAdapter -IncludeHidden -ErrorAction SilentlyContinue | Where-Object { $_.Virtual -eq $false } | ForEach-Object {
  [pscustomobject]@{ Nome = $_.Name; Descricao = $_.InterfaceDescription; Estado = $_.Status; Driver = $_.DriverVersion; Data = $_.DriverDate; MAC = $_.MacAddress }
}
Out-Dados $d
exit 0
