# ---
# id: limpar-cache-miniaturas-icones
# nome: "Limpar cache de miniaturas e ícones"
# descricao: "Remove thumbcache e iconcache dos perfis para corrigir ícones/miniaturas corrompidos. Explorer é reiniciado ao aplicar."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: false
# tags: [explorer, cache, icones]
# variaveis:
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }
function Test-Simular { -not ("$env:FAROL_SIMULAR" -match '^(0|false|nao|não|n|no|falso)$') }

$sim = Test-Simular
$alvos = @()
$alvos += Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter 'thumbcache_*.db' -Force -ErrorAction SilentlyContinue
$alvos += Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter 'iconcache_*.db' -Force -ErrorAction SilentlyContinue
$alvos += Get-Item "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue
Write-Output ("{0} arquivo(s) de cache, {1}" -f $alvos.Count, (Format-Tam ([int64](($alvos | Measure-Object Length -Sum).Sum))))
if ($sim) { Write-Output "SIMULAÇÃO: nada removido."; exit 0 }
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep 2
$alvos | Remove-Item -Force -ErrorAction SilentlyContinue
Start-Process explorer.exe
Write-Output "Cache removido e Explorer reiniciado."
exit 0
