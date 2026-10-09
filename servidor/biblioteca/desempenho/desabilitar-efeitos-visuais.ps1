# ---
# id: desabilitar-efeitos-visuais
# nome: "Ajustar efeitos visuais para desempenho"
# descricao: "Define \"Ajustar para obter o melhor desempenho\" para o usuário atual (desativa animações e sombras), útil em máquinas fracas ou VDI."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [visual, vdi]
# variaveis:
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' VisualFXSetting 2 -Type DWord -ErrorAction SilentlyContinue
Set-ItemProperty 'HKCU:\Control Panel\Desktop' UserPreferencesMask ([byte[]](0x90, 0x12, 0x03, 0x80, 0x10, 0x00, 0x00, 0x00)) -Type Binary
Set-ItemProperty 'HKCU:\Control Panel\Desktop\WindowMetrics' MinAnimate '0' -ErrorAction SilentlyContinue
Write-Output "Aplicado. Faça logoff/logon para refletir."
exit 0
