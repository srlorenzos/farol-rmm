# ---
# id: itens-de-inicializacao
# nome: "Itens de inicialização automática"
# descricao: "Lista programas que iniciam com o Windows (chaves Run, pasta Inicializar e tarefas de logon) para detectar persistência indesejada."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [startup, persistencia]
# variaveis:
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Dados($d) { if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json -Depth 4 } else { ($d | Format-Table -AutoSize | Out-String -Width 220).TrimEnd() } }

$d = @()
foreach ($k in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run') {
  $p = Get-ItemProperty $k -ErrorAction SilentlyContinue
  if ($p) { $p.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { $d += [pscustomobject]@{ Origem = $k -replace 'Microsoft\\Windows\\CurrentVersion\\', ''; Nome = $_.Name; Comando = $_.Value } } }
}
foreach ($f in "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp", "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup") {
  Get-ChildItem $f -ErrorAction SilentlyContinue | ForEach-Object { $d += [pscustomobject]@{ Origem = 'Pasta Inicializar'; Nome = $_.Name; Comando = $_.FullName } }
}
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.State -ne 'Disabled' -and ($_.Triggers | Where-Object { $_.CimClass.CimClassName -match 'Logon|Boot' }) -and $_.TaskPath -notlike '\Microsoft\*' } | ForEach-Object { $d += [pscustomobject]@{ Origem = 'Tarefa agendada'; Nome = $_.TaskName; Comando = ($_.Actions | Select-Object -First 1).Execute } }
Out-Dados $d
exit 0
