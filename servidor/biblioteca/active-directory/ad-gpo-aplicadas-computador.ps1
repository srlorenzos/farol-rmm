# ---
# id: ad-gpo-aplicadas-computador
# nome: "AD - GPOs aplicadas (resultado de política)"
# descricao: "Exibe as GPOs aplicadas ao computador e ao usuário atual (gpresult) em modo resumido."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: false
# tags: [ad, gpo, gpresult]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

gpresult /r /scope computer
Write-Output ""
gpresult /r /scope user 2>&1
exit 0
