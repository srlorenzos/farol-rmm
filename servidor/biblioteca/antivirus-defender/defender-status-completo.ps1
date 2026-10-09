# ---
# id: defender-status-completo
# nome: "Status completo do Microsoft Defender"
# descricao: "Mostra proteção em tempo real, versões do motor/assinaturas, último scan rápido/completo, modo de operação e ameaças recentes."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [defender, status]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$s = Get-MpComputerStatus -ErrorAction SilentlyContinue
if (-not $s) { Write-Output "Defender não disponível (outro antivírus ativo ou serviço desabilitado)."; exit 0 }
$s | Format-List AMServiceEnabled, AntivirusEnabled, RealTimeProtectionEnabled, BehaviorMonitorEnabled, IoavProtectionEnabled, NISEnabled, AMRunningMode, AntivirusSignatureVersion, AntivirusSignatureLastUpdated, QuickScanEndTime, FullScanEndTime, TamperProtectionSource | Out-String | Write-Output
Write-Output "-- Ameaças recentes --"
Get-MpThreatDetection -ErrorAction SilentlyContinue | Sort-Object InitialDetectionTime -Descending | Select-Object -First 10 InitialDetectionTime, ThreatID, ProcessName, Resources | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
