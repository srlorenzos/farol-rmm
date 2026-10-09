# ---
# id: perifericos-audio-bluetooth
# nome: "Dispositivos de áudio e Bluetooth"
# descricao: "Lista dispositivos de áudio, câmeras e Bluetooth com estado, para suporte a videoconferências."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [audio, camera, bluetooth]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

foreach ($c in 'MEDIA', 'Camera', 'Image', 'Bluetooth', 'AudioEndpoint') {
  $d = Get-PnpDevice -Class $c -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne 'Unknown' }
  if ($d) { Write-Output "== $c =="; $d | ForEach-Object { Write-Output ("{0,-8} {1}" -f $_.Status, $_.FriendlyName) } }
}
exit 0
