# ---
# id: gerenciar-armazenamento-sombra
# nome: "Consultar e limitar armazenamento de cópias de sombra"
# descricao: "Mostra o uso do armazenamento de cópias de sombra (VSS) e, opcionalmente, redefine o limite máximo de um volume."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [vss, sombra, espaco]
# variaveis:
#   - nome: UNIDADE
#     rotulo: "Letra da unidade"
#     tipo: texto
#     padrao: "C"
#     obrigatorio: false
#     opcoes: []
#   - nome: LIMITE_PCT
#     rotulo: "Novo limite máximo em % (vazio = só consultar)"
#     tipo: numero
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$u = if ("$env:FAROL_UNIDADE" -match '^[A-Za-z]:?$') { $env:FAROL_UNIDADE.Substring(0,1).ToUpper() } else { 'C' }
& vssadmin.exe list shadowstorage /for="${u}:"
if ("$env:FAROL_LIMITE_PCT" -match '^\d+$' -and [int]$env:FAROL_LIMITE_PCT -ge 1 -and [int]$env:FAROL_LIMITE_PCT -le 100) {
  & vssadmin.exe resize shadowstorage /for="${u}:" /on="${u}:" /maxsize="$($env:FAROL_LIMITE_PCT)%"
}
exit 0
