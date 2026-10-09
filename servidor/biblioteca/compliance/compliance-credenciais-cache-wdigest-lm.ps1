# ---
# id: compliance-credenciais-cache-wdigest-lm
# nome: "Compliance - hashes LM e credenciais em cache"
# descricao: "Verifica NoLMHash, nível de autenticação LAN Manager (NTLM), WDigest e quantidade de logons em cache."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [ntlm, credenciais, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$l = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa'
Write-Output ("NoLMHash: {0} (esperado 1)" -f $l.NoLMHash)
Write-Output ("LmCompatibilityLevel: {0} (recomendado 5)" -f $l.LmCompatibilityLevel)
Write-Output ("RunAsPPL: {0}" -f $l.RunAsPPL)
Write-Output ("WDigest UseLogonCredential: {0} (esperado 0 ou ausente)" -f (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest' -ErrorAction SilentlyContinue).UseLogonCredential)
Write-Output ("CachedLogonsCount: {0}" -f (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon').CachedLogonsCount)
exit 0
