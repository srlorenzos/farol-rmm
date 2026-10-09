# ---
# id: desinstalar-extensao-forcada-edge
# nome: "Listar políticas de navegador aplicadas"
# descricao: "Lista as políticas do Chrome e do Edge presentes no registro (aplicadas por GPO ou localmente) para diagnóstico de comportamento inesperado."
# categoria: Navegadores
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [politicas, navegadores]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

foreach ($k in 'HKLM:\SOFTWARE\Policies\Microsoft\Edge', 'HKLM:\SOFTWARE\Policies\Google\Chrome', 'HKCU:\SOFTWARE\Policies\Microsoft\Edge', 'HKCU:\SOFTWARE\Policies\Google\Chrome') {
  if (Test-Path $k) {
    Write-Output "== $k =="
    Get-ItemProperty $k | ForEach-Object { $_.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { Write-Output ("  {0} = {1}" -f $_.Name, $_.Value) } }
    Get-ChildItem $k -ErrorAction SilentlyContinue | ForEach-Object { Write-Output "  [subchave] $($_.PSChildName)" }
  }
}
exit 0
