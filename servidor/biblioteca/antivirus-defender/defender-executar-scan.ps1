# ---
# id: defender-executar-scan
# nome: "Executar varredura do Defender"
# descricao: "Dispara varredura rápida, completa ou de um caminho específico com o Defender."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 7200
# requer_admin: true
# tags: [defender, scan]
# variaveis:
#   - nome: TIPO
#     rotulo: "Tipo de varredura"
#     tipo: selecao
#     padrao: "rapida"
#     obrigatorio: true
#     opcoes: [rapida, completa, caminho]
#   - nome: CAMINHO
#     rotulo: "Caminho (se tipo=caminho)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
switch ("$env:FAROL_TIPO") {
  'completa' { Start-MpScan -ScanType FullScan }
  'caminho' {
    $c = "$env:FAROL_CAMINHO".Trim()
    if (-not (Test-Path -LiteralPath $c)) { Write-Output "Caminho inválido."; exit 1 }
    Start-MpScan -ScanType CustomScan -ScanPath $c
  }
  default { Start-MpScan -ScanType QuickScan }
}
Write-Output "Varredura concluída."
Get-MpThreat -ErrorAction SilentlyContinue | Select-Object ThreatName, IsActive, Resources | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
