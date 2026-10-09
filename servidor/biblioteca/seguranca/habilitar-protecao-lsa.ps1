# ---
# id: habilitar-protecao-lsa
# nome: "Habilitar proteção LSA (RunAsPPL) e desabilitar WDigest"
# descricao: "Ativa LSA como processo protegido e impede o armazenamento de senhas em texto claro (WDigest), dificultando Mimikatz. Requer reinício."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [lsa, wdigest, hardening]
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
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$lsa = 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa'; $wd = 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest'
Write-Output ("RunAsPPL={0}; UseLogonCredential={1}" -f (Get-ItemProperty $lsa).RunAsPPL, (Get-ItemProperty $wd -ErrorAction SilentlyContinue).UseLogonCredential)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
Set-ItemProperty $lsa RunAsPPL 1 -Type DWord
if (-not (Test-Path $wd)) { New-Item $wd -Force | Out-Null }
Set-ItemProperty $wd UseLogonCredential 0 -Type DWord
Write-Output "Aplicado. Reinicie para ativar a proteção LSA."
exit 0
