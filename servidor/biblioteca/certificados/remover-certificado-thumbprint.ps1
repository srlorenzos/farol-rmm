# ---
# id: remover-certificado-thumbprint
# nome: "Remover certificado por impressão digital"
# descricao: "Remove um certificado do repositório da máquina pelo thumbprint, após mostrar seus dados."
# categoria: Certificados
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [certificados, remocao]
# variaveis:
#   - nome: THUMBPRINT
#     rotulo: "Thumbprint (SHA-1)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: REPOSITORIO
#     rotulo: "Repositório"
#     tipo: selecao
#     padrao: "My"
#     obrigatorio: true
#     opcoes: [My, Root, CA, TrustedPublisher]
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
$t = ("$env:FAROL_THUMBPRINT" -replace '\s', '').ToUpper()
if ($t -notmatch '^[0-9A-F]{40}$') { Write-Output "Thumbprint inválido."; exit 1 }
$r = if ("$env:FAROL_REPOSITORIO" -in 'My', 'Root', 'CA', 'TrustedPublisher') { $env:FAROL_REPOSITORIO } else { 'My' }
$c = Get-Item "Cert:\LocalMachine\$r\$t" -ErrorAction SilentlyContinue
if (-not $c) { Write-Output "Certificado não encontrado; nada a fazer."; exit 0 }
Write-Output "Encontrado: $($c.Subject) (expira $($c.NotAfter.ToString('yyyy-MM-dd')))"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para remover."; exit 0 }
Remove-Item $c.PSPath -Force
Write-Output "Removido."
exit 0
