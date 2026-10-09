# ---
# id: mon-versao-minima-software
# nome: "Monitor - versão mínima de um software"
# descricao: "Verifica se um programa instalado está na versão mínima exigida (útil para Chrome, Java, 7-Zip, agentes)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [software, patches, monitor]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome (ou parte) do programa"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: VERSAO_MINIMA
#     rotulo: "Versão mínima (ex.: 120.0.0)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$n = "$env:FAROL_NOME".Trim(); $vm = "$env:FAROL_VERSAO_MINIMA".Trim()
$min = $null; if (-not [version]::TryParse($vm, [ref]$min)) { Write-Output "Versão mínima inválida."; exit 2 }
$ks = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
$p = Get-ItemProperty $ks -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*$n*" } | Select-Object -First 1
if (-not $p) { Out-Status 'critico' "$n não instalado"; exit 0 }
$v = $null
if (-not [version]::TryParse(($p.DisplayVersion -replace '[^\d.].*$', ''), [ref]$v)) { Out-Status 'alerta' "Versão ilegível: $($p.DisplayVersion)"; exit 0 }
if ($v -lt $min) { Out-Status 'alerta' "$($p.DisplayName) $v abaixo do mínimo $min" } else { Out-Status 'ok' "$($p.DisplayName) $v" }
exit 0
