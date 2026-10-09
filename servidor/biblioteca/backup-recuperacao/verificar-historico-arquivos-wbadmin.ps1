# ---
# id: verificar-historico-arquivos-wbadmin
# nome: "Verificar backups do Windows Server Backup / wbadmin"
# descricao: "Lista versões de backup do wbadmin e a data do último backup bem-sucedido."
# categoria: Backup e recuperação
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [wbadmin, backup]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Command wbadmin.exe -ErrorAction SilentlyContinue)) { Write-Output "wbadmin indisponível."; exit 1 }
wbadmin get versions 2>&1 | Out-String | Write-Output
exit 0
