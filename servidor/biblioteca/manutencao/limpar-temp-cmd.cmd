REM ---
REM id: limpar-temp-cmd
REM nome: "Limpeza rápida de temporários (cmd)"
REM descricao: "Remove arquivos do %TEMP% do contexto atual e de C:\\Windows\\Temp. Apenas se CONFIRMAR=true; caso contrário informa o tamanho aproximado."
REM categoria: Manutenção
REM so: [windows]
REM shell: cmd
REM tipo: acao
REM tempo_limite: 300
REM requer_admin: true
REM tags: [cmd, limpeza]
REM variaveis:
REM   - nome: CONFIRMAR
REM     rotulo: "Digite true para confirmar a execução"
REM     tipo: booleano
REM     padrao: false
REM     obrigatorio: false
REM     opcoes: []
REM ---
@echo off
chcp 65001 >nul
if /i not "%FAROL_CONFIRMAR%"=="true" (
  echo Modo simulacao: defina CONFIRMAR=true para apagar.
  dir /s /a "%TEMP%" 2^>nul ^| find "File(s)"
  dir /s /a "C:\Windows\Temp" 2^>nul ^| find "File(s)"
  exit /b 0
)
del /f /s /q "%TEMP%\*" >nul 2>&1
del /f /s /q "C:\Windows\Temp\*" >nul 2>&1
echo Temporarios removidos.
exit /b 0
