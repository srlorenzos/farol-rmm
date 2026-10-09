# ---
# id: espelhar-pasta-robocopy
# nome: "Copiar ou espelhar pasta com robocopy"
# descricao: "Copia uma pasta para outro destino com robocopy (cópia incremental, preserva permissões). O modo espelho (apaga no destino) é opcional e pede confirmação; modo simulação por padrão (/L)."
# categoria: Backup e recuperação
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 7200
# requer_admin: true
# tags: [robocopy, backup]
# variaveis:
#   - nome: ORIGEM
#     rotulo: "Pasta de origem"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ESPELHAR
#     rotulo: "Espelhar (apaga extras no destino)"
#     tipo: booleano
#     padrao: false
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
function Test-Sim($v) { "$v" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }
function Test-Simular { -not ("$env:FAROL_SIMULAR" -match '^(0|false|nao|não|n|no|falso)$') }

$o = "$env:FAROL_ORIGEM".Trim().TrimEnd('\'); $d = "$env:FAROL_DESTINO".Trim().TrimEnd('\')
if (-not (Test-Path -LiteralPath $o -PathType Container)) { Write-Output "Origem inexistente."; exit 1 }
if ($o -eq $d -or $d -match '^[A-Za-z]:$') { Write-Output "Destino inválido."; exit 1 }
$sim = Test-Simular
$a = @($o, $d, '/E', '/COPY:DAT', '/R:2', '/W:5', '/NP', '/NFL', '/NDL', '/XJ')
if (Test-Sim $env:FAROL_ESPELHAR) { $a = @($o, $d, '/MIR', '/COPY:DAT', '/R:2', '/W:5', '/NP', '/NFL', '/NDL', '/XJ') }
if ($sim) { $a += '/L'; Write-Output "SIMULAÇÃO (/L): nada será copiado." }
& robocopy.exe @a
$c = $LASTEXITCODE
Write-Output "Código robocopy: $c (0-7 = sucesso, >=8 = erro)"
exit $(if ($c -ge 8) { 1 } else { 0 })
