# ---
# id: consultar-versao-software
# nome: "Consultar versão de um software"
# descricao: "Retorna nome e versão dos programas instalados que correspondem ao nome informado, útil para checar patches (ex.: Chrome, Java, 7-Zip)."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [software, versao]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome (ou parte)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$n = "$env:FAROL_NOME".Trim()
if (-not $n) { Write-Output "Informe o nome."; exit 1 }
$ks = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
$r = Get-ItemProperty $ks -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*$n*" } | Select-Object DisplayName, DisplayVersion, Publisher
if (-not $r) { Write-Output "Não instalado: $n"; exit 0 }
$r | Format-Table -AutoSize | Out-String | Write-Output
exit 0
