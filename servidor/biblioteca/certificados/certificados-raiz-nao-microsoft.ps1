# ---
# id: certificados-raiz-nao-microsoft
# nome: "Autoridades raiz fora do programa padrão"
# descricao: "Lista certificados raiz confiáveis cuja emissão não é de AC conhecida do programa Microsoft (suspeitos de interceptação TLS ou AC corporativa)."
# categoria: Certificados
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [certificados, seguranca]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$lista = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Issuer -eq $_.Subject -and $_.NotBefore -gt (Get-Date).AddYears(-3) }
$lista | Sort-Object NotBefore -Descending | Select-Object -First 30 | ForEach-Object { Write-Output ("{0:yyyy-MM-dd}  {1}  {2}" -f $_.NotBefore, $_.Thumbprint, $_.Subject) }
Write-Output "Revise raízes recentes desconhecidas; AC corporativa e proxies de inspeção TLS aparecem aqui."
exit 0
