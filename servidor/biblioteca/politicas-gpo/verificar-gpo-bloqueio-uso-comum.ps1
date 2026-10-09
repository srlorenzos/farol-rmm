# ---
# id: verificar-gpo-bloqueio-uso-comum
# nome: "Verificar políticas que afetam usuários (restrições comuns)"
# descricao: "Checa políticas frequentemente responsáveis por chamados: bloqueio de painel de controle, regedit, cmd, USB, Windows Update e proxy."
# categoria: Políticas e GPO
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [gpo, diagnostico]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$t = @(
  @('Painel de Controle bloqueado', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer', 'NoControlPanel'),
  @('Regedit bloqueado', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System', 'DisableRegistryTools'),
  @('Prompt de comando bloqueado', 'HKCU:\Software\Policies\Microsoft\Windows\System', 'DisableCMD'),
  @('Gerenciador de Tarefas bloqueado', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System', 'DisableTaskMgr'),
  @('Unidades ocultas', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer', 'NoDrives'),
  @('Windows Update desativado por política', 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU', 'NoAutoUpdate'),
  @('Servidor WSUS configurado', 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate', 'WUServer'),
  @('Proxy forçado', 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\CurrentVersion\Internet Settings', 'ProxySettingsPerUser')
)
foreach ($i in $t) { $v = (Get-ItemProperty $i[1] -Name $i[2] -ErrorAction SilentlyContinue).($i[2]); Write-Output ("{0,-40} {1}" -f $i[0], $(if ($null -ne $v) { "SIM ($v)" } else { 'não' })) }
exit 0
