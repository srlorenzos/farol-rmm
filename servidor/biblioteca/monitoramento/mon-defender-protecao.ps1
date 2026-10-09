# ---
# id: mon-defender-protecao
# nome: "Monitor - proteção em tempo real do Defender"
# descricao: "Verifica se o Microsoft Defender está ativo com proteção em tempo real e antispyware (ou se há outro antivírus registrado)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [defender, antivirus, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$s = Get-MpComputerStatus -ErrorAction SilentlyContinue
if (-not $s) {
  $av = Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue
  if ($av) { Out-Status 'ok' ("Defender indisponível; antivírus de terceiros: " + (($av | ForEach-Object { $_.displayName }) -join ', ')) } else { Out-Status 'critico' 'Sem antivírus detectado' }
  exit 0
}
if (-not $s.AntivirusEnabled) { Out-Status 'critico' 'Defender desabilitado' }
elseif (-not $s.RealTimeProtectionEnabled) { Out-Status 'critico' 'Proteção em tempo real desligada' }
elseif (-not $s.BehaviorMonitorEnabled -or -not $s.IoavProtectionEnabled) { Out-Status 'alerta' 'Defender ativo, mas com componentes desligados' }
else { Out-Status 'ok' 'Defender ativo com proteção em tempo real' }
exit 0
