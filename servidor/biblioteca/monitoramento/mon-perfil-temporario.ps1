# ---
# id: mon-perfil-temporario
# nome: "Monitor - perfis de usuário temporários"
# descricao: "Detecta perfis com sufixo .bak ou estado anormal no registro (usuário logando com perfil temporário)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [perfis, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$bad = @(Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList' | Where-Object { $_.PSChildName -match '\.bak$' })
if ($bad.Count) { Out-Status 'alerta' "$($bad.Count) chave(s) de perfil .bak encontrada(s)" } else { Out-Status 'ok' 'Perfis sem sinais de corrupção' }
exit 0
