# ---
# id: tamanho-logs-eventos
# nome: "Tamanho e retenção dos logs de eventos"
# descricao: "Lista logs de eventos com tamanho em disco, tamanho máximo e registros, destacando os maiores."
# categoria: Registro e logs do sistema
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [logs, eventos]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-WinEvent -ListLog * -ErrorAction SilentlyContinue | Where-Object { $_.RecordCount -gt 0 } | Sort-Object FileSize -Descending | Select-Object -First 20 LogName, @{n='TamanhoMB';e={[math]::Round($_.FileSize/1MB,1)}}, @{n='MaxMB';e={[math]::Round($_.MaximumSizeInBytes/1MB)}}, RecordCount, LogMode | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
