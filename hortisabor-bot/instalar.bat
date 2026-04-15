@echo off
chcp 65001 > nul
echo ╔══════════════════════════════════════╗
echo ║   Instalador - Lista de Mercado Bot  ║
echo ╚══════════════════════════════════════╝
echo.

REM Verifica Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao encontrado.
    echo.
    echo COMO INSTALAR (nao precisa de administrador):
    echo   1. Abra a Microsoft Store (loja do Windows)
    echo   2. Busque "Python 3.11"
    echo   3. Clique em "Obter" / "Get"
    echo   4. Quando terminar, feche esta janela e abra instalar.bat novamente
    echo.
    pause
    exit /b
)

for /f "tokens=2" %%a in ('python --version 2^>^&1') do echo Python encontrado: versao %%a
echo.

echo [1/3] Instalando dependencias Python...
python -m pip install --user -r "%~dp0requirements.txt"
if %errorlevel% neq 0 (
    echo.
    echo ERRO ao instalar dependencias. Verifique sua conexao com a internet.
    pause
    exit /b
)
echo OK!
echo.

echo [2/3] Instalando navegador Chromium para o bot...
python -m playwright install chromium
if %errorlevel% neq 0 (
    echo.
    echo ERRO ao instalar Chromium.
    pause
    exit /b
)
echo OK!
echo.

echo [3/3] Verificando tokens...
if not exist "%~dp0tokens.env" (
    echo.
    echo ERRO: arquivo tokens.env nao encontrado na pasta do bot.
    echo Peca ao Antonio para gerar o arquivo.
    pause
    exit /b
)
echo OK!
echo.

echo ╔══════════════════════════════════════╗
echo ║       Instalacao concluida!          ║
echo ║                                      ║
echo ║  Para usar: abra iniciar.bat         ║
echo ║  antes de fazer as compras.          ║
echo ╚══════════════════════════════════════╝
pause
