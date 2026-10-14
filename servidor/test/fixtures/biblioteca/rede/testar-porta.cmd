@echo off
REM ---
REM id: testar-porta
REM nome: Testar porta TCP
REM descricao: Testa se uma porta TCP responde.
REM categoria: Rede
REM so: [windows]
REM shell: cmd
REM tempo_limite: 60
REM variaveis:
REM   - nome: HOST
REM     rotulo: Host
REM     tipo: texto
REM     obrigatorio: true
REM ---
powershell -NoProfile -Command "Test-NetConnection -ComputerName $env:FAROL_HOST -Port 443"
