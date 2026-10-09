# ---
# id: preparar-equipamento-para-descarte
# nome: "Preparar equipamento para reuso ou descarte"
# descricao: "Remove perfis de usuário (exceto o logado e contas de sistema), limpa lixeira e temporários e informa os próximos passos (reset do Windows / apagamento seguro). Simulação por padrão."
# categoria: Onboarding e offboarding
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1800
# requer_admin: true
# tags: [offboarding, descarte]
# variaveis:
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Simular { -not ("$env:FAROL_SIMULAR" -match '^(0|false|nao|não|n|no|falso)$') }

Exigir-Admin
$sim = Test-Simular
$perfis = Get-CimInstance Win32_UserProfile | Where-Object { -not $_.Special -and -not $_.Loaded -and $_.LocalPath -like 'C:\Users\*' }
foreach ($p in $perfis) { Write-Output ("{0}{1}" -f $(if ($sim) { '[simulação] remover perfil ' } else { 'Removendo perfil ' }), $p.LocalPath); if (-not $sim) { Remove-CimInstance -InputObject $p -ErrorAction SilentlyContinue } }
if (-not $sim) { Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Remove-Item "$env:windir\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue }
Write-Output "Próximos passos: remover do domínio/Entra ID/MDM, suspender BitLocker se for trocar hardware, executar 'Redefinir este PC' com limpeza de dados e registrar no inventário."
exit 0
