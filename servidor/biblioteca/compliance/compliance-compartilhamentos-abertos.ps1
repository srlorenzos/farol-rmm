# ---
# id: compliance-compartilhamentos-abertos
# nome: "Compliance - compartilhamentos com acesso amplo"
# descricao: "Detecta compartilhamentos SMB que concedem acesso a Everyone/Usuários Autenticados."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [smb, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$achou = $false
Get-SmbShare | Where-Object { -not $_.Special } | ForEach-Object {
  $n = $_.Name
  Get-SmbShareAccess -Name $n | Where-Object { $_.AccountName -match 'Everyone|Todos|Authenticated Users|Usuários Autenticados' -and $_.AccessControlType -eq 'Allow' } | ForEach-Object { $achou = $true; Write-Output ("[FALHOU] {0}: {1} tem {2}" -f $n, $_.AccountName, $_.AccessRight) }
}
if (-not $achou) { Write-Output "Nenhum compartilhamento com acesso amplo." }
exit 0
