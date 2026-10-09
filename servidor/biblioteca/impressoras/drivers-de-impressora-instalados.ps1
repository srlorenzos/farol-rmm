# ---
# id: drivers-de-impressora-instalados
# nome: "Drivers de impressora instalados"
# descricao: "Lista os drivers de impressão com fabricante, versão e ambiente, para localizar drivers duplicados ou antigos."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [drivers, impressoras]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-PrinterDriver | Select-Object Name, Manufacturer, MajorVersion, PrinterEnvironment | Sort-Object Name | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
