# ---
# id: listar-planos-energia
# nome: "Planos de energia e plano ativo"
# descricao: "Lista os planos de energia disponíveis, o ativo e as configurações de suspensão, hibernação e tela."
# categoria: Energia
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [energia]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

powercfg /list
Write-Output ""
powercfg /query SCHEME_CURRENT SUB_SLEEP 2>&1 | Select-String 'Nome|Name|Índice de configuração|Setting Index' | ForEach-Object { $_.Line.Trim() }
exit 0
