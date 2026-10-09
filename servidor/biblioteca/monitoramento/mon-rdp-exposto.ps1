# ---
# id: mon-rdp-exposto
# nome: "Monitor - RDP habilitado sem NLA"
# descricao: "Alerta se o RDP está habilitado sem Autenticação em Nível de Rede, ou habilitado quando não esperado."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [rdp, seguranca, monitor]
# variaveis:
#   - nome: RDP_ESPERADO
#     rotulo: "RDP deve estar habilitado?"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Sim($v) { "$v" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$ts = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server'
$nla = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp').UserAuthentication
$hab = $ts.fDenyTSConnections -eq 0
if ($hab -and $nla -ne 1) { Out-Status 'critico' 'RDP habilitado SEM NLA' }
elseif ($hab -and -not (Test-Sim $env:FAROL_RDP_ESPERADO)) { Out-Status 'alerta' 'RDP habilitado (com NLA), mas não esperado' }
else { Out-Status 'ok' $(if ($hab) { 'RDP habilitado com NLA' } else { 'RDP desabilitado' }) }
exit 0
