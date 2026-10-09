# ---
# id: desinstalar-programa-por-nome
# nome: "Desinstalar programa pelo nome"
# descricao: "Localiza um programa instalado pelo nome exato/parcial e executa a desinstalação silenciosa (MSI /qn). Mostra o candidato antes e exige confirmação."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1200
# requer_admin: true
# tags: [desinstalacao, msi]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome (ou parte) do programa"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
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
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$n = "$env:FAROL_NOME".Trim()
if ($n.Length -lt 3) { Write-Output "Informe ao menos 3 caracteres."; exit 1 }
$ks = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
$p = @(Get-ItemProperty $ks -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*$n*" -and $_.UninstallString })
if ($p.Count -eq 0) { Write-Output "Nenhum programa corresponde a '$n'."; exit 0 }
if ($p.Count -gt 1) { Write-Output "Mais de um programa corresponde; refine o nome:"; $p | ForEach-Object { Write-Output " - $($_.DisplayName) $($_.DisplayVersion)" }; exit 1 }
$x = $p[0]
Write-Output "Alvo: $($x.DisplayName) $($x.DisplayVersion)"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para desinstalar."; exit 0 }
if ($x.UninstallString -match '(?i)msiexec' -and $x.PSChildName -match '^\{[0-9A-F-]{36}\}$') {
  $r = Start-Process msiexec.exe -ArgumentList "/x $($x.PSChildName) /qn /norestart" -Wait -PassThru
} elseif ($x.QuietUninstallString) {
  $r = Start-Process cmd.exe -ArgumentList "/c $($x.QuietUninstallString)" -Wait -PassThru
} else { Write-Output "Sem desinstalador silencioso conhecido; use o desinstalador manual: $($x.UninstallString)"; exit 1 }
Write-Output "Código de saída: $($r.ExitCode)"
exit $(if ($r.ExitCode -in 0, 3010) { 0 } else { 1 })
