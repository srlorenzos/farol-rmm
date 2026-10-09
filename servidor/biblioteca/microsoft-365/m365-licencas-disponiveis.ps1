# ---
# id: m365-licencas-disponiveis
# nome: "Microsoft 365 - licenças e consumo"
# descricao: "Lista SKUs de licença do tenant com total, consumidas e disponíveis (Graph)."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [m365, licencas, graph]
# variaveis:
#   - nome: TENANT_ID
#     rotulo: "ID do tenant (app-only, opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: CLIENT_ID
#     rotulo: "ID do aplicativo (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: CLIENT_SECRET
#     rotulo: "Segredo do aplicativo (opcional)"
#     tipo: senha
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Module -ListAvailable Microsoft.Graph.Identity.DirectoryManagement)) { Write-Output "Módulo Microsoft.Graph não instalado. Use o script de instalação dos módulos."; exit 1 }
Import-Module Microsoft.Graph.Identity.DirectoryManagement
if ($env:FAROL_TENANT_ID -and $env:FAROL_CLIENT_ID -and $env:FAROL_CLIENT_SECRET) {
  Connect-MgGraph -TenantId $env:FAROL_TENANT_ID -ClientSecretCredential (New-Object PSCredential($env:FAROL_CLIENT_ID, (ConvertTo-SecureString $env:FAROL_CLIENT_SECRET -AsPlainText -Force))) -NoWelcome
} else { Connect-MgGraph -Scopes 'Organization.Read.All' -NoWelcome }
Get-MgSubscribedSku | ForEach-Object { [pscustomobject]@{ Licenca = $_.SkuPartNumber; Total = $_.PrepaidUnits.Enabled; Usadas = $_.ConsumedUnits; Livres = $_.PrepaidUnits.Enabled - $_.ConsumedUnits } } | Format-Table -AutoSize | Out-String | Write-Output
Disconnect-MgGraph | Out-Null
exit 0
