# ---
# id: mon-antivirus-seguranca-center
# nome: "Monitor - antivírus registrado no Centro de Segurança"
# descricao: "Lê o estado dos produtos antivírus registrados no Security Center (qualquer fabricante): ativo e com assinaturas atualizadas."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [antivirus, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$av = Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue
if (-not $av) { Out-Status 'critico' 'Nenhum antivírus registrado'; exit 0 }
$bom = @($av | Where-Object { (([int]$_.productState -shr 12) -band 0xF) -eq 1 -and (([int]$_.productState -shr 4) -band 0xF) -eq 0 })
$nomes = ($av | ForEach-Object { $_.displayName }) -join ', '
if ($bom.Count) { Out-Status 'ok' "Antivírus ativo e atualizado: $nomes" } else { Out-Status 'alerta' "Antivírus presente, mas desativado/desatualizado: $nomes" }
exit 0
