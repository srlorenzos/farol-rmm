# ---
# id: exibir-fontes-wsus-atualizacao
# nome: "Verificar origem das atualizações (WSUS/Windows Update/Intune)"
# descricao: "Informa se o computador usa WSUS, Windows Update for Business ou Intune e qual é o servidor configurado."
# categoria: Políticas e GPO
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [wsus, atualizacoes, politica]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$k = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate'
$p = Get-ItemProperty $k -ErrorAction SilentlyContinue
$au = Get-ItemProperty "$k\AU" -ErrorAction SilentlyContinue
Write-Output ("WUServer: {0}`nWUStatusServer: {1}`nUseWUServer: {2}`nNoAutoUpdate: {3}`nDeferQualityUpdatesPeriodInDays: {4}`nDeferFeatureUpdatesPeriodInDays: {5}" -f $p.WUServer, $p.WUStatusServer, $au.UseWUServer, $au.NoAutoUpdate, $p.DeferQualityUpdatesPeriodInDays, $p.DeferFeatureUpdatesPeriodInDays)
$s = New-Object -ComObject Microsoft.Update.ServiceManager
$s.Services | ForEach-Object { Write-Output ("Serviço de atualização: {0} (padrão={1})" -f $_.Name, $_.IsDefaultAUService) }
exit 0
