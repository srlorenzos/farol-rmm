# ---
# id: inventario-compartilhamentos-e-mapeamentos
# nome: "Mapeamentos de unidade e compartilhamentos do usuário"
# descricao: "Lista unidades de rede mapeadas, compartilhamentos publicados e impressoras de rede conectadas do usuário atual."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [mapeamentos, smb]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Output "== Unidades mapeadas =="
Get-SmbMapping -ErrorAction SilentlyContinue | Format-Table LocalPath, RemotePath, Status -AutoSize | Out-String | Write-Output
Write-Output "== Compartilhamentos locais =="
Get-SmbShare -ErrorAction SilentlyContinue | Where-Object { -not $_.Special } | Format-Table Name, Path -AutoSize | Out-String | Write-Output
Write-Output "== Impressoras de rede conectadas =="
Get-Printer | Where-Object { $_.Name -like '\\*' } | Format-Table Name, DriverName -AutoSize | Out-String | Write-Output
exit 0
