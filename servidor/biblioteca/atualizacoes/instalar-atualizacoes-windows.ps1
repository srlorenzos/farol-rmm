# ---
# id: instalar-atualizacoes-windows
# nome: "Instalar atualizações do Windows"
# descricao: "Baixa e instala atualizações pendentes (somente de segurança/críticas por padrão) usando a API do Windows Update; reporta se há reinício pendente. Não reinicia sozinho."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [windows-update, instalacao]
# variaveis:
#   - nome: ESCOPO
#     rotulo: "Escopo"
#     tipo: selecao
#     padrao: "seguranca"
#     obrigatorio: false
#     opcoes: [seguranca, todas]
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$s = New-Object -ComObject Microsoft.Update.Session
$r = $s.CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0 and Type='Software'")
$lista = New-Object -ComObject Microsoft.Update.UpdateColl
foreach ($u in $r.Updates) {
  $cats = ($u.Categories | ForEach-Object { $_.Name }) -join ','
  if ("$env:FAROL_ESCOPO" -eq 'todas' -or $cats -match 'Security|Critical|Segurança|Crítica') { if ($u.InstallationBehavior.CanRequestUserInput -ne $true) { [void]$lista.Add($u) } }
}
Write-Output "$($lista.Count) atualização(ões) selecionada(s)."
foreach ($u in $lista) { Write-Output "- $($u.Title)" }
if ($lista.Count -eq 0) { exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para instalar."; exit 0 }
$d = $s.CreateUpdateDownloader(); $d.Updates = $lista; [void]$d.Download()
$i = $s.CreateUpdateInstaller(); $i.Updates = $lista
$res = $i.Install()
Write-Output ("Resultado: código {0}; reinício necessário: {1}" -f $res.ResultCode, $res.RebootRequired)
exit 0
