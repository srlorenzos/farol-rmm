# ---
# id: compliance-smb-assinatura-criptografia
# nome: "Compliance - SMB (versões, assinatura, criptografia)"
# descricao: "Informa se SMBv1 está desligado e se assinatura e criptografia SMB estão exigidas, no cliente e no servidor."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [smb, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$s = Get-SmbServerConfiguration; $c = Get-SmbClientConfiguration
Write-Output ("Servidor: SMB1={0} SMB2={1} AssinaturaExigida={2} CriptografiaDados={3}" -f $s.EnableSMB1Protocol, $s.EnableSMB2Protocol, $s.RequireSecuritySignature, $s.EncryptData)
Write-Output ("Cliente: AssinaturaExigida={0} AssinaturaHabilitada={1}" -f $c.RequireSecuritySignature, $c.EnableSecuritySignature)
if ($s.EnableSMB1Protocol) { Write-Output "[FALHOU] SMBv1 habilitado" } else { Write-Output "[PASSOU] SMBv1 desabilitado" }
if (-not $s.RequireSecuritySignature) { Write-Output "[ATENÇÃO] Assinatura SMB não exigida no servidor" }
exit 0
