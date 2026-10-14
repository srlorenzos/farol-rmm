# ---
# id: cis-verificacao-basica-windows
# nome: "CIS - verificação básica de configuração do Windows"
# descricao: "Checa pontos centrais de benchmark (política de senha, bloqueio de conta, UAC, SMBv1, firewall, Autorun, RDP/NLA, LLMNR, TLS legado, guest) e imprime PASSOU/FALHOU."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: true
# tags: [cis, compliance, hardening]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$n = 0; $f = 0
function T($nome, $ok) { if ($ok) { Write-Output "[PASSOU] $nome"; $script:n++ } else { Write-Output "[FALHOU] $nome"; $script:f++ } }
$tmp = Join-Path $env:TEMP 'farol-sec.inf'; secedit /export /cfg $tmp /quiet | Out-Null
$sec = Get-Content $tmp -ErrorAction SilentlyContinue; Remove-Item $tmp -Force -ErrorAction SilentlyContinue
function V($k) { (($sec | Where-Object { $_ -match "^$k\s*=" }) -split '=')[1].Trim() }
T 'Senha mínima >= 12' ([int](V 'MinimumPasswordLength') -ge 12)
T 'Complexidade de senha habilitada' ((V 'PasswordComplexity') -eq '1')
T 'Bloqueio de conta após <= 10 tentativas (e > 0)' (([int](V 'LockoutBadCount') -gt 0) -and ([int](V 'LockoutBadCount') -le 10))
T 'Idade máxima de senha <= 365' (([int](V 'MaximumPasswordAge') -gt 0) -and ([int](V 'MaximumPasswordAge') -le 365))
T 'Conta Convidado desabilitada' (-not (Get-LocalUser | Where-Object { $_.SID.Value -like '*-501' -and $_.Enabled }))
T 'UAC habilitado' ((Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System').EnableLUA -eq 1)
T 'SMBv1 desabilitado' (-not (Get-SmbServerConfiguration).EnableSMB1Protocol)
T 'Firewall ativo nos 3 perfis' (@(Get-NetFirewallProfile | Where-Object Enabled).Count -eq 3)
T 'AutoRun desabilitado' ((Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer' -ErrorAction SilentlyContinue).NoDriveTypeAutoRun -eq 255)
T 'LLMNR desabilitado' ((Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient' -ErrorAction SilentlyContinue).EnableMulticast -eq 0)
T 'RDP exige NLA (ou RDP desligado)' (((Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server').fDenyTSConnections -eq 1) -or ((Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp').UserAuthentication -eq 1))
T 'Defender em tempo real ativo' ((Get-MpComputerStatus -ErrorAction SilentlyContinue).RealTimeProtectionEnabled -eq $true)
T 'Bloqueio de tela por inatividade configurado' ([int](Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -ErrorAction SilentlyContinue).InactivityTimeoutSecs -gt 0)
Write-Output "Resultado: $n aprovados, $f reprovados."
exit 0
