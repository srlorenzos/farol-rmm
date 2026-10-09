# ---
# id: compliance-guest-e-contas-padrao
# nome: "Compliance - contas padrão e Convidado"
# descricao: "Verifica estado das contas internas (Administrador, Convidado, DefaultAccount, WDAGUtilityAccount) e se estão com nomes originais."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [contas, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-LocalUser | Where-Object { $_.SID.Value -match '-(500|501|503|504)$' } | ForEach-Object {
  $rid = ($_.SID.Value -split '-')[-1]
  $esp = switch ($rid) { '500' { 'Administrador' } '501' { 'Convidado' } '503' { 'DefaultAccount' } '504' { 'WDAGUtilityAccount' } }
  Write-Output ("{0,-22} (RID {1}) ativa={2}{3}" -f $_.Name, $rid, $_.Enabled, $(if ($rid -eq '501' -and $_.Enabled) { '  [FALHOU: Convidado ativo]' } elseif ($rid -eq '500' -and $_.Enabled -and $_.Name -in 'Administrator', 'Administrador') { '  [ATENÇÃO: nome padrão]' } else { '' }))
}
exit 0
