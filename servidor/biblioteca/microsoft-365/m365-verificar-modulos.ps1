# ---
# id: m365-verificar-modulos
# nome: "Microsoft 365 - verificar módulos instalados"
# descricao: "Verifica se os módulos ExchangeOnlineManagement, Microsoft.Graph, MicrosoftTeams e MSOnline estão instalados e orienta a instalação."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [m365, modulos]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

foreach ($m in 'ExchangeOnlineManagement', 'Microsoft.Graph', 'MicrosoftTeams', 'Microsoft.Online.SharePoint.PowerShell', 'MSOnline') {
  $i = Get-Module -ListAvailable -Name $m | Sort-Object Version -Descending | Select-Object -First 1
  if ($i) { Write-Output ("[OK]  {0} {1}" -f $m, $i.Version) } else { Write-Output ("[--]  {0} não instalado. Instale com: Install-Module {0} -Scope AllUsers -Force" -f $m) }
}
Write-Output ""
Write-Output "Versão do PowerShell: $($PSVersionTable.PSVersion)"
exit 0
