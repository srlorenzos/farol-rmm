# ---
# id: criar-copia-sombra
# nome: "Criar cópia de sombra de um volume"
# descricao: "Cria uma cópia de sombra (ponto de recuperação de arquivos) do volume informado, em servidores ou estações com VSS."
# categoria: Backup e recuperação
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [vss, snapshot]
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
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para criar a cópia de sombra de ${u}:."; exit 0 }
$r = (Get-CimInstance -ClassName Win32_ShadowCopy -List | Select-Object -First 1) | Invoke-CimMethod -MethodName Create -Arguments @{ Volume = "${u}:\"; Context = 'ClientAccessible' }
if ($r.ReturnValue -eq 0) { Write-Output "Cópia criada: $($r.ShadowID)" } else { Write-Output "Falha (código $($r.ReturnValue))."; exit 1 }
exit 0
