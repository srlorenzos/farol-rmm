# ---
# id: backup-exportar-registro
# nome: "Exportar ramo do registro (.reg)"
# descricao: "Exporta uma chave do registro para arquivo .reg como backup antes de alterações."
# categoria: Registro e logs do sistema
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [registro, backup]
# variaveis:
#   - nome: CHAVE
#     rotulo: "Chave (ex.: HKLM\\SOFTWARE\\Contoso)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
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
$k = "$env:FAROL_CHAVE".Trim()
if ($k -notmatch '^(HKLM|HKCU|HKCR|HKU|HKEY_[A-Z_]+)\\[^"<>|]+$') { Write-Output "Chave inválida."; exit 1 }
$d = if ($env:FAROL_DESTINO) { $env:FAROL_DESTINO } else { "$env:windir\Temp" }
New-Item $d -ItemType Directory -Force | Out-Null
$f = Join-Path $d ("reg-{0:yyyyMMdd-HHmmss}.reg" -f (Get-Date))
reg export $k $f /y
if (Test-Path $f) { Write-Output "Exportado para $f" } else { exit 1 }
exit 0
