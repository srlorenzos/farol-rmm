# ---
# id: conexoes-tcp-ativas
# nome: "Conexões TCP ativas com processo"
# descricao: "Lista conexões TCP estabelecidas com processo, endereço local e remoto, agrupadas para identificar tráfego suspeito."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [conexoes, netstat]
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

$d = Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | ForEach-Object {
  $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
  [pscustomobject]@{ Processo = $p.ProcessName; PID = $_.OwningProcess; Local = "$($_.LocalAddress):$($_.LocalPort)"; Remoto = "$($_.RemoteAddress):$($_.RemotePort)" }
} | Sort-Object Processo
Out-Dados $d
exit 0
