# ---
# id: encerrar-processo
# nome: "Encerrar processo por nome ou PID"
# descricao: "Finaliza processos pelo nome (todas as instâncias) ou PID. Recusa processos críticos do sistema."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [processos, controle]
# variaveis:
#   - nome: ALVO
#     rotulo: "Nome do processo (sem .exe) ou PID"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

$a = "$env:FAROL_ALVO".Trim() -replace '\.exe$', ''
if ($a -notmatch '^[\w .-]+$') { Write-Output "Alvo inválido."; exit 1 }
$crit = 'System', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'svchost', 'Idle', 'Registry', 'dwm'
$p = if ($a -match '^\d+$') { Get-Process -Id ([int]$a) -ErrorAction SilentlyContinue } else { Get-Process -Name $a -ErrorAction SilentlyContinue }
if (-not $p) { Write-Output "Processo não encontrado: $a"; exit 0 }
if ($p | Where-Object { $_.ProcessName -in $crit }) { Write-Output "Recusado: processo crítico do sistema."; exit 1 }
$p | Format-Table Id, ProcessName, @{n='MemMB';e={[math]::Round($_.WorkingSet64/1MB)}} -AutoSize | Out-String | Write-Output
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para encerrar."; exit 0 }
$p | Stop-Process -Force
Write-Output "Encerrado."
exit 0
