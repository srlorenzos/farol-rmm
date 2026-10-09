# ---
# id: defender-listar-exclusoes
# nome: "Auditar exclusões do Defender"
# descricao: "Lista exclusões de caminho, extensão e processo configuradas no Defender (alvo comum de malware para se esconder)."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [defender, exclusoes, auditoria]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$p = Get-MpPreference
Write-Output "== Caminhos =="; $p.ExclusionPath | ForEach-Object { " $_" }
Write-Output "== Extensões =="; $p.ExclusionExtension | ForEach-Object { " $_" }
Write-Output "== Processos =="; $p.ExclusionProcess | ForEach-Object { " $_" }
$n = @($p.ExclusionPath).Count + @($p.ExclusionExtension).Count + @($p.ExclusionProcess).Count
Write-Output "Total de exclusões: $n"
if ($p.ExclusionPath -match '^[A-Za-z]:\\?$|\\Users\\?$|\\Windows\\?$|Temp') { Write-Output "ATENÇÃO: há exclusões muito amplas ou em pastas temporárias." }
exit 0
