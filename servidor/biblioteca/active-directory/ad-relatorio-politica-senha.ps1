# ---
# id: ad-relatorio-politica-senha
# nome: "AD - política de senha e de bloqueio do domínio"
# descricao: "Exibe a política de senha padrão do domínio e as políticas de senha refinadas (PSOs)."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [ad, senha, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado (instale o RSAT)."; exit 1 }
Import-Module ActiveDirectory
Get-ADDefaultDomainPasswordPolicy | Format-List ComplexityEnabled, MinPasswordLength, MaxPasswordAge, MinPasswordAge, PasswordHistoryCount, LockoutThreshold, LockoutDuration | Out-String | Write-Output
Write-Output "== PSOs =="
Get-ADFineGrainedPasswordPolicy -Filter * | Select-Object Name, Precedence, MinPasswordLength, AppliesTo | Format-Table -AutoSize | Out-String | Write-Output
exit 0
