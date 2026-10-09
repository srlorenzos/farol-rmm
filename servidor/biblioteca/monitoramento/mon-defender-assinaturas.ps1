# ---
# id: mon-defender-assinaturas
# nome: "Monitor - idade das assinaturas do Defender"
# descricao: "Alerta se as definições de vírus estão desatualizadas há mais de N dias."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [defender, assinaturas, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (dias)"
#     tipo: numero
#     padrao: 3
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

$a = Get-Num $env:FAROL_ALERTA 3; $c = Get-Num $env:FAROL_CRITICO 7
$s = Get-MpComputerStatus -ErrorAction SilentlyContinue
if (-not $s) { Out-Status 'alerta' 'Defender indisponível'; exit 0 }
$d = [math]::Floor(((Get-Date) - $s.AntivirusSignatureLastUpdated).TotalDays)
$msg = "Assinaturas com $d dia(s) (versão $($s.AntivirusSignatureVersion))"
if ($d -ge $c) { Out-Status 'critico' $msg } elseif ($d -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
