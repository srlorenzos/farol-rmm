# ---
# id: listar-copias-sombra-vss
# nome: "Listar cópias de sombra (VSS) e escritores"
# descricao: "Mostra cópias de sombra existentes, uso de armazenamento e estado dos escritores VSS (útil para diagnosticar falhas de backup)."
# categoria: Backup e recuperação
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [vss, backup]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

vssadmin list shadows 2>&1 | Out-String | Write-Output
vssadmin list shadowstorage 2>&1 | Out-String | Write-Output
Write-Output "== Escritores com problema =="
$w = vssadmin list writers 2>&1 | Out-String
$blocos = $w -split "(?m)^Writer name:" | Select-Object -Skip 1
$ruins = $blocos | Where-Object { $_ -notmatch 'State: \[1\] Stable' }
if ($ruins) { $ruins | ForEach-Object { "Writer name:" + (($_ -split "`n")[0..4] -join "`n") } } else { Write-Output "Todos os escritores estáveis." }
exit 0
