# ---
# id: gerar-senha-aleatoria
# nome: "Gerar senhas aleatórias fortes"
# descricao: "Gera senhas aleatórias criptograficamente seguras com comprimento e quantidade configuráveis. Nada é gravado em disco."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [senha, gerador]
# variaveis:
#   - nome: COMPRIMENTO
#     rotulo: "Comprimento"
#     tipo: numero
#     padrao: 16
#     obrigatorio: false
#     opcoes: []
#   - nome: QUANTIDADE
#     rotulo: "Quantidade"
#     tipo: numero
#     padrao: 3
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$n = [math]::Max(8, [math]::Min((Get-Num $env:FAROL_COMPRIMENTO 16), 64)); $q = [math]::Min((Get-Num $env:FAROL_QUANTIDADE 3), 20)
$chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?-_'.ToCharArray()
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
1..$q | ForEach-Object { $b = New-Object byte[] $n; $rng.GetBytes($b); -join ($b | ForEach-Object { $chars[$_ % $chars.Length] }) }
exit 0
