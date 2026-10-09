# ---
# id: relatorio-gpresult-html
# nome: "Gerar relatório de GPO aplicadas (HTML)"
# descricao: "Gera o relatório gpresult em HTML para o computador (e usuário atual quando possível) em uma pasta definida."
# categoria: Políticas e GPO
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 300
# requer_admin: true
# tags: [gpo, gpresult]
# variaveis:
#   - nome: DESTINO
#     rotulo: "Pasta de saída"
#     tipo: texto
#     padrao: "C:\\Windows\\Temp"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$d = if ($env:FAROL_DESTINO) { $env:FAROL_DESTINO } else { "$env:windir\Temp" }
New-Item $d -ItemType Directory -Force | Out-Null
$f = Join-Path $d "gpresult-$env:COMPUTERNAME-$(Get-Date -Format yyyyMMdd-HHmm).html"
gpresult /scope computer /h $f /f
if (Test-Path $f) { Write-Output "Relatório gerado: $f ($(Format-Tam (Get-Item $f).Length))" } else { Write-Output "Falha ao gerar relatório."; exit 1 }
exit 0
