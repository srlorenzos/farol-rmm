# ---
# id: compartilhamentos-smb-locais
# nome: "Compartilhamentos SMB e sessões"
# descricao: "Lista pastas compartilhadas, permissões de compartilhamento e sessões SMB abertas."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [smb, compartilhamento]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Output "== Compartilhamentos =="
Get-SmbShare | Select-Object Name, Path, Description | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "== Permissões =="
Get-SmbShare | Where-Object { -not $_.Special } | ForEach-Object { Get-SmbShareAccess -Name $_.Name } | Select-Object Name, AccountName, AccessControlType, AccessRight | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "== Sessões =="
Get-SmbSession -ErrorAction SilentlyContinue | Select-Object ClientComputerName, ClientUserName, NumOpens | Format-Table -AutoSize | Out-String | Write-Output
exit 0
