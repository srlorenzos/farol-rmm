# ---
# id: forcar-atualizacao-gpo
# nome: "Forçar atualização de políticas de grupo"
# descricao: "Executa gpupdate /force e mostra o resultado; opcionalmente aplica relogon quando necessário."
# categoria: Políticas e GPO
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [gpo, gpupdate]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
gpupdate /force
exit $LASTEXITCODE
