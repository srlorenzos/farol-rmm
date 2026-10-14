# ---
# id: configurar-cache-exchange-outlook
# nome: "Configurar modo cache e período de sincronização do Outlook"
# descricao: "Define a janela de e-mail sincronizado (CachedExchangeMode) para reduzir o tamanho do OST. Aplica ao usuário atual."
# categoria: E-mail e Outlook
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [outlook, cache, ost]
# variaveis:
#   - nome: MESES
#     rotulo: "Sincronizar últimos N meses (0 = tudo)"
#     tipo: numero
#     padrao: 12
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar (Outlook fechado)."; exit 0 }
$m = Get-Num $env:FAROL_MESES 12
$k = 'HKCU:\Software\Policies\Microsoft\Office\16.0\Outlook\Cached Mode'
New-Item $k -Force | Out-Null
Set-ItemProperty $k SyncWindowSetting $m -Type DWord
Set-ItemProperty $k SyncWindowSettingDays 0 -Type DWord
Write-Output "Janela de sincronização definida para $m mês(es). Reinicie o Outlook."
exit 0
