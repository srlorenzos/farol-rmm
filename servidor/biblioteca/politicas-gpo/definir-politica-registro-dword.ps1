# ---
# id: definir-politica-registro-dword
# nome: "Aplicar valor de política no registro"
# descricao: "Grava um valor (DWORD ou texto) em uma chave de política do registro (HKLM ou HKCU). Restrito a ramos Policies por segurança; remove quando o valor é vazio."
# categoria: Políticas e GPO
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [gpo, registro, politica]
# variaveis:
#   - nome: CHAVE
#     rotulo: "Chave (ex.: HKLM:\\SOFTWARE\\Policies\\Contoso)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: NOME
#     rotulo: "Nome do valor"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: VALOR
#     rotulo: "Valor (vazio remove)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: TIPO
#     rotulo: "Tipo"
#     tipo: selecao
#     padrao: "DWord"
#     obrigatorio: false
#     opcoes: [DWord, String]
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
$k = "$env:FAROL_CHAVE".Trim(); $n = "$env:FAROL_NOME".Trim(); $v = "$env:FAROL_VALOR"
if ($k -notmatch '^HK(LM|CU):\\SOFTWARE\\(Policies|WOW6432Node\\Policies)\\[\w \\.-]+$' -or $k -match '\.\.') { Write-Output "Chave recusada: apenas HKLM:/HKCU:\SOFTWARE\Policies\... é permitido."; exit 1 }
if ($n -notmatch '^[\w .-]+$') { Write-Output "Nome inválido."; exit 1 }
$atual = (Get-ItemProperty $k -Name $n -ErrorAction SilentlyContinue).$n
Write-Output "Valor atual: $atual"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
if ($v -eq '') { Remove-ItemProperty $k -Name $n -ErrorAction SilentlyContinue; Write-Output "Valor removido."; exit 0 }
if (-not (Test-Path $k)) { New-Item $k -Force | Out-Null }
if ("$env:FAROL_TIPO" -eq 'String') { Set-ItemProperty $k $n $v -Type String } else { if ($v -notmatch '^\d+$') { Write-Output "DWORD exige número."; exit 1 }; Set-ItemProperty $k $n ([int]$v) -Type DWord }
Write-Output "Aplicado."
exit 0
