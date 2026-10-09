# ---
# id: executar-comando-powershell
# nome: "Executar comando PowerShell personalizado"
# descricao: "Executa um bloco PowerShell informado e retorna a saída. Pensado para ações pontuais; exige confirmação explícita porque executa código arbitrário."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [personalizado, console]
# variaveis:
#   - nome: COMANDO
#     rotulo: "Comando PowerShell"
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
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

$c = "$env:FAROL_COMANDO"
if (-not $c.Trim()) { Write-Output "Informe COMANDO."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Executaria: $c`nDefina CONFIRMAR=true."; exit 0 }
try { Invoke-Expression $c | Out-String | Write-Output } catch { Write-Output "Erro: $($_.Exception.Message)"; exit 1 }
exit 0
