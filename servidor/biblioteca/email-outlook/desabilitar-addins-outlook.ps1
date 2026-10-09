# ---
# id: desabilitar-addins-outlook
# nome: "Listar e desabilitar suplementos do Outlook"
# descricao: "Lista complementos COM do Outlook com seu comportamento de carga e desabilita um específico quando informado (resolve travamentos de inicialização)."
# categoria: E-mail e Outlook
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [outlook, suplementos]
# variaveis:
#   - nome: SUPLEMENTO
#     rotulo: "ProgID do suplemento a desabilitar (vazio = listar)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$bases = 'HKCU:\Software\Microsoft\Office\Outlook\Addins', 'HKLM:\Software\Microsoft\Office\Outlook\Addins', 'HKLM:\Software\WOW6432Node\Microsoft\Office\Outlook\Addins'
$s = "$env:FAROL_SUPLEMENTO".Trim()
foreach ($b in $bases) {
  Get-ChildItem $b -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath
    if (-not $s) { Write-Output ("{0,-50} LoadBehavior={1}  {2}" -f $_.PSChildName, $p.LoadBehavior, $p.FriendlyName) }
    elseif ($_.PSChildName -eq $s -and $b -like 'HKCU*') { Set-ItemProperty $_.PSPath LoadBehavior 0 -Type DWord; Write-Output "Desabilitado: $s" }
  }
}
exit 0
