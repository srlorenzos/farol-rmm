# ---
# id: auditar-permissoes-pasta
# nome: "Auditar permissões (ACL) de uma pasta"
# descricao: "Lista as permissões NTFS de uma pasta e seus filhos diretos, destacando permissões de Everyone/Usuários com controle total ou gravação."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [acl, permissoes]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Pasta"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$c = "$env:FAROL_CAMINHO".Trim()
if (-not (Test-Path -LiteralPath $c)) { Write-Output "Caminho não encontrado."; exit 1 }
$itens = @(Get-Item -LiteralPath $c) + @(Get-ChildItem -LiteralPath $c -Directory -ErrorAction SilentlyContinue)
foreach ($i in $itens) {
  foreach ($r in (Get-Acl -LiteralPath $i.FullName).Access) {
    $risco = ($r.IdentityReference -match 'Everyone|Todos|BUILTIN\\Users|Usuários|Authenticated Users') -and ($r.FileSystemRights -match 'FullControl|Write|Modify') -and $r.AccessControlType -eq 'Allow'
    Write-Output ("{0}{1}  {2}  {3}  {4}" -f $(if ($risco) { '[RISCO] ' } else { '' }), $i.FullName, $r.IdentityReference, $r.FileSystemRights, $r.AccessControlType)
  }
}
exit 0
