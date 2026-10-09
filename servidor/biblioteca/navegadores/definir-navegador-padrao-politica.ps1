# ---
# id: definir-navegador-padrao-politica
# nome: "Configurar página inicial e política do Edge/Chrome"
# descricao: "Define via política a página inicial e o comportamento de inicialização do Edge e do Chrome para todos os usuários."
# categoria: Navegadores
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [politica, navegadores, pagina-inicial]
# variaveis:
#   - nome: URL
#     rotulo: "URL da página inicial"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
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
$u = "$env:FAROL_URL".Trim()
if ($u -notmatch '^https?://[^\s"]+$') { Write-Output "URL inválida."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para definir $u como página inicial."; exit 0 }
foreach ($k in 'HKLM:\SOFTWARE\Policies\Microsoft\Edge', 'HKLM:\SOFTWARE\Policies\Google\Chrome') {
  New-Item $k -Force | Out-Null
  Set-ItemProperty $k HomepageLocation $u; Set-ItemProperty $k HomepageIsNewTabPage 0 -Type DWord; Set-ItemProperty $k RestoreOnStartup 4 -Type DWord
  New-Item "$k\RestoreOnStartupURLs" -Force | Out-Null; Set-ItemProperty "$k\RestoreOnStartupURLs" '1' $u
}
Write-Output "Políticas gravadas; reinicie os navegadores."
exit 0
