# ---
# id: agendar-reinicio-atualizacao
# nome: "Verificar necessidade de reinício e agendar"
# descricao: "Verifica se há reinício pendente (Windows Update, CBS, renomeação de arquivos) e, se solicitado, agenda reinício com aviso aos usuários."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [reinicio, atualizacoes]
# variaveis:
#   - nome: MINUTOS
#     rotulo: "Minutos até reiniciar"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
#   - nome: AGENDAR
#     rotulo: "Agendar o reinício se estiver pendente"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Sim($v) { "$v" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$p = @()
if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { $p += 'Windows Update' }
if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') { $p += 'CBS' }
if ((Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -ErrorAction SilentlyContinue).PendingFileRenameOperations) { $p += 'Renomeação de arquivos' }
if (-not $p) { Write-Output "Nenhum reinício pendente."; exit 0 }
Write-Output ("Reinício pendente por: " + ($p -join ', '))
if (Test-Sim $env:FAROL_AGENDAR) {
  $m = Get-Num $env:FAROL_MINUTOS 30
  shutdown.exe /r /t ($m * 60) /c "O departamento de TI agendou um reinício em $m minuto(s) para concluir atualizações. Salve seu trabalho."
  Write-Output "Reinício agendado em $m minuto(s). Cancele com: shutdown /a"
}
exit 0
