# ---
# id: reinicios-desligamentos-inesperados
# nome: "Histórico de reinícios e desligamentos"
# descricao: "Lista reinícios, desligamentos e desligamentos inesperados (eventos 41, 1074, 6005-6008) com motivo e usuário."
# categoria: Registro e logs do sistema
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [reinicio, eventos]
# variaveis:
#   - nome: DIAS
#     rotulo: "Janela (dias)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$ini = (Get-Date).AddDays(-(Get-Num $env:FAROL_DIAS 30))
Get-WinEvent -FilterHashtable @{ LogName = 'System'; Id = 41, 1074, 6005, 6006, 6008; StartTime = $ini } -ErrorAction SilentlyContinue | Select-Object -First 40 | ForEach-Object {
  $t = switch ($_.Id) { 41 { 'QUEDA/RESET INESPERADO' } 1074 { 'Desligamento solicitado' } 6005 { 'Serviço de log iniciado (boot)' } 6006 { 'Desligamento limpo' } 6008 { 'Desligamento inesperado anterior' } }
  Write-Output ("{0}  {1,-34} {2}" -f $_.TimeCreated.ToString('yyyy-MM-dd HH:mm'), $t, (($_.Message -split "`n")[0]))
}
exit 0
