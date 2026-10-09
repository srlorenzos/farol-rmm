# ---
# id: compliance-patches-criticos-idade
# nome: "Compliance - nível de atualização do sistema"
# descricao: "Verifica data do último hotfix, build instalado e reinício pendente; reprova se o último patch tiver mais de N dias."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [patches, compliance]
# variaveis:
#   - nome: DIAS
#     rotulo: "Máximo de dias sem patch"
#     tipo: numero
#     padrao: 45
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$d = Get-Num $env:FAROL_DIAS 45
$h = Get-HotFix | Where-Object InstalledOn | Sort-Object InstalledOn -Descending | Select-Object -First 1
$v = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
Write-Output ("Build: {0}.{1} ({2})" -f $v.CurrentBuild, $v.UBR, $v.DisplayVersion)
if ($h) { $idade = [int]((Get-Date) - $h.InstalledOn).TotalDays; Write-Output ("Último patch: {0} há {1} dias -> {2}" -f $h.HotFixID, $idade, $(if ($idade -le $d) { 'PASSOU' } else { 'FALHOU' })) } else { Write-Output "Nenhum hotfix encontrado -> FALHOU" }
Write-Output ("Reinício pendente: {0}" -f $(if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { 'sim' } else { 'não' }))
exit 0
