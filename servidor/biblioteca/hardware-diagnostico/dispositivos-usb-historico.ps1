# ---
# id: dispositivos-usb-historico
# nome: "Dispositivos USB conectados e histórico"
# descricao: "Lista dispositivos USB presentes e o histórico de dispositivos de armazenamento já conectados (USBSTOR)."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [usb, auditoria]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Output "== Conectados agora =="
Get-PnpDevice -PresentOnly -Class USB, DiskDrive -ErrorAction SilentlyContinue | Select-Object Class, FriendlyName, Status | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
Write-Output "== Histórico USBSTOR =="
Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Enum\USBSTOR' -ErrorAction SilentlyContinue | ForEach-Object { Get-ChildItem $_.PSPath | ForEach-Object { (Get-ItemProperty $_.PSPath).FriendlyName } } | Sort-Object -Unique | ForEach-Object { " - $_" }
exit 0
