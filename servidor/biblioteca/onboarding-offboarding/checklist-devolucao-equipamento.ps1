# ---
# id: checklist-devolucao-equipamento
# nome: "Checklist de devolução de equipamento"
# descricao: "Relatório para offboarding de equipamento: usuário logado, contas locais, software licenciado, estado do BitLocker, serial e itens a recolher (periféricos USB)."
# categoria: Onboarding e offboarding
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [offboarding, equipamento]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$cs = Get-CimInstance Win32_ComputerSystem; $b = Get-CimInstance Win32_BIOS
Write-Output ("Equipamento: {0} {1} - Serial {2} - Nome {3}" -f $cs.Manufacturer, $cs.Model, $b.SerialNumber, $env:COMPUTERNAME)
Write-Output ("Último usuário: {0}" -f $cs.UserName)
Write-Output "Contas locais ativas:"; Get-LocalUser | Where-Object Enabled | ForEach-Object { " - $($_.Name) (último logon $($_.LastLogon))" }
Write-Output "BitLocker:"; Get-BitLockerVolume -ErrorAction SilentlyContinue | ForEach-Object { " - $($_.MountPoint) $($_.ProtectionStatus)" }
Write-Output "Software de interesse:"; Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Office|Adobe|AutoCAD|VPN|AnyConnect|Citrix|Teams' } | ForEach-Object { " - $($_.DisplayName)" }
Write-Output "Dispositivos USB conectados:"; Get-PnpDevice -PresentOnly -Class USB -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -notmatch 'Hub|Host Controller|Composite' } | ForEach-Object { " - $($_.FriendlyName)" }
exit 0
