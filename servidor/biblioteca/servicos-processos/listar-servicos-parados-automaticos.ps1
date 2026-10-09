# ---
# id: listar-servicos-parados-automaticos
# nome: "Serviços automáticos parados"
# descricao: "Lista serviços configurados como automáticos que não estão em execução (exceto os de início atrasado/gatilho comuns)."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [servicos]
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

$d = Get-CimInstance Win32_Service | Where-Object { $_.StartMode -eq 'Auto' -and $_.State -ne 'Running' -and $_.Name -notmatch 'sppsvc|gupdate|MapsBroker|RemoteRegistry|edgeupdate|CDPUserSvc|OneSyncSvc|WbioSrvc|TrustedInstaller|DoSvc|shellhwdetection|clr_optimization' } | ForEach-Object {
  [pscustomobject]@{ Servico = $_.Name; Exibicao = $_.DisplayName; Estado = $_.State; CodigoSaida = $_.ExitCode }
}
if (-not $d) { Write-Output "Todos os serviços automáticos relevantes estão em execução."; exit 0 }
Out-Dados $d
exit 0
