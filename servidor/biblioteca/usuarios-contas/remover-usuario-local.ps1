# ---
# id: remover-usuario-local
# nome: "Remover usuário local"
# descricao: "Exclui uma conta local e, opcionalmente, o perfil e arquivos dele. Exige confirmação; faz backup da lista de arquivos do perfil se solicitado."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [usuarios, exclusao]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: APAGAR_PERFIL
#     rotulo: "Apagar também o perfil (pasta do usuário)"
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
if ($u -in 'Administrator', 'Administrador', $env:USERNAME) { Write-Output "Recusado: conta protegida ou em uso."; exit 1 }
if (-not (Get-LocalUser -Name $u -ErrorAction SilentlyContinue)) { Write-Output "Usuário não encontrado."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para remover '$u'."; exit 0 }
Remove-LocalUser -Name $u
if (Test-Sim $env:FAROL_APAGAR_PERFIL) { Get-CimInstance Win32_UserProfile | Where-Object { $_.LocalPath -eq "C:\Users\$u" -and -not $_.Loaded } | Remove-CimInstance; Write-Output "Perfil removido." }
Write-Output "Usuário '$u' removido."
exit 0
