# ---
# id: mon-smbv1-habilitado
# nome: "Monitor - SMBv1 habilitado"
# descricao: "Alerta se o protocolo SMBv1 está habilitado no servidor SMB."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [smb, seguranca, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

try { $s = (Get-SmbServerConfiguration -ErrorAction Stop).EnableSMB1Protocol } catch { Out-Status 'alerta' 'Não foi possível consultar o SMB'; exit 0 }
if ($s) { Out-Status 'critico' 'SMBv1 habilitado' } else { Out-Status 'ok' 'SMBv1 desabilitado' }
exit 0
