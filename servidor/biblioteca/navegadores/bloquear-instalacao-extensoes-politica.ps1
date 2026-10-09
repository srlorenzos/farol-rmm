# ---
# id: bloquear-instalacao-extensoes-politica
# nome: "Bloquear instalação de extensões não autorizadas"
# descricao: "Configura política do Chrome e Edge para bloquear todas as extensões, exceto IDs permitidos informados."
# categoria: Navegadores
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [extensoes, politica, hardening]
# variaveis:
#   - nome: PERMITIDAS
#     rotulo: "IDs permitidos separados por vírgula"
#     tipo: texto
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
$ids = ("$env:FAROL_PERMITIDAS" -replace '\s', '').Split(',') | Where-Object { $_ -match '^[a-p]{32}$' }
if (-not (Test-Confirmar)) { Write-Output "Aplicaria bloqueio total de extensões, permitindo $(@($ids).Count) ID(s). Defina CONFIRMAR=true."; exit 0 }
foreach ($k in 'HKLM:\SOFTWARE\Policies\Microsoft\Edge', 'HKLM:\SOFTWARE\Policies\Google\Chrome') {
  New-Item "$k\ExtensionInstallBlocklist" -Force | Out-Null; Set-ItemProperty "$k\ExtensionInstallBlocklist" '1' '*'
  New-Item "$k\ExtensionInstallAllowlist" -Force | Out-Null
  $i = 1; foreach ($id in $ids) { Set-ItemProperty "$k\ExtensionInstallAllowlist" "$i" $id; $i++ }
}
Write-Output "Política aplicada."
exit 0
