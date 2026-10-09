# ---
# id: encerrar-sessao-usuario
# nome: "Encerrar sessão de usuário (logoff)"
# descricao: "Faz logoff de uma sessão específica pelo ID ou de todas as sessões desconectadas."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [sessoes, logoff]
# variaveis:
#   - nome: ID_SESSAO
#     rotulo: "ID da sessão (vazio = apenas desconectadas)"
#     tipo: numero
#     padrao: ""
#     obrigatorio: false
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
$linhas = (query user 2>$null) | Select-Object -Skip 1
if (-not $linhas) { Write-Output "Sem sessões."; exit 0 }
$alvo = @()
foreach ($l in $linhas) {
  $t = ($l -replace '^\s*>?', '') -split '\s{2,}'
  if ($l -match '\s(\d+)\s+(Disc|Desc|Active|Ativo|Ativa)') { $id = $Matches[1]; $estado = $Matches[2]
    if ($env:FAROL_ID_SESSAO) { if ($id -eq $env:FAROL_ID_SESSAO) { $alvo += $id } } elseif ($estado -match 'Disc|Desc') { $alvo += $id } }
}
Write-Output "Sessões-alvo: $($alvo -join ', ')"
if (-not $alvo) { exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para encerrar."; exit 0 }
$alvo | ForEach-Object { logoff $_; Write-Output "Sessão $_ encerrada." }
exit 0
