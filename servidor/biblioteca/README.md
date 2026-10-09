# Biblioteca de scripts do Farol RMM

Catálogo de scripts prontos para técnicos de TI e MSPs, no estilo "ComStore". São **551 scripts** (393 Windows, 141 Linux, 21 macOS; alguns em Python valem para os três), todos em pt-BR.

## Estrutura

```
biblioteca/<categoria-slug>/<id>.<ps1|cmd|sh|py>
```

O `id` é único em toda a biblioteca (kebab-case) e igual ao nome do arquivo. A pasta é o slug da categoria e todos os arquivos dela usam o mesmo nome de categoria no cabeçalho.

## Formato do cabeçalho

Comentários (`#` em ps1/sh/py, `REM` em cmd) delimitados por linhas `---`, com YAML simples. Em `.sh` o shebang vem antes do cabeçalho.

```
# ---
# id: limpar-temp-windows
# nome: "Limpar arquivos temporários"
# descricao: "Remove arquivos temporários antigos..."
# categoria: Manutenção
# so: [windows]                 # windows | linux | macos (lista)
# shell: powershell             # powershell | cmd | bash | python
# tipo: acao                    # acao | monitor | auditoria
# tempo_limite: 600             # segundos
# requer_admin: true
# tags: [limpeza, disco, temp]
# variaveis:
#   - nome: DIAS
#     rotulo: "Apagar arquivos mais antigos que (dias)"
#     tipo: numero              # texto | numero | booleano | selecao | senha
#     padrao: 7
#     obrigatorio: false
#     opcoes: []                # obrigatório (2+) quando tipo = selecao
# ---
```

### Variáveis

Chegam como variáveis de ambiente `FAROL_<NOME>` (`$env:FAROL_DIAS`, `"$FAROL_DIAS"`), sempre como texto. Cada script valida e converte, com padrão quando vazio, e nunca monta comandos com valores não validados.

Convenções de segurança usadas em toda a biblioteca:

- `SIMULAR` (padrão `true`): ações em lote só listam o que fariam; `SIMULAR=false` aplica.
- `CONFIRMAR` (padrão `false`): ações que alteram configuração, removem ou reiniciam exigem `CONFIRMAR=true`; sem isso mostram o estado atual e o que seria feito.
- `SAIDA` (`texto` ou `json`): auditorias que suportam saída estruturada.
- Códigos de saída: 0 em sucesso (inclusive "nada a fazer" e alertas de monitor), diferente de 0 em falha de execução, parâmetro inválido ou falta de privilégio.

### Monitores

Scripts com `tipo: monitor` terminam imprimindo uma linha:

```
FAROL_STATUS: ok|alerta|critico <mensagem>
```

e saem com código 0 mesmo em alerta ou crítico. Os limiares são variáveis (`ALERTA`, `CRITICO`).

## Observações técnicas

- Scripts `.ps1` são compatíveis com Windows PowerShell 5.1 e gravados em UTF-8 com BOM (necessário para acentos no 5.1). O servidor deve preservar o BOM ao enviar o arquivo, ou usar `-EncodedCommand`/UTF-8 explícito.
- Funções auxiliares pequenas (`Test-Sim`, `Get-Num`, `Exigir-Admin`, `Out-Status`, `Out-Dados`, `f_sim`, `f_num`, `f_root`, `f_pm`...) são embutidas no próprio arquivo: cada script é autossuficiente.
- Scripts Linux detectam o gerenciador de pacotes (apt, dnf, yum, zypper, pacman). Scripts macOS são compatíveis com bash 3.2.
- Contadores de desempenho usam CIM (`Win32_PerfFormatted*`) para funcionar em Windows localizado.

## Validação

```
node servidor/scripts/validar-biblioteca.mjs            # cabeçalhos, ids, enums, variáveis, monitores
node servidor/scripts/validar-biblioteca.mjs --sintaxe  # + parser do PowerShell, bash -n, ast do Python
node servidor/scripts/validar-biblioteca.mjs --json
```

O validador também confere que toda `FAROL_*` usada no corpo está declarada em `variaveis`. Sai com código diferente de 0 se houver erro.

## Categorias e contagem

| Pasta | Categoria | Scripts |
|---|---|---|
| monitoramento | Monitoramento | 88 |
| rede | Rede | 35 |
| linux-servidores | Servidores Linux | 32 |
| seguranca | Segurança | 27 |
| disco-armazenamento | Disco e armazenamento | 22 |
| manutencao | Manutenção | 22 |
| software | Software | 22 |
| usuarios-contas | Usuários e contas | 22 |
| hardware-diagnostico | Hardware e diagnóstico | 20 |
| atualizacoes | Atualizações | 18 |
| compliance | Compliance | 17 |
| utilitarios | Utilitários | 17 |
| macos | macOS | 16 |
| active-directory | Active Directory | 15 |
| desempenho | Desempenho | 14 |
| inventario-auditoria | Inventário e auditoria | 14 |
| servicos-processos | Serviços e processos | 14 |
| antivirus-defender | Antivírus e Defender | 13 |
| registro-sistema | Registro e logs do sistema | 13 |
| backup-recuperacao | Backup e recuperação | 12 |
| microsoft-365 | Microsoft 365 | 12 |
| bitlocker-criptografia | BitLocker e criptografia | 10 |
| impressoras | Impressoras | 10 |
| remoto-acesso | Acesso remoto | 10 |
| onboarding-offboarding | Onboarding e offboarding | 9 |
| certificados | Certificados | 8 |
| email-outlook | E-mail e Outlook | 8 |
| firewall | Firewall | 8 |
| navegadores | Navegadores | 8 |
| politicas-gpo | Políticas e GPO | 8 |
| energia | Energia | 7 |
| **Total** | | **551** |

Por tipo: 235 auditorias, 228 ações, 88 monitores. Por shell: 389 PowerShell, 158 bash, 2 cmd, 2 Python.

Regras de firewall do Linux (UFW, firewalld) e fail2ban estão em `linux-servidores`.
