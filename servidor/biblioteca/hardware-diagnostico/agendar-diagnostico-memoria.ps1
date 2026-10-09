# ---
# id: agendar-diagnostico-memoria
# nome: "Agendar diagnóstico de memória do Windows"
# descricao: "Agenda o Diagnóstico de Memória (mdsched) para a próxima reinicialização. Não reinicia sozinho."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [memoria, diagnostico]
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
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para agendar o teste de memória no próximo boot."; exit 0 }
bcdedit /bootsequence '{memdiag}' | Out-Null
Write-Output "Teste de memória agendado para o próximo boot (reinicie quando conveniente)."
exit $LASTEXITCODE
