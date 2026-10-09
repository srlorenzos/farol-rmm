# ---
# id: inventario-impressoras-rede-scanner
# nome: "Inventário de portas TCP/IP de impressoras"
# descricao: "Lista portas de impressora TCP/IP e as impressoras associadas, para mapear dispositivos de impressão na rede."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [impressoras, inventario]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-PrinterPort | Where-Object { $_.PrinterHostAddress } | ForEach-Object { $p = $_; [pscustomobject]@{ Porta = $p.Name; Endereco = $p.PrinterHostAddress; Impressoras = ((Get-Printer | Where-Object PortName -eq $p.Name | ForEach-Object { $_.Name }) -join '; ') } } | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
