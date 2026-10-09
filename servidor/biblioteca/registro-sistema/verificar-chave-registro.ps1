# ---
# id: verificar-chave-registro
# nome: "Consultar chave ou valor do registro"
# descricao: "Lê uma chave de registro (somente leitura) e lista valores e subchaves; útil para diagnóstico remoto."
# categoria: Registro e logs do sistema
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [registro, consulta]
# variaveis:
#   - nome: CHAVE
#     rotulo: "Chave (ex.: HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: VALOR
#     rotulo: "Valor específico (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$k = "$env:FAROL_CHAVE".Trim()
if ($k -notmatch '^(HKLM|HKCU|HKCR|HKU):\\[^"<>|]*$') { Write-Output "Chave inválida (use HKLM:\...)."; exit 1 }
if (-not (Test-Path $k)) { Write-Output "Chave inexistente."; exit 1 }
$v = "$env:FAROL_VALOR".Trim()
if ($v) { (Get-ItemProperty $k -Name $v -ErrorAction SilentlyContinue).$v; exit 0 }
(Get-ItemProperty $k).PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { Write-Output ("{0} = {1}" -f $_.Name, $_.Value) }
Get-ChildItem $k -ErrorAction SilentlyContinue | ForEach-Object { Write-Output "[subchave] $($_.PSChildName)" }
exit 0
