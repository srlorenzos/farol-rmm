# ---
# id: dispositivos-que-acordam-pc
# nome: "Dispositivos que podem acordar o computador"
# descricao: "Lista dispositivos com permissão de despertar (powercfg) e o último evento de despertar, para diagnosticar PCs que ligam sozinhos."
# categoria: Energia
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [wake, energia]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Output "== Dispositivos com permissão de despertar =="
powercfg /devicequery wake_armed
Write-Output "== Último despertar =="
powercfg /lastwake
Write-Output "== Temporizadores de despertar =="
powercfg /waketimers
exit 0
