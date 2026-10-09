# ---
# id: listar-software-instalado
# nome: "Listar software instalado"
# descricao: "Inventário de programas instalados (32/64 bits, todos os usuários) com versão, fabricante e data de instalação, lido do registro."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [software, inventario]
# variaveis:
#   - nome: FILTRO
#     rotulo: "Filtrar por nome (contém)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
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

$ks = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
$f = "$env:FAROL_FILTRO".Trim()
$d = Get-ItemProperty $ks -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and -not $_.SystemComponent -and (-not $f -or $_.DisplayName -like "*$f*") } |
  Select-Object @{n='Nome';e={$_.DisplayName}}, @{n='Versao';e={$_.DisplayVersion}}, @{n='Fabricante';e={$_.Publisher}}, @{n='Instalado';e={$_.InstallDate}} | Sort-Object Nome -Unique
Out-Dados $d
exit 0
