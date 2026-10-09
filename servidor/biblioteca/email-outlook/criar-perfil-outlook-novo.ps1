# ---
# id: criar-perfil-outlook-novo
# nome: "Configurar Outlook para sempre solicitar perfil / novo perfil"
# descricao: "Ajusta o registro para que o Outlook exiba o seletor de perfil na abertura (útil para criar um novo perfil sem apagar o antigo)."
# categoria: E-mail e Outlook
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [outlook, perfil]
# variaveis:
#   - nome: MODO
#     rotulo: "Comportamento"
#     tipo: selecao
#     padrao: "perguntar"
#     obrigatorio: true
#     opcoes: [perguntar, padrao]
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para alterar."; exit 0 }
$k = 'HKCU:\Software\Microsoft\Office\16.0\Outlook'
if (-not (Test-Path $k)) { Write-Output "Outlook 16.0 não configurado para este usuário."; exit 1 }
Set-ItemProperty $k PromptForProfile $(if ("$env:FAROL_MODO" -eq 'padrao') { 0 } else { 1 }) -Type DWord
Write-Output "Configuração aplicada."
exit 0
