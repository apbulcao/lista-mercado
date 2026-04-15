@echo off
chcp 65001 > nul
echo ╔══════════════════════════════════════╗
echo ║     Lista de Mercado - Hortisabor    ║
echo ╚══════════════════════════════════════╝
echo.

REM Lê tokens do arquivo tokens.env
set "GH_TOKEN="
set "GH_REPO="
set "GROQ_KEY="
for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0tokens.env") do (
    if "%%a"=="GH_TOKEN" set "GH_TOKEN=%%b"
    if "%%a"=="GH_REPO" set "GH_REPO=%%b"
    if "%%a"=="GROQ_KEY" set "GROQ_KEY=%%b"
)

if "%GH_TOKEN%"=="" (
    echo ERRO: GH_TOKEN nao encontrado em tokens.env
    pause
    exit /b
)

REM Abre o navegador com tokens na URL (auto-configura o app)
set "APP_URL=https://apbulcao.github.io/lista-mercado/#setup&token=%GH_TOKEN%&repo=%GH_REPO%&groq=%GROQ_KEY%"
echo Abrindo o app no navegador...
start "" "%APP_URL%"
echo.

REM Verifica dependencias
cd /d "%~dp0"
python -c "import fastapi, uvicorn, playwright" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERRO: dependencias nao instaladas.
    echo Rode instalar.bat primeiro.
    echo.
    pause
    exit /b
)

REM Inicia o bot
echo Bot rodando em http://localhost:7430
echo NAO FECHE ESTA JANELA enquanto estiver usando o bot.
echo.
python -m uvicorn bot:app --host 127.0.0.1 --port 7430
echo.
echo ============================================
echo O bot parou. Se foi inesperado, veja o erro acima.
echo ============================================
pause
