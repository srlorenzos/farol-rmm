# ---
# id: mensagem-para-usuario
# nome: "Enviar mensagem ao usuário logado"
# descricao: "Exibe uma mensagem na tela de todas as sessões ativas (msg.exe), útil para avisos de manutenção."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [mensagem, comunicacao]
# variaveis:
#   - nome: MENSAGEM
#     rotulo: "Texto da mensagem"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: SEGUNDOS
#     rotulo: "Exibir por (segundos, 0 = até fechar)"
#     tipo: numero
#     padrao: 60
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$m = "$env:FAROL_MENSAGEM".Trim() -replace '[\r\n]+', ' '
if (-not $m) { Write-Output "Informe a mensagem."; exit 1 }
$s = Get-Num $env:FAROL_SEGUNDOS 60
if ($s -gt 0) { msg.exe * /TIME:$s "$m" } else { msg.exe * "$m" }
Write-Output "Mensagem enviada."
exit $(if ($LASTEXITCODE) { 1 } else { 0 })
