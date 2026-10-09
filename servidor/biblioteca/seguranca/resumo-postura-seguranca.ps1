# ---
# id: resumo-postura-seguranca
# nome: "Resumo da postura de segurança"
# descricao: "Coleta em um só relatório: Defender, firewall, UAC, Secure Boot, TPM, BitLocker, SMBv1, RDP, atualizações pendentes e contas administradoras."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: false
# tags: [seguranca, resumo]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function L($k, $v) { Write-Output ("{0,-28} {1}" -f $k, $v) }
$mp = Get-MpComputerStatus -ErrorAction SilentlyContinue
L 'Defender em tempo real' $(if ($mp) { $mp.RealTimeProtectionEnabled } else { 'indisponível' })
L 'Assinaturas (dias)' $(if ($mp) { [int]((Get-Date) - $mp.AntivirusSignatureLastUpdated).TotalDays } else { '-' })
L 'Firewall (perfis ativos)' ((Get-NetFirewallProfile | Where-Object Enabled | Select-Object -ExpandProperty Name) -join ',')
L 'UAC habilitado' ((Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -ErrorAction SilentlyContinue).EnableLUA)
L 'Secure Boot' $(try { Confirm-SecureBootUEFI } catch { 'não suportado/legado' })
$tpm = Get-Tpm -ErrorAction SilentlyContinue
L 'TPM presente/pronto' $(if ($tpm) { "$($tpm.TpmPresent)/$($tpm.TpmReady)" } else { '-' })
L 'BitLocker (C:)' $(try { (Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop).ProtectionStatus } catch { 'indisponível' })
L 'SMBv1 servidor' $(try { (Get-SmbServerConfiguration).EnableSMB1Protocol } catch { '-' })
L 'RDP habilitado' $(if ((Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server').fDenyTSConnections -eq 0) { 'sim' } else { 'não' })
L 'Admins locais' ((Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }) -join '; ')
L 'Reinício pendente' $(if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { 'sim' } else { 'não' })
exit 0
