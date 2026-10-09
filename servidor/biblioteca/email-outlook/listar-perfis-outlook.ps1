# ---
# id: listar-perfis-outlook
# nome: "Listar perfis e contas do Outlook"
# descricao: "Lista perfis do Outlook do usuário e arquivos de dados (PST/OST) com tamanho, a partir do registro."
# categoria: E-mail e Outlook
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [outlook, perfis]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

foreach ($v in '16.0', '15.0') {
  $k = "HKCU:\Software\Microsoft\Office\$v\Outlook\Profiles"
  if (Test-Path $k) { Write-Output "Outlook $v - perfis:"; Get-ChildItem $k | ForEach-Object { Write-Output "  - $($_.PSChildName)" } }
}
$pastas = "$env:LOCALAPPDATA\Microsoft\Outlook", "$env:USERPROFILE\Documents\Arquivos do Outlook", "$env:USERPROFILE\Documents\Outlook Files"
foreach ($p in $pastas) { Get-ChildItem $p -Include *.ost, *.pst -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ("{0}  {1}" -f $_.FullName, (Format-Tam $_.Length)) } }
exit 0
