# ---
# id: gerenciar-servico
# nome: "Iniciar, parar ou reiniciar serviço"
# descricao: "Executa uma ação sobre um serviço do Windows identificado pelo nome (curto) e aguarda o estado final."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 180
# requer_admin: true
# tags: [servicos, controle]
# variaveis:
#   - nome: SERVICO
#     rotulo: "Nome do serviço"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "reiniciar"
#     obrigatorio: true
#     opcoes: [iniciar, parar, reiniciar, status]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$n = "$env:FAROL_SERVICO".Trim()
if ($n -notmatch '^[\w.$-]+$') { Write-Output "Nome inválido."; exit 1 }
$s = Get-Service -Name $n -ErrorAction SilentlyContinue
if (-not $s) { Write-Output "Serviço não encontrado: $n"; exit 1 }
switch ("$env:FAROL_ACAO") {
  'iniciar' { if ($s.Status -ne 'Running') { Start-Service $n } }
  'parar' { if ($s.Status -ne 'Stopped') { Stop-Service $n -Force } }
  'reiniciar' { Restart-Service $n -Force }
}
Get-Service -Name $n | Format-Table Name, DisplayName, Status, StartType -AutoSize | Out-String | Write-Output
exit 0
