# ---
# id: hash-de-arquivo
# nome: "Calcular hash de arquivo"
# descricao: "Calcula SHA256, SHA1 e MD5 de um arquivo e mostra a assinatura digital, útil para verificar integridade ou consultar no VirusTotal."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [hash, forense]
# variaveis:
#   - nome: ARQUIVO
#     rotulo: "Caminho completo do arquivo"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$a = "$env:FAROL_ARQUIVO".Trim()
if (-not (Test-Path -LiteralPath $a -PathType Leaf)) { Write-Output "Arquivo não encontrado: $a"; exit 1 }
foreach ($alg in 'SHA256', 'SHA1', 'MD5') { Write-Output ("{0,-7} {1}" -f $alg, (Get-FileHash -LiteralPath $a -Algorithm $alg).Hash) }
$s = Get-AuthenticodeSignature -LiteralPath $a
Write-Output ("Assinatura: {0} {1}" -f $s.Status, $s.SignerCertificate.Subject)
exit 0
