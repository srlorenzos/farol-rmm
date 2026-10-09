# ---
# id: perfis-temporarios-corrompidos
# nome: "Detectar perfis temporários ou corrompidos"
# descricao: "Procura chaves ProfileList com sufixo .bak e perfis com status anormal, causa comum de \"perfil temporário\" no logon."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [perfil, diagnostico]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$base = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList'
$achou = $false
Get-ChildItem $base | ForEach-Object {
  $p = Get-ItemProperty $_.PSPath
  if ($_.PSChildName -match '\.bak$' -or $p.State -gt 0) { $achou = $true; Write-Output ("{0}  Caminho={1}  Estado={2}" -f $_.PSChildName, $p.ProfileImagePath, $p.State) }
}
if (-not $achou) { Write-Output "Nenhum perfil com indício de corrupção." }
exit 0
