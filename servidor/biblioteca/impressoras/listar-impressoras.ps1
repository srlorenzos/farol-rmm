# ---
# id: listar-impressoras
# nome: "Listar impressoras, portas e drivers"
# descricao: "Mostra impressoras instaladas com driver, porta, estado, compartilhamento e se é padrão."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [impressoras]
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

$pad = (Get-CimInstance Win32_Printer | Where-Object Default).Name
$d = Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ Nome = $_.Name; Driver = $_.DriverName; Porta = $_.PortName; Estado = $_.PrinterStatus; Compartilhada = $_.Shared; Padrao = ($_.Name -eq $pad) } }
if (-not $d) { Write-Output "Nenhuma impressora encontrada."; exit 0 }
Out-Dados $d
exit 0
