# ---
# id: saude-discos-fisicos
# nome: "Saúde dos discos físicos"
# descricao: "Lista discos físicos com modelo, tipo de mídia, barramento, saúde e status operacional (Get-PhysicalDisk)."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [disco, saude]
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

$d = Get-PhysicalDisk -ErrorAction SilentlyContinue | ForEach-Object {
  [pscustomobject]@{ Nome = $_.FriendlyName; Midia = $_.MediaType; Barramento = $_.BusType; TamanhoGB = [math]::Round($_.Size / 1GB); Saude = $_.HealthStatus; Status = ($_.OperationalStatus -join ',') }
}
if (-not $d) { Write-Output "Nenhum disco físico retornado (verifique permissões)."; exit 0 }
Out-Dados $d
exit 0
