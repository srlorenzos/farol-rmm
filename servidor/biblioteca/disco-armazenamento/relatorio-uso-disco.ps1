# ---
# id: relatorio-uso-disco
# nome: "Relatório de uso de disco por volume"
# descricao: "Lista todos os volumes fixos com tamanho, espaço livre, percentual usado, sistema de arquivos e saúde."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [disco, espaco]
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

$d = Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.Size -gt 0 } | ForEach-Object {
  [pscustomobject]@{
    Unidade = if ($_.DriveLetter) { "$($_.DriveLetter):" } else { '-' }
    Rotulo = $_.FileSystemLabel
    Sistema = $_.FileSystem
    TamanhoGB = [math]::Round($_.Size / 1GB, 1)
    LivreGB = [math]::Round($_.SizeRemaining / 1GB, 1)
    UsadoPct = [math]::Round(100 - ($_.SizeRemaining / $_.Size * 100), 1)
    Saude = $_.HealthStatus
  }
}
Out-Dados $d
exit 0
