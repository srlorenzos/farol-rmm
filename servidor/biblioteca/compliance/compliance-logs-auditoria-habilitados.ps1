# ---
# id: compliance-logs-auditoria-habilitados
# nome: "Compliance - política de auditoria e retenção de logs"
# descricao: "Mostra a política de auditoria avançada (logon, contas, privilégios) e o tamanho dos logs de eventos principais."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [auditoria, logs, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

auditpol /get /category:"Logon/Logoff","Account Logon","Account Management","Privilege Use","Policy Change" 2>&1 | Out-String | Write-Output
foreach ($l in 'Security', 'System', 'Application') { $i = Get-WinEvent -ListLog $l; Write-Output ("{0}: máx {1} MB, modo {2}" -f $l, [math]::Round($i.MaximumSizeInBytes / 1MB), $i.LogMode) }
exit 0
