# ---
# id: listar-programas-inicializacao-impacto
# nome: "Impacto dos programas de inicialização"
# descricao: "Lista aplicativos de inicialização com o impacto reportado pelo Gerenciador de Tarefas (StartupApproved) e status habilitado/desabilitado."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [inicializacao, boot]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$cmd = Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location, User
$ap = @{}
foreach ($k in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run') {
  $p = Get-ItemProperty $k -ErrorAction SilentlyContinue
  if ($p) { $p.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { $ap[$_.Name] = ($_.Value[0] -band 1) -eq 0 } }
}
$cmd | ForEach-Object { [pscustomobject]@{ Nome = $_.Name; Habilitado = $(if ($ap.ContainsKey($_.Name)) { $ap[$_.Name] } else { $true }); Comando = $_.Command } } | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
exit 0
