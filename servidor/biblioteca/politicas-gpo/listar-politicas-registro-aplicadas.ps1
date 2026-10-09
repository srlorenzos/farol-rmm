# ---
# id: listar-politicas-registro-aplicadas
# nome: "Listar políticas aplicadas via registro (Policies)"
# descricao: "Exporta todas as chaves de HKLM\\SOFTWARE\\Policies com valores, para identificar o que uma GPO está forçando."
# categoria: Políticas e GPO
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [gpo, politicas, registro]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Dump($k, $nivel) {
  $p = Get-ItemProperty $k -ErrorAction SilentlyContinue
  if ($p) { $p.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { Write-Output ("{0} : {1} = {2}" -f ($k -replace 'Microsoft.PowerShell.Core\\Registry::', ''), $_.Name, $_.Value) } }
  if ($nivel -lt 6) { Get-ChildItem $k -ErrorAction SilentlyContinue | ForEach-Object { Dump $_.PSPath ($nivel + 1) } }
}
Dump 'HKLM:\SOFTWARE\Policies' 0
exit 0
