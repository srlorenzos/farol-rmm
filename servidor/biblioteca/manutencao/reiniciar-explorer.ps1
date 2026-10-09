# ---
# id: reiniciar-explorer
# nome: "Reiniciar o Explorador de Arquivos"
# descricao: "Reinicia o processo explorer.exe do usuário atual para resolver barra de tarefas ou menu iniciar travados."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [explorer, travamento]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-Process explorer -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
Write-Output "Explorer reiniciado."
exit 0
