# ---
# id: rastrear-rota
# nome: "Rastrear rota até um destino"
# descricao: "Executa traceroute (Test-NetConnection -TraceRoute) para um host e lista os saltos."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: false
# tags: [traceroute, rede]
# variaveis:
#   - nome: HOST
#     rotulo: "Destino"
#     tipo: texto
#     padrao: "8.8.8.8"
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$h = "$env:FAROL_HOST".Trim()
if ($h -notmatch '^[A-Za-z0-9._:-]+$') { Write-Output "Host inválido."; exit 1 }
$r = Test-NetConnection -ComputerName $h -TraceRoute -WarningAction SilentlyContinue
$i = 0
$r.TraceRoute | ForEach-Object { $i++; Write-Output ("{0,2}  {1}" -f $i, $_) }
exit 0
