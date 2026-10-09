# ---
# id: criptografia-cifrar-espaco-livre
# nome: "Limpar espaço livre do disco (cipher /w)"
# descricao: "Sobrescreve o espaço livre de um volume para impedir recuperação de arquivos apagados (descarte de máquinas). Demorado e intensivo em disco."
# categoria: BitLocker e criptografia
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 14400
# requer_admin: true
# tags: [cipher, descarte, seguranca]
# variaveis:
#   - nome: UNIDADE
#     rotulo: "Letra da unidade"
#     tipo: texto
#     padrao: "C"
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
$u = if ("$env:FAROL_UNIDADE" -match '^[A-Za-z]:?$') { $env:FAROL_UNIDADE.Substring(0,1).ToUpper() } else { Write-Output "Unidade inválida."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para sobrescrever o espaço livre de ${u}: (pode levar horas)."; exit 0 }
cipher.exe /w:"${u}:\"
exit $LASTEXITCODE
