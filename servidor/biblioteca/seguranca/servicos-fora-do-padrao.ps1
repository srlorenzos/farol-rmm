# ---
# id: servicos-fora-do-padrao
# nome: "Serviços com executável fora de pastas padrão"
# descricao: "Lista serviços cujo binário não está em Windows ou Program Files (candidatos a persistência/malware)."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [servicos, malware]
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

$d = Get-CimInstance Win32_Service | Where-Object { $_.PathName -and $_.PathName -notmatch '(?i)^"?[A-Z]:\\(Windows|Program Files|Program Files \(x86\))\\' } | ForEach-Object {
  [pscustomobject]@{ Servico = $_.Name; Estado = $_.State; Inicio = $_.StartMode; Conta = $_.StartName; Caminho = $_.PathName }
}
if (-not $d) { Write-Output "Todos os serviços estão em pastas padrão."; exit 0 }
Out-Dados $d
exit 0
