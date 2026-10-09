# ---
# id: ad-informacoes-dominio
# nome: "AD - informações do domínio e da floresta"
# descricao: "Mostra nível funcional, mestres de operação (FSMO), controladores de domínio e sites."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [ad, fsmo]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado (instale o RSAT)."; exit 1 }
Import-Module ActiveDirectory
$d = Get-ADDomain; $f = Get-ADForest
Write-Output ("Domínio: {0}  (NetBIOS {1})  Nível: {2}" -f $d.DNSRoot, $d.NetBIOSName, $d.DomainMode)
Write-Output ("Floresta: {0}  Nível: {1}" -f $f.Name, $f.ForestMode)
Write-Output ("PDC: {0}  RID: {1}  Infra: {2}" -f $d.PDCEmulator, $d.RIDMaster, $d.InfrastructureMaster)
Write-Output ("Schema: {0}  Naming: {1}" -f $f.SchemaMaster, $f.DomainNamingMaster)
Get-ADDomainController -Filter * | Select-Object Name, IPv4Address, Site, OperatingSystem, IsGlobalCatalog | Format-Table -AutoSize | Out-String | Write-Output
exit 0
