# ---
# id: mon-erros-disco-eventos
# nome: "Monitor - erros de disco e NTFS nos eventos"
# descricao: "Detecta eventos de erro de disco (disk 7/11/15/51/55/153, ntfs 55/98) nos últimos dias, sinal precoce de falha."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [disco, eventos, monitor]
# variaveis:
#   - nome: DIAS
#     rotulo: "Janela (dias)"
#     tipo: numero
#     padrao: 7
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$d = Get-Num $env:FAROL_DIAS 7
$e = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'disk', 'Ntfs', 'volmgr', 'stornvme', 'storahci'; Level = 1, 2, 3; StartTime = (Get-Date).AddDays(-$d) } -ErrorAction SilentlyContinue | Where-Object { $_.Id -in 7, 11, 15, 51, 55, 98, 153, 129, 157 })
if ($e.Count -ge 5) { Out-Status 'critico' "$($e.Count) evento(s) de erro de disco em ${d}d (último: $($e[0].TimeCreated.ToString('yyyy-MM-dd HH:mm')) id $($e[0].Id))" }
elseif ($e.Count -gt 0) { Out-Status 'alerta' "$($e.Count) evento(s) de erro de disco em ${d}d" }
else { Out-Status 'ok' "Sem erros de disco em ${d}d" }
exit 0
