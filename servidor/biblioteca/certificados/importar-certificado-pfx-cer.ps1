# ---
# id: importar-certificado-pfx-cer
# nome: "Importar certificado (.cer/.pfx) no repositório"
# descricao: "Importa um certificado de um arquivo local para o repositório da máquina (ex.: AC raiz interna em Root, ou PFX em My)."
# categoria: Certificados
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [certificados, importacao]
# variaveis:
#   - nome: ARQUIVO
#     rotulo: "Caminho do arquivo"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: REPOSITORIO
#     rotulo: "Repositório"
#     tipo: selecao
#     padrao: "Root"
#     obrigatorio: true
#     opcoes: [Root, CA, My, TrustedPublisher]
#   - nome: SENHA_PFX
#     rotulo: "Senha do PFX (se aplicável)"
#     tipo: senha
#     padrao: ""
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
$a = "$env:FAROL_ARQUIVO".Trim(); $r = "$env:FAROL_REPOSITORIO"
if (-not (Test-Path -LiteralPath $a -PathType Leaf)) { Write-Output "Arquivo não encontrado."; exit 1 }
if ($r -notin 'Root', 'CA', 'My', 'TrustedPublisher') { Write-Output "Repositório inválido."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Importaria $a em LocalMachine\$r (confiar em AC raiz é uma decisão de segurança). CONFIRMAR=true para aplicar."; exit 0 }
if ($a -match '\.pfx$|\.p12$') { Import-PfxCertificate -FilePath $a -CertStoreLocation "Cert:\LocalMachine\$r" -Password (ConvertTo-SecureString "$env:FAROL_SENHA_PFX" -AsPlainText -Force) | Out-Null } else { Import-Certificate -FilePath $a -CertStoreLocation "Cert:\LocalMachine\$r" | Out-Null }
Write-Output "Importado."
exit 0
