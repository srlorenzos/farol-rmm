# ---
# id: verificar-sistema-arquivos
# nome: "Verificar sistema de arquivos (somente leitura)"
# descricao: "Executa chkdsk em modo somente leitura (Repair-Volume -Scan) em um volume e informa se há corrupção."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 3600
# requer_admin: true
# tags: [chkdsk, disco]
# variaveis:
#   - nome: UNIDADE
#     rotulo: "Letra da unidade"
#     tipo: texto
#     padrao: "C"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$u = if ("$env:FAROL_UNIDADE" -match '^[A-Za-z]:?$') { $env:FAROL_UNIDADE.Substring(0,1).ToUpper() } else { 'C' }
Write-Output "Verificando ${u}: (somente leitura)..."
$r = Repair-Volume -DriveLetter $u -Scan
Write-Output "Resultado: $r"
if ($r -ne 'NoErrorsFound') { Write-Output "Foram detectados problemas. Use o script de agendamento do chkdsk."; exit 0 }
exit 0
