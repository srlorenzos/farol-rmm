# ---
# id: agendar-chkdsk-reparo
# nome: "Agendar reparo de disco (chkdsk /f) no próximo boot"
# descricao: "Marca o volume como sujo para que o chkdsk /f /r rode na próxima reinicialização. Não reinicia o computador."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [chkdsk, reparo]
# variaveis:
#   - nome: UNIDADE
#     rotulo: "Letra da unidade"
#     tipo: texto
#     padrao: "C"
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$u = if ("$env:FAROL_UNIDADE" -match '^[A-Za-z]:?$') { $env:FAROL_UNIDADE.Substring(0,1).ToUpper() } else { 'C' }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para agendar o chkdsk em ${u}:."; exit 0 }
if ($u -eq $env:SystemDrive.Substring(0,1)) {
  cmd /c "echo Y| chkdsk ${u}: /f /r /x" | Out-Null
} else {
  cmd /c "echo Y| chkdsk ${u}: /f /r" | Out-Null
}
Write-Output "chkdsk agendado para ${u}: no próximo boot. Reinicie quando conveniente."
exit 0
