# ---
# id: exportar-regras-firewall
# nome: "Exportar política do firewall"
# descricao: "Exporta toda a configuração do Firewall do Windows para um arquivo .wfw (backup/migração)."
# categoria: Firewall
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [firewall, backup]
# variaveis:
#   - nome: DESTINO
#     rotulo: "Pasta"
#     tipo: texto
#     padrao: "C:\\Windows\\Temp"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$d = if ($env:FAROL_DESTINO) { $env:FAROL_DESTINO } else { "$env:windir\Temp" }
New-Item $d -ItemType Directory -Force | Out-Null
$f = Join-Path $d ("firewall-{0}-{1:yyyyMMdd}.wfw" -f $env:COMPUTERNAME, (Get-Date))
netsh advfirewall export $f
exit $LASTEXITCODE
