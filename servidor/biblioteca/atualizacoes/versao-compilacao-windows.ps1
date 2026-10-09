# ---
# id: versao-compilacao-windows
# nome: "Versão e compilação do Windows"
# descricao: "Informa edição, versão (ex.: 23H2), build, data de instalação e suporte restante da versão."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [windows, versao]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$v = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$os = Get-CimInstance Win32_OperatingSystem
Write-Output ("Produto: {0}`nVersão: {1}`nBuild: {2}.{3}`nInstalado em: {4}`nÚltima inicialização: {5}`nArquitetura: {6}" -f $os.Caption, $v.DisplayVersion, $v.CurrentBuild, $v.UBR, $os.InstallDate, $os.LastBootUpTime, $os.OSArchitecture)
exit 0
