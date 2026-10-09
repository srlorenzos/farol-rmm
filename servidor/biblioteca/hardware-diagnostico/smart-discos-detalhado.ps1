# ---
# id: smart-discos-detalhado
# nome: "SMART e confiabilidade dos discos"
# descricao: "Mostra contadores de confiabilidade (desgaste, temperatura, horas ligado, erros) dos discos físicos via Storage Management."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [smart, disco]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$r = Get-PhysicalDisk | ForEach-Object {
  $c = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
  [pscustomobject]@{ Disco = $_.FriendlyName; Saude = $_.HealthStatus; TempC = $c.Temperature; Desgaste = $c.Wear; HorasLigado = $c.PowerOnHours; ErrosLeitura = $c.ReadErrorsTotal; ErrosEscrita = $c.WriteErrorsTotal }
}
$r | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
$f = Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus -ErrorAction SilentlyContinue | Where-Object PredictFailure
if ($f) { Write-Output "ALERTA: SMART prevê falha em: $($f.InstanceName -join ', ')" }
exit 0
