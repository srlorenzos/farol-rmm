# ---
# id: mon-ultimo-backup-vss
# nome: "Monitor - idade do último ponto de restauração/VSS"
# descricao: "Verifica a idade da cópia de sombra mais recente (útil como proxy de backup local)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: true
# tags: [vss, backup, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (dias)"
#     tipo: numero
#     padrao: 2
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (dias)"
#     tipo: numero
#     padrao: 7
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 2; $c = Get-Num $env:FAROL_CRITICO 7
$s = Get-CimInstance Win32_ShadowCopy -ErrorAction SilentlyContinue | Sort-Object InstallDate -Descending | Select-Object -First 1
if (-not $s) { Out-Status 'alerta' 'Nenhuma cópia de sombra encontrada'; exit 0 }
$d = [math]::Round(((Get-Date) - $s.InstallDate).TotalDays, 1)
$msg = "Última cópia de sombra há $d dia(s)"
if ($d -ge $c) { Out-Status 'critico' $msg } elseif ($d -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
