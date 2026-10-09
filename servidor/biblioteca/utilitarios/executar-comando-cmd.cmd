REM ---
REM id: executar-comando-cmd
REM nome: "Prompt de comando - diagnóstico de rede legado"
REM descricao: "Executa um conjunto de comandos cmd (ipconfig, route, netstat) para coletar um retrato de rede em hosts onde só o cmd está disponível."
REM categoria: Utilitários
REM so: [windows]
REM shell: cmd
REM tipo: auditoria
REM tempo_limite: 120
REM requer_admin: false
REM tags: [cmd, rede]
REM variaveis: []
REM ---
@echo off
chcp 65001 >nul
echo === IPCONFIG ===
ipconfig /all
echo === ROTAS ===
route print -4
echo === CONEXOES ===
netstat -ano -p tcp | findstr ESTABLISHED
exit /b 0
