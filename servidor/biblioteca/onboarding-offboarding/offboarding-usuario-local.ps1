# ---
# id: offboarding-usuario-local
# nome: "Offboarding de usuário local"
# descricao: "Desativa a conta, encerra a sessão, remove de grupos privilegiados e, opcionalmente, arquiva o perfil em ZIP antes de excluí-lo."
# categoria: Onboarding e offboarding
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [offboarding, usuarios]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ARQUIVAR_PERFIL
#     rotulo: "Arquivar o perfil em ZIP"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
#   - nome: DESTINO
#     rotulo: "Pasta do arquivo"
#     tipo: texto
#     padrao: "C:\\Offboarding"
#     obrigatorio: false
#     opcoes: []
#   - nome: EXCLUIR_PERFIL
#     rotulo: "Excluir o perfil após arquivar"
#     tipo: booleano
#     padrao: false
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
function Test-Sim($v) { "$v" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$u = "$env:FAROL_USUARIO".Trim()
if ($u -notmatch '^[A-Za-z0-9._-]{1,20}$' -or $u -in 'Administrator', 'Administrador', $env:USERNAME) { Write-Output "Usuário inválido ou protegido."; exit 1 }
$c = Get-LocalUser -Name $u -ErrorAction SilentlyContinue
if (-not $c) { Write-Output "Usuário local não encontrado."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Executaria offboarding de '$u'. Defina CONFIRMAR=true."; exit 0 }
Disable-LocalUser -Name $u; Write-Output "Conta desativada."
(query user 2>$null) | Select-Object -Skip 1 | Where-Object { $_ -match "^\s*>?$u\s" } | ForEach-Object { if ($_ -match '\s(\d+)\s+(Disc|Active|Ativo|Desc)') { logoff $Matches[1]; Write-Output "Sessão encerrada." } }
foreach ($g in Get-LocalGroup) { try { Remove-LocalGroupMember -Group $g.Name -Member $u -ErrorAction Stop; Write-Output "Removido do grupo $($g.Name)" } catch {} }
$perfil = "C:\Users\$u"
if ((Test-Sim $env:FAROL_ARQUIVAR_PERFIL) -and (Test-Path $perfil)) {
  $d = if ($env:FAROL_DESTINO) { $env:FAROL_DESTINO } else { 'C:\Offboarding' }
  New-Item $d -ItemType Directory -Force | Out-Null
  $z = Join-Path $d ("{0}-{1:yyyyMMdd}.zip" -f $u, (Get-Date))
  Compress-Archive -Path "$perfil\Desktop", "$perfil\Documents", "$perfil\Downloads", "$perfil\Pictures" -DestinationPath $z -Force -ErrorAction SilentlyContinue
  Write-Output "Perfil arquivado em $z"
  if ((Test-Sim $env:FAROL_EXCLUIR_PERFIL) -and (Test-Path $z)) { Get-CimInstance Win32_UserProfile | Where-Object { $_.LocalPath -eq $perfil -and -not $_.Loaded } | Remove-CimInstance; Write-Output "Perfil excluído." }
}
Write-Output "Offboarding concluído para '$u'."
exit 0
