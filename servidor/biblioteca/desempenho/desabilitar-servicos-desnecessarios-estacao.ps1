# ---
# id: desabilitar-servicos-desnecessarios-estacao
# nome: "Desabilitar serviços opcionais de estação de trabalho"
# descricao: "Coloca em modo manual serviços raramente necessários em estações (Fax, Xbox, Mapas, Telefonia, Compartilhamento de mídia) para reduzir consumo."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [servicos, otimizacao]
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
$lista = 'Fax', 'XblAuthManager', 'XblGameSave', 'XboxNetApiSvc', 'XboxGipSvc', 'MapsBroker', 'PhoneSvc', 'WMPNetworkSvc', 'RetailDemo', 'WerSvc', 'SharedAccess'
foreach ($n in $lista) {
  $s = Get-Service -Name $n -ErrorAction SilentlyContinue
  if ($s -and $s.StartType -eq 'Automatic') {
    Write-Output ("{0}{1}: Automático -> Manual" -f $(if ($sim) { '[simulação] ' } else { '' }), $n)
    if (-not $sim) { Set-Service -Name $n -StartupType Manual }
  }
}
exit 0
