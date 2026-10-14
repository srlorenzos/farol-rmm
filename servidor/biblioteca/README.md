# Biblioteca de scripts do Farol RMM (amostra — versão showcase)

Catálogo de scripts prontos para técnicos de TI e MSPs, no estilo "ComStore", todos em pt-BR. **Esta é a
versão pública/showcase do Farol**: traz uma amostra de **53 scripts**, 1-3 por categoria, cobrindo as 31
categorias da biblioteca real — o suficiente para mostrar o formato, a qualidade e a variedade sem entregar
o catálogo inteiro. A versão completa (**551 scripts**: 393 Windows, 141 Linux, 21 macOS) é exclusiva do
[Farol Pro](https://farol-rmm.vercel.app).

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

## Categorias nesta amostra

| Pasta | Categoria | Scripts aqui |
|---|---|---|
| monitoramento | Monitoramento | 3 |
| active-directory | Active Directory | 2 |
| antivirus-defender | Antivírus e Defender | 2 |
| atualizacoes | Atualizações | 2 |
| backup-recuperacao | Backup e recuperação | 2 |
| compliance | Compliance | 2 |
| desempenho | Desempenho | 2 |
| disco-armazenamento | Disco e armazenamento | 2 |
| hardware-diagnostico | Hardware e diagnóstico | 2 |
| inventario-auditoria | Inventário e auditoria | 2 |
| linux-servidores | Servidores Linux | 2 |
| macos | macOS | 2 |
| manutencao | Manutenção | 2 |
| microsoft-365 | Microsoft 365 | 2 |
| rede | Rede | 2 |
| registro-sistema | Registro e logs do sistema | 2 |
| seguranca | Segurança | 2 |
| servicos-processos | Serviços e processos | 2 |
| software | Software | 2 |
| usuarios-contas | Usuários e contas | 2 |
| utilitarios | Utilitários | 2 |
| bitlocker-criptografia | BitLocker e criptografia | 1 |
| certificados | Certificados | 1 |
| email-outlook | E-mail e Outlook | 1 |
| energia | Energia | 1 |
| firewall | Firewall | 1 |
| impressoras | Impressoras | 1 |
| navegadores | Navegadores | 1 |
| onboarding-offboarding | Onboarding e offboarding | 1 |
| politicas-gpo | Políticas e GPO | 1 |
| remoto-acesso | Acesso remoto | 1 |
| **Total** | | **53** |

Na versão completa (Farol Pro) cada uma destas categorias tem entre 7 e 88 scripts — **551 no total**.
