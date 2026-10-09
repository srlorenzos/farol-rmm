# ---
# id: listar-extensoes-navegadores
# nome: "Listar extensões dos navegadores"
# descricao: "Inventaria extensões instaladas no Chrome e Edge (ID, nome, versão e permissões amplas) para todos os perfis."
# categoria: Navegadores
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [extensoes, seguranca]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$bases = @{ Chrome = "$env:LOCALAPPDATA\Google\Chrome\User Data"; Edge = "$env:LOCALAPPDATA\Microsoft\Edge\User Data" }
$res = foreach ($b in $bases.Keys) {
  if (-not (Test-Path $bases[$b])) { continue }
  Get-ChildItem $bases[$b] -Directory | Where-Object { $_.Name -match '^(Default|Profile \d+)$' } | ForEach-Object {
    $perfil = $_.Name
    Get-ChildItem "$($_.FullName)\Extensions" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $id = $_.Name; $mf = Get-ChildItem $_.FullName -Recurse -Filter manifest.json -Depth 1 -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($mf) { $j = Get-Content $mf.FullName -Raw | ConvertFrom-Json
        $amplo = ($j.permissions + $j.host_permissions) -contains '<all_urls>' -or ($j.permissions -contains 'webRequest')
        [pscustomobject]@{ Navegador = $b; Perfil = $perfil; Id = $id; Nome = $j.name; Versao = $j.version; PermissaoAmpla = $amplo } }
    }
  }
}
if (-not $res) { Write-Output "Nenhuma extensão encontrada para o usuário atual."; exit 0 }
$res | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
exit 0
