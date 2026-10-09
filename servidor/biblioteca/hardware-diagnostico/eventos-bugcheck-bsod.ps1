# ---
# id: eventos-bugcheck-bsod
# nome: "Telas azuis (BSOD) recentes"
# descricao: "Lista eventos BugCheck e Kernel-Power críticos recentes e os dumps encontrados para diagnóstico de instabilidade."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [bsod, estabilidade]
# variaveis:
#   - nome: DIAS
#     rotulo: "Janela (dias)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$ini = (Get-Date).AddDays(-(Get-Num $env:FAROL_DIAS 30))
$e = Get-WinEvent -FilterHashtable @{ LogName = 'System'; Id = 1001, 41; StartTime = $ini } -ErrorAction SilentlyContinue | Where-Object { $_.ProviderName -match 'BugCheck|Kernel-Power' }
if (-not $e) { Write-Output "Nenhum BugCheck/queda de energia inesperada em $($ini.ToString('yyyy-MM-dd'))."; } else { $e | Select-Object TimeCreated, ProviderName, @{n='Mensagem';e={ ($_.Message -split "`n")[0] }} | Format-Table -AutoSize -Wrap | Out-String -Width 200 | Write-Output }
Get-ChildItem "$env:windir\Minidump" -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Output
exit 0
