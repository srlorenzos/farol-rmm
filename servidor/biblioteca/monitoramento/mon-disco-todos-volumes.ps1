# ---
# id: mon-disco-todos-volumes
# nome: "Monitor - espaço livre de todos os volumes fixos"
# descricao: "Verifica todos os volumes fixos e reporta o pior caso por percentual usado."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [disco, capacidade, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (% usado)"
#     tipo: numero
#     padrao: 85
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (% usado)"
#     tipo: numero
#     padrao: 95
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 85; $c = Get-Num $env:FAROL_CRITICO 95
$pior = 0; $det = @()
Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter -and $_.Size -gt 0 } | ForEach-Object {
  $p = [math]::Round(100 - ($_.SizeRemaining / $_.Size * 100), 0); $det += "$($_.DriveLetter): $p%"; if ($p -gt $pior) { $pior = $p }
}
$msg = "Volumes: " + ($det -join ', ')
if ($pior -ge $c) { Out-Status 'critico' $msg } elseif ($pior -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
