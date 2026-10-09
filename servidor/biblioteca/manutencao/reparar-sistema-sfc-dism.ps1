# ---
# id: reparar-sistema-sfc-dism
# nome: "Verificar e reparar arquivos do sistema (SFC/DISM)"
# descricao: "Executa DISM /CheckHealth e SFC em modo verificação ou, no modo reparar, DISM RestoreHealth seguido de sfc /scannow."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [sfc, dism, reparo]
# variaveis:
#   - nome: MODO
#     rotulo: "Modo"
#     tipo: selecao
#     padrao: "verificar"
#     obrigatorio: false
#     opcoes: [verificar, reparar]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$modo = if ("$env:FAROL_MODO" -eq 'reparar') { 'reparar' } else { 'verificar' }
Write-Output "Modo: $modo"
& dism.exe /Online /Cleanup-Image /CheckHealth
if ($modo -eq 'reparar') {
  & dism.exe /Online /Cleanup-Image /RestoreHealth
  & sfc.exe /scannow
} else {
  & sfc.exe /verifyonly
}
Write-Output "Concluído (código SFC: $LASTEXITCODE). Detalhes em C:\Windows\Logs\CBS\CBS.log"
exit 0
