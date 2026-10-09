# ---
# id: listar-certificados-computador
# nome: "Listar certificados do computador"
# descricao: "Lista certificados de um repositório local (My, Root, CA...) com validade, emissor e impressão digital."
# categoria: Certificados
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [certificados]
# variaveis:
#   - nome: REPOSITORIO
#     rotulo: "Repositório"
#     tipo: selecao
#     padrao: "My"
#     obrigatorio: false
#     opcoes: [My, Root, CA, TrustedPublisher, WebHosting]
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Dados($d) { if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json -Depth 4 } else { ($d | Format-Table -AutoSize | Out-String -Width 220).TrimEnd() } }

$r = if ("$env:FAROL_REPOSITORIO" -in 'My', 'Root', 'CA', 'TrustedPublisher', 'WebHosting') { $env:FAROL_REPOSITORIO } else { 'My' }
$d = Get-ChildItem "Cert:\LocalMachine\$r" -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ Assunto = $_.Subject; Emissor = $_.Issuer; Expira = $_.NotAfter.ToString('yyyy-MM-dd'); Dias = [int]($_.NotAfter - (Get-Date)).TotalDays; Thumbprint = $_.Thumbprint } } | Sort-Object Dias
Out-Dados $d
exit 0
