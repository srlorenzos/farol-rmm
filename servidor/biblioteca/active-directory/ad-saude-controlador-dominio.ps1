# ---
# id: ad-saude-controlador-dominio
# nome: "AD - saúde do controlador de domínio (dcdiag)"
# descricao: "Executa dcdiag resumido e verifica replicação (repadmin) no controlador de domínio local."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 600
# requer_admin: true
# tags: [ad, dcdiag, replicacao]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Command dcdiag.exe -ErrorAction SilentlyContinue)) { Write-Output "dcdiag não encontrado: este computador não é um controlador de domínio."; exit 1 }
dcdiag /q
Write-Output "== Replicação =="
repadmin /replsummary
exit 0
