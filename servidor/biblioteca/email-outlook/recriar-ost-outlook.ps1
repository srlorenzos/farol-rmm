# ---
# id: recriar-ost-outlook
# nome: "Recriar arquivo OST do Outlook"
# descricao: "Fecha o Outlook e renomeia os OST do usuário atual (backup) para forçar nova sincronização com o Exchange/Microsoft 365. Não afeta PST."
# categoria: E-mail e Outlook
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: false
# tags: [outlook, ost, reparo]
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

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true (a caixa será ressincronizada; pode levar horas)."; exit 0 }
Get-Process OUTLOOK -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
$n = 0
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Outlook" -Filter *.ost -ErrorAction SilentlyContinue | ForEach-Object {
  Rename-Item $_.FullName ($_.Name + ".farol-bak-" + (Get-Date -Format yyyyMMdd)) ; $n++
}
Write-Output "$n arquivo(s) OST renomeado(s). Abra o Outlook para recriar."
exit 0
