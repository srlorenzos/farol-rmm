# ---
# id: limpar-politicas-locais
# nome: "Redefinir política de grupo local"
# descricao: "Remove os arquivos Registry.pol da GPO local (máquina e usuário) e reaplica, restaurando padrões. Faz backup antes."
# categoria: Políticas e GPO
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 180
# requer_admin: true
# tags: [gpo, local, reset]
# variaveis:
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
$dir = "$env:windir\System32\GroupPolicy"
if (-not (Test-Path $dir)) { Write-Output "Sem política local customizada."; exit 0 }
Get-ChildItem $dir -Recurse -Filter Registry.pol -ErrorAction SilentlyContinue | ForEach-Object { Write-Output $_.FullName }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para redefinir (backup será criado)."; exit 0 }
$bk = "$env:windir\Temp\GroupPolicy-bak-$(Get-Date -Format yyyyMMddHHmm)"
Copy-Item $dir $bk -Recurse -Force
Remove-Item "$dir\Machine\Registry.pol", "$dir\User\Registry.pol" -Force -ErrorAction SilentlyContinue
gpupdate /force | Out-Null
Write-Output "Política local redefinida. Backup: $bk"
exit 0
