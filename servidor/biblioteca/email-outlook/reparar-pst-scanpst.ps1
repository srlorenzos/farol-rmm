# ---
# id: reparar-pst-scanpst
# nome: "Verificar integridade de PST/OST (SCANPST)"
# descricao: "Localiza o SCANPST.EXE instalado e informa o caminho e a linha de comando para reparar um arquivo; o reparo é interativo por design."
# categoria: E-mail e Outlook
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [outlook, pst, reparo]
# variaveis:
#   - nome: ARQUIVO
#     rotulo: "PST/OST a verificar"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$s = Get-ChildItem "$env:ProgramFiles\Microsoft Office", "${env:ProgramFiles(x86)}\Microsoft Office" -Recurse -Filter SCANPST.EXE -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $s) { Write-Output "SCANPST.EXE não encontrado (Office instalado?)."; exit 1 }
Write-Output "SCANPST: $($s.FullName)"
$a = "$env:FAROL_ARQUIVO".Trim()
if ($a) { if (Test-Path -LiteralPath $a) { $f = Get-Item -LiteralPath $a; Write-Output ("Arquivo: {0} ({1}) - feche o Outlook e execute o SCANPST com este caminho." -f $f.FullName, (Format-Tam $f.Length)) } else { Write-Output "Arquivo não encontrado."; exit 1 } }
exit 0
