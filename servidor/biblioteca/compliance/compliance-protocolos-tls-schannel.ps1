# ---
# id: compliance-protocolos-tls-schannel
# nome: "Compliance - protocolos SSL/TLS habilitados (Schannel)"
# descricao: "Lê a configuração do Schannel e informa o estado de SSL 2.0/3.0 e TLS 1.0/1.1/1.2/1.3, apontando protocolos legados habilitados."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [tls, ssl, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$base = 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols'
foreach ($p in 'SSL 2.0', 'SSL 3.0', 'TLS 1.0', 'TLS 1.1', 'TLS 1.2', 'TLS 1.3') {
  $leg = $p -match 'SSL|1\.0|1\.1'
  foreach ($lado in 'Server', 'Client') {
    $k = "$base\$p\$lado"; $v = Get-ItemProperty $k -ErrorAction SilentlyContinue
    $estado = if ($null -eq $v -or $null -eq $v.Enabled) { 'padrão do SO' } elseif ($v.Enabled -eq 0 -or ($v.DisabledByDefault -eq 1 -and $v.Enabled -ne 1)) { 'desabilitado' } else { 'HABILITADO' }
    Write-Output ("{0,-8} {1,-7} {2}{3}" -f $p, $lado, $estado, $(if ($leg -and $estado -eq 'HABILITADO') { '  <-- legado' } else { '' }))
  }
}
exit 0
