# ---
# id: mapear-unidade-rede
# nome: "Mapear unidade de rede"
# descricao: "Mapeia um compartilhamento SMB para uma letra de unidade (persistente) para o usuário que executa o script."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [smb, mapeamento]
# variaveis:
#   - nome: LETRA
#     rotulo: "Letra da unidade"
#     tipo: texto
#     padrao: "Z"
#     obrigatorio: true
#     opcoes: []
#   - nome: CAMINHO
#     rotulo: "Caminho UNC (\\\\servidor\\compartilhamento)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: USUARIO
#     rotulo: "Usuário (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: SENHA
#     rotulo: "Senha (opcional)"
#     tipo: senha
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$l = "$env:FAROL_LETRA".Trim().TrimEnd(':').ToUpper()
$c = "$env:FAROL_CAMINHO".Trim()
if ($l -notmatch '^[A-Z]$') { Write-Output "Letra inválida."; exit 1 }
if ($c -notmatch '^\\\\[^\\]+\\.+') { Write-Output "Caminho UNC inválido: $c"; exit 1 }
if (Get-PSDrive -Name $l -ErrorAction SilentlyContinue) { net use "${l}:" /delete /y | Out-Null }
if ($env:FAROL_USUARIO) { net use "${l}:" $c /user:$env:FAROL_USUARIO $env:FAROL_SENHA /persistent:yes } else { net use "${l}:" $c /persistent:yes }
exit $LASTEXITCODE
