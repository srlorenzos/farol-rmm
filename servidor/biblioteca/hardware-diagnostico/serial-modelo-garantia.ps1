# ---
# id: serial-modelo-garantia
# nome: "Serial e dados para consulta de garantia"
# descricao: "Obtém fabricante, modelo, service tag/serial e gera o link de consulta de garantia do fabricante (Dell, HP, Lenovo etc.)."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [garantia, serial]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$cs = Get-CimInstance Win32_ComputerSystem; $b = Get-CimInstance Win32_BIOS
$sn = $b.SerialNumber.Trim()
Write-Output "Fabricante: $($cs.Manufacturer)`nModelo: $($cs.Model)`nSerial/Service Tag: $sn"
$m = $cs.Manufacturer
$url = switch -Regex ($m) {
  'Dell' { "https://www.dell.com/support/home/pt-br/product-support/servicetag/$sn/overview" }
  'HP|Hewlett' { "https://support.hp.com/br-pt/check-warranty?serialnumber=$sn" }
  'LENOVO' { "https://pcsupport.lenovo.com/br/pt/search?query=$sn" }
  'ASUS' { "https://www.asus.com/br/support/warranty-status-inquiry/?sn=$sn" }
  'Acer' { "https://www.acer.com/br-pt/support/warranty?sn=$sn" }
  'Microsoft' { "https://account.microsoft.com/devices" }
  default { "Fabricante não mapeado; consulte o site do suporte com o serial acima." }
}
Write-Output "Consulta de garantia: $url"
exit 0
