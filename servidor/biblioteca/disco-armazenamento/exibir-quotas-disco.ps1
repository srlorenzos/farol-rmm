# ---
# id: exibir-quotas-disco
# nome: "Exibir cotas NTFS de um volume"
# descricao: "Consulta o estado das cotas de disco NTFS (fsutil quota) e, se habilitadas, lista os usuários acima de 80% da cota."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [quota, ntfs]
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

$u = if ("$env:FAROL_UNIDADE" -match '^[A-Za-z]:?$') { $env:FAROL_UNIDADE.Substring(0,1).ToUpper() } else { 'C' }
& fsutil.exe quota query "${u}:"
exit 0
