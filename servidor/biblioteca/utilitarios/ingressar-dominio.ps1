# ---
# id: ingressar-dominio
# nome: "Ingressar o computador em um domínio"
# descricao: "Ingressa o computador no domínio do Active Directory com credencial informada, OU opcional e nome opcional. Não reinicia automaticamente."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [dominio, ad]
# variaveis:
#   - nome: DOMINIO
#     rotulo: "Nome do domínio (FQDN)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: USUARIO
#     rotulo: "Usuário com permissão (DOMINIO\\usuario)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: SENHA
#     rotulo: "Senha"
#     tipo: senha
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: OU
#     rotulo: "DN da OU de destino (opcional)"
#     tipo: texto
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
$d = "$env:FAROL_DOMINIO".Trim()
if ($d -notmatch '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' -or -not $env:FAROL_USUARIO -or -not $env:FAROL_SENHA) { Write-Output "Parâmetros inválidos."; exit 1 }
if ((Get-CimInstance Win32_ComputerSystem).Domain -ieq $d) { Write-Output "Já ingressado em $d."; exit 0 }
if (-not (Resolve-DnsName $d -ErrorAction SilentlyContinue)) { Write-Output "Domínio não resolve via DNS. Verifique o DNS do computador."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para ingressar em $d."; exit 0 }
$cred = New-Object PSCredential($env:FAROL_USUARIO, (ConvertTo-SecureString $env:FAROL_SENHA -AsPlainText -Force))
$a = @{ DomainName = $d; Credential = $cred; Force = $true }
if ($env:FAROL_OU) { $a.OUPath = $env:FAROL_OU }
Add-Computer @a
Write-Output "Ingresso concluído. Reinicie o computador."
exit 0
