# ---
# id: exportar-politica-seguranca-local
# nome: "Exportar política de segurança local"
# descricao: "Exporta a configuração de segurança local (secedit) e a política de auditoria para arquivos para fins de auditoria ou comparação."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: true
# tags: [secedit, politica]
# variaveis:
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: "C:\\Windows\\Temp"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$d = if ($env:FAROL_DESTINO) { $env:FAROL_DESTINO } else { "$env:windir\Temp" }
New-Item $d -ItemType Directory -Force | Out-Null
$f = Join-Path $d ("secpol-{0}-{1:yyyyMMdd}.inf" -f $env:COMPUTERNAME, (Get-Date))
secedit /export /cfg $f /quiet
auditpol /backup /file:"$($f -replace '\.inf$','.audit.csv')" | Out-Null
Write-Output "Exportado: $f"
Select-String -Path $f -Pattern 'MinimumPasswordLength|PasswordComplexity|LockoutBadCount|MaximumPasswordAge' | ForEach-Object { $_.Line }
exit 0
