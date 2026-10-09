# ---
# id: processos-nao-assinados
# nome: "Processos em execução sem assinatura digital"
# descricao: "Verifica a assinatura Authenticode dos executáveis em execução e lista os não assinados ou inválidos fora de System32."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 300
# requer_admin: false
# tags: [processos, assinatura]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$vistos = @{}
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path } | ForEach-Object {
  if ($vistos[$_.Path]) { return }; $vistos[$_.Path] = 1
  if ($_.Path -like "$env:windir\*") { return }
  $s = Get-AuthenticodeSignature -FilePath $_.Path -ErrorAction SilentlyContinue
  if ($s.Status -ne 'Valid') { [pscustomobject]@{ Processo = $_.ProcessName; Assinatura = $s.Status; Caminho = $_.Path } }
} | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
exit 0
