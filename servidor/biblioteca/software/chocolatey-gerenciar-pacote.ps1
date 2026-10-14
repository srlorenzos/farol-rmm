# ---
# id: chocolatey-gerenciar-pacote
# nome: "Chocolatey - instalar, atualizar ou remover pacote"
# descricao: "Gerencia um pacote Chocolatey pelo nome. Requer o Chocolatey instalado."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1800
# requer_admin: true
# tags: [chocolatey, instalacao]
# variaveis:
#   - nome: PACOTE
#     rotulo: "Nome do pacote"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "instalar"
#     obrigatorio: true
#     opcoes: [instalar, atualizar, remover]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$p = "$env:FAROL_PACOTE".Trim()
if ($p -notmatch '^[A-Za-z0-9][\w.+-]{0,80}$') { Write-Output "Nome de pacote inválido."; exit 1 }
$c = Get-Command choco.exe -ErrorAction SilentlyContinue
if (-not $c) { Write-Output "Chocolatey não instalado. Use o script 'Instalar Chocolatey'."; exit 1 }
$acao = switch ("$env:FAROL_ACAO") { 'atualizar' { 'upgrade' } 'remover' { 'uninstall' } default { 'install' } }
& choco.exe $acao $p -y --no-progress
exit $LASTEXITCODE
