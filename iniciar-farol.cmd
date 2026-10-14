@echo off
REM Inicia o servidor do Farol RMM e, se este PC ja estiver registrado, o agente.
REM Usa npm/node direto (funciona mesmo com a politica de execucao do PowerShell restrita).
setlocal
cd /d "%~dp0servidor"

if not exist node_modules (
  echo Instalando dependencias do servidor...
  call npm.cmd install --no-fund --no-audit || goto :erro
)

powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8420/ -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Farol - servidor" /min node src/servidor.js
  timeout /t 3 /nobreak >nul
)

if exist "%ProgramData%\Farol\config.json" (
  powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \"Name like 'python%%'\" | Where-Object { $_.CommandLine -like '*farol_agente.py*rodar*' }) { exit 0 } else { exit 1 }"
  if errorlevel 1 start "Farol - agente" /min python "%~dp0agente\farol_agente.py" rodar
)

start "" http://127.0.0.1:8420/
exit /b 0

:erro
echo Falha ao iniciar o Farol. Veja a mensagem acima.
pause
