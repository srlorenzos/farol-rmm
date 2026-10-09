# ---
# id: otimizar-volumes
# nome: "Otimizar volumes (TRIM/desfragmentação)"
# descricao: "Executa TRIM em SSDs e desfragmentação em HDDs usando Optimize-Volume; no modo análise apenas reporta a fragmentação."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [defrag, trim, ssd]
# variaveis:
#   - nome: MODO
#     rotulo: "Modo"
#     tipo: selecao
#     padrao: "analisar"
#     obrigatorio: false
#     opcoes: [analisar, otimizar]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$otim = "$env:FAROL_MODO" -eq 'otimizar'
Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' -and $_.FileSystem -eq 'NTFS' } | ForEach-Object {
  $l = $_.DriveLetter
  if ($otim) { Write-Output "Otimizando ${l}:"; Optimize-Volume -DriveLetter $l -Verbose 4>&1 | Out-String | Write-Output }
  else { Write-Output "Analisando ${l}:"; Optimize-Volume -DriveLetter $l -Analyze -Verbose 4>&1 | Out-String | Write-Output }
}
exit 0
