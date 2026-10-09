// Scripts de exemplo semeados na primeira inicialização (biblioteca do usuário).


export const SCRIPTS_EXEMPLO = [
  {
    nome: 'Limpar arquivos temporários',
    descricao: 'Remove arquivos com mais de 7 dias da pasta TEMP do sistema e do usuário.',
    shell: 'powershell',
    timeout: 300,
    conteudo: `$limite = (Get-Date).AddDays(-7)
$pastas = @($env:TEMP, "$env:SystemRoot\\Temp")
$total = 0
foreach ($p in $pastas) {
  if (-not (Test-Path $p)) { continue }
  Get-ChildItem -Path $p -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { -not $_.PSIsContainer -and $_.LastWriteTime -lt $limite } |
    ForEach-Object {
      try { $total += $_.Length; Remove-Item $_.FullName -Force -ErrorAction Stop } catch {}
    }
}
"Liberados: {0:N1} MB" -f ($total / 1MB)`,
  },
  {
    nome: 'Serviços automáticos parados',
    descricao: 'Lista serviços com inicialização automática que não estão em execução.',
    shell: 'powershell',
    timeout: 60,
    conteudo: `Get-CimInstance Win32_Service |
  Where-Object { $_.StartMode -eq 'Auto' -and $_.State -ne 'Running' } |
  Select-Object Name, DisplayName, State |
  Format-Table -AutoSize | Out-String -Width 200`,
  },
  {
    nome: 'Espaço em disco (Linux)',
    descricao: 'Uso de disco por partição, sem sistemas de arquivos temporários.',
    shell: 'bash',
    timeout: 30,
    conteudo: 'df -h -x tmpfs -x devtmpfs -x squashfs',
  },
  {
    nome: 'Espaço em disco (Windows)',
    descricao: 'Uso de disco por unidade local.',
    shell: 'powershell',
    timeout: 30,
    conteudo: `Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
  Select-Object DeviceID,
    @{n='Tamanho (GB)';e={[math]::Round($_.Size/1GB,1)}},
    @{n='Livre (GB)';e={[math]::Round($_.FreeSpace/1GB,1)}},
    @{n='Uso %';e={[math]::Round(100 - $_.FreeSpace/$_.Size*100,1)}} |
  Format-Table -AutoSize | Out-String`,
  },
  {
    nome: 'Reiniciar spooler de impressão',
    descricao: 'Para o spooler, limpa a fila travada e inicia novamente.',
    shell: 'powershell',
    timeout: 120,
    conteudo: `Stop-Service -Name Spooler -Force
Remove-Item "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force -ErrorAction SilentlyContinue
Start-Service -Name Spooler
Get-Service -Name Spooler | Select-Object Name, Status | Format-List | Out-String`,
  },
  {
    nome: 'Informações de rede',
    descricao: 'Configuração IP completa da máquina.',
    shell: 'cmd',
    timeout: 30,
    conteudo: 'ipconfig /all',
  },
  {
    nome: 'Informações de rede (Linux)',
    descricao: 'Endereços, rotas e DNS.',
    shell: 'bash',
    timeout: 30,
    conteudo: `ip -brief address
echo
ip route
echo
cat /etc/resolv.conf 2>/dev/null | grep -v '^#'`,
  },
  {
    nome: 'Processos que mais usam CPU',
    descricao: 'Os 10 processos com maior uso de CPU (multiplataforma, Python).',
    shell: 'python',
    timeout: 30,
    conteudo: `import psutil, time
procs = list(psutil.process_iter(['pid', 'name']))
for p in procs:
    try: p.cpu_percent(None)
    except Exception: pass
time.sleep(1)
dados = []
for p in procs:
    try: dados.append((p.cpu_percent(None), p.info['pid'], p.info['name']))
    except Exception: pass
for cpu, pid, nome in sorted(dados, reverse=True)[:10]:
    print(f"{cpu:6.1f}%  {pid:>7}  {nome}")`,
  },
];
