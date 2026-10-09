# ---
# id: inventario-licencas-windows-office
# nome: "Inventário de licenças Windows e Office"
# descricao: "Mostra edição, canal de licença, últimos 5 caracteres da chave e status de ativação do Windows e do Office instalado."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [licencas, inventario]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-CimInstance SoftwareLicensingProduct | Where-Object { $_.PartialProductKey -and $_.Name -match 'Windows|Office' } | Select-Object Name, Description, @{n='Status';e={ switch ($_.LicenseStatus) { 0 {'Não licenciado'} 1 {'Licenciado'} 2 {'Carência inicial'} 3 {'Carência adicional'} 4 {'Não genuíno'} 5 {'Notificação'} default {'Outro'} } }}, PartialProductKey | Format-List | Out-String -Width 200 | Write-Output
exit 0
