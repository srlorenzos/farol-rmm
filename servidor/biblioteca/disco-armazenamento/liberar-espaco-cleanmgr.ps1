# ---
# id: liberar-espaco-cleanmgr
# nome: "Limpeza de disco do Windows (cleanmgr)"
# descricao: "Configura e executa a Limpeza de Disco com categorias seguras (temporários, miniaturas, relatórios de erro, cache de atualização, lixeira)."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1800
# requer_admin: true
# tags: [cleanmgr, limpeza]
# variaveis:
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para executar a Limpeza de Disco."; exit 0 }
$base = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches'
$cats = 'Temporary Files','Thumbnail Cache','Windows Error Reporting Files','Update Cleanup','Recycle Bin','Downloaded Program Files','Delivery Optimization Files','Temporary Setup Files'
foreach ($c in $cats) {
  $k = Join-Path $base $c
  if (Test-Path $k) { New-ItemProperty -Path $k -Name 'StateFlags0042' -Value 2 -PropertyType DWord -Force | Out-Null }
}
$antes = (Get-PSDrive C).Free
Start-Process cleanmgr.exe -ArgumentList '/sagerun:42' -Wait -WindowStyle Hidden
$dep = (Get-PSDrive C).Free
Write-Output ("Espaço liberado em C: {0}" -f (Format-Tam ([int64]($dep - $antes))))
exit 0
