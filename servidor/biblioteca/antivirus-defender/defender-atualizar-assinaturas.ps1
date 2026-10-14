# ---
# id: defender-atualizar-assinaturas
# nome: "Atualizar assinaturas do Defender"
# descricao: "Força a atualização das definições do Microsoft Defender e mostra a nova versão."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [defender, assinaturas]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
Update-MpSignature -ErrorAction Stop
$s = Get-MpComputerStatus
Write-Output ("Assinaturas: {0} ({1})" -f $s.AntivirusSignatureVersion, $s.AntivirusSignatureLastUpdated)
exit 0
