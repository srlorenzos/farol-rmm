# ---
# id: gerenciar-arquivo-hosts
# nome: "Adicionar ou remover entrada no arquivo hosts"
# descricao: "Adiciona ou remove uma entrada IP/nome no arquivo hosts, criando backup antes da alteração. Idempotente."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [hosts, dns]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "adicionar"
#     obrigatorio: true
#     opcoes: [adicionar, remover, listar]
#   - nome: IP
#     rotulo: "Endereço IP"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: NOME
#     rotulo: "Nome do host"
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
$f = "$env:windir\System32\drivers\etc\hosts"
$acao = "$env:FAROL_ACAO"
if ($acao -eq 'listar' -or -not $acao) { Get-Content $f | Where-Object { $_ -and $_ -notmatch '^\s*#' }; exit 0 }
$ip = "$env:FAROL_IP".Trim(); $nome = "$env:FAROL_NOME".Trim()
$o = $null
if ($nome -notmatch '^[A-Za-z0-9._-]+$') { Write-Output "Nome inválido."; exit 1 }
Copy-Item $f "$f.farol.bak" -Force
$linhas = Get-Content $f | Where-Object { $_ -notmatch "^\s*[0-9a-fA-F:.]+\s+$([regex]::Escape($nome))\s*(#.*)?$" }
if ($acao -eq 'adicionar') {
  if (-not [System.Net.IPAddress]::TryParse($ip, [ref]$o)) { Write-Output "IP inválido."; exit 1 }
  $linhas += "$ip`t$nome"
}
Set-Content -Path $f -Value $linhas -Encoding ASCII
Write-Output "Hosts atualizado ($acao $nome). Backup: $f.farol.bak"
exit 0
