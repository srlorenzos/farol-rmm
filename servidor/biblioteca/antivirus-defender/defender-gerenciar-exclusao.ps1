# ---
# id: defender-gerenciar-exclusao
# nome: "Adicionar ou remover exclusão do Defender"
# descricao: "Adiciona ou remove uma exclusão (caminho, extensão ou processo) com registro do motivo no evento do Windows. Recusa exclusões de unidade inteira."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [defender, exclusoes]
# variaveis:
#   - nome: TIPO
#     rotulo: "Tipo"
#     tipo: selecao
#     padrao: "caminho"
#     obrigatorio: true
#     opcoes: [caminho, extensao, processo]
#   - nome: VALOR
#     rotulo: "Valor"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "adicionar"
#     obrigatorio: true
#     opcoes: [adicionar, remover]
#   - nome: MOTIVO
#     rotulo: "Motivo/chamado"
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
$v = "$env:FAROL_VALOR".Trim(); $m = "$env:FAROL_MOTIVO".Trim()
if (-not $v -or -not $m) { Write-Output "VALOR e MOTIVO são obrigatórios."; exit 1 }
if ($v -match '^[A-Za-z]:\\?$|^\*$|^\\$') { Write-Output "Recusado: exclusão ampla demais."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para $env:FAROL_ACAO exclusão ($env:FAROL_TIPO): $v"; exit 0 }
$add = "$env:FAROL_ACAO" -ne 'remover'
switch ("$env:FAROL_TIPO") {
  'caminho' { if ($add) { Add-MpPreference -ExclusionPath $v } else { Remove-MpPreference -ExclusionPath $v } }
  'extensao' { if ($add) { Add-MpPreference -ExclusionExtension $v } else { Remove-MpPreference -ExclusionExtension $v } }
  'processo' { if ($add) { Add-MpPreference -ExclusionProcess $v } else { Remove-MpPreference -ExclusionProcess $v } }
}
try { if (-not [System.Diagnostics.EventLog]::SourceExists('Farol')) { New-EventLog -LogName Application -Source Farol }; Write-EventLog -LogName Application -Source Farol -EventId 5001 -Message "Exclusão Defender $env:FAROL_ACAO ($env:FAROL_TIPO): $v. Motivo: $m" } catch {}
Write-Output "Exclusão ${env:FAROL_ACAO}: $v (motivo registrado)."
exit 0
