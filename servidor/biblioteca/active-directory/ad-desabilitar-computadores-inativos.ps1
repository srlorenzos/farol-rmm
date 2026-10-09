# ---
# id: ad-desabilitar-computadores-inativos
# nome: "AD - desabilitar computadores inativos"
# descricao: "Desabilita (sem excluir) computadores sem logon há N dias e acrescenta data na descrição. Simulação por padrão."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: false
# tags: [ad, limpeza]
# variaveis:
#   - nome: DIAS
#     rotulo: "Dias sem logon"
#     tipo: numero
#     padrao: 120
#     obrigatorio: false
#     opcoes: []
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Test-Simular { -not ("$env:FAROL_SIMULAR" -match '^(0|false|nao|não|n|no|falso)$') }

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado (instale o RSAT)."; exit 1 }
Import-Module ActiveDirectory
$dias = Get-Num $env:FAROL_DIAS 120
$sim = Test-Simular
$c = Search-ADAccount -AccountInactive -ComputersOnly -TimeSpan ([timespan]::FromDays($dias)) | Where-Object Enabled
Write-Output "$(@($c).Count) computador(es) inativo(s) há mais de $dias dias."
foreach ($x in $c) {
  Write-Output ("{0}{1}" -f $(if ($sim) { '[simulação] ' } else { '' }), $x.Name)
  if (-not $sim) { Disable-ADAccount -Identity $x; Set-ADComputer -Identity $x -Description "Desabilitado em $(Get-Date -Format yyyy-MM-dd) por inatividade" }
}
exit 0
