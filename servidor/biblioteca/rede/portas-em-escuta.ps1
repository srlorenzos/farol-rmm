# ---
# id: portas-em-escuta
# nome: "Portas em escuta"
# descricao: "Lista portas TCP/UDP em escuta com o processo responsável, útil para auditar serviços expostos."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [portas, auditoria]
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
$d += Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ Proto = 'TCP'; Endereco = $_.LocalAddress; Porta = $_.LocalPort; PID = $_.OwningProcess; Processo = (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } }
$d += Get-NetUDPEndpoint -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ Proto = 'UDP'; Endereco = $_.LocalAddress; Porta = $_.LocalPort; PID = $_.OwningProcess; Processo = (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } }
Out-Dados ($d | Sort-Object Proto, Porta)
exit 0
