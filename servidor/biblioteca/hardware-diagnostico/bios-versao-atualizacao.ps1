# ---
# id: bios-versao-atualizacao
# nome: "Versão do BIOS/UEFI e modo de inicialização"
# descricao: "Mostra fabricante, versão e data do BIOS, modo (UEFI/Legado) e idade do firmware em anos."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [bios, firmware]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$b = Get-CimInstance Win32_BIOS
$idade = [math]::Round(((Get-Date) - $b.ReleaseDate).TotalDays / 365, 1)
Write-Output ("Fabricante: {0}`nVersão: {1}`nData: {2:yyyy-MM-dd} ({3} anos)`nSMBIOS: {4}.{5}" -f $b.Manufacturer, $b.SMBIOSBIOSVersion, $b.ReleaseDate, $idade, $b.SMBIOSMajorVersion, $b.SMBIOSMinorVersion)
$modo = if (Test-Path "$env:windir\Panther\setupact.log") { (Select-String -Path "$env:windir\Panther\setupact.log" -Pattern 'Detected boot environment' -ErrorAction SilentlyContinue | Select-Object -First 1).Line } else { '' }
if ($modo) { Write-Output $modo }
exit 0
