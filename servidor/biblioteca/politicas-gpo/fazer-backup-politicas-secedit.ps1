# ---
# id: fazer-backup-politicas-secedit
# nome: "Backup da configuração de políticas (secedit + registro)"
# descricao: "Exporta políticas de segurança, auditoria e as chaves HKLM\\SOFTWARE\\Policies para uma pasta, para restauração ou comparação futura."
# categoria: Políticas e GPO
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: true
# tags: [gpo, backup]
# variaveis:
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: "C:\\Windows\\Temp\\politicas"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

Exigir-Admin
$d = if ($env:FAROL_DESTINO) { $env:FAROL_DESTINO } else { "$env:windir\Temp\politicas" }
New-Item $d -ItemType Directory -Force | Out-Null
$ts = Get-Date -Format yyyyMMdd-HHmm
secedit /export /cfg "$d\secpol-$ts.inf" /quiet
auditpol /backup /file:"$d\audit-$ts.csv" | Out-Null
reg export 'HKLM\SOFTWARE\Policies' "$d\policies-hklm-$ts.reg" /y | Out-Null
Get-ChildItem $d -Filter "*$ts*" | ForEach-Object { Write-Output ("{0}  {1}" -f $_.FullName, (Format-Tam $_.Length)) }
exit 0
