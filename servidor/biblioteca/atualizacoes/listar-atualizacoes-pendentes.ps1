# ---
# id: listar-atualizacoes-pendentes
# nome: "Listar atualizações pendentes do Windows Update"
# descricao: "Consulta a API do Windows Update e lista atualizações aplicáveis ainda não instaladas, com tamanho e classificação."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 600
# requer_admin: true
# tags: [windows-update, pendentes]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$s = New-Object -ComObject Microsoft.Update.Session
$b = $s.CreateUpdateSearcher()
$r = $b.Search("IsInstalled=0 and IsHidden=0")
Write-Output "Atualizações pendentes: $($r.Updates.Count)"
foreach ($u in $r.Updates) { Write-Output ("- {0} [{1} MB] {2}" -f $u.Title, [math]::Round($u.MaxDownloadSize / 1MB, 1), ($u.Categories | ForEach-Object { $_.Name }) -join '/') }
exit 0
