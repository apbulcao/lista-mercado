@echo off
chcp 65001 > nul
echo ╔══════════════════════════════════════╗
echo ║   Instalador - Lista de Mercado Bot  ║
echo ╚══════════════════════════════════════╝
echo.

REM Verifica Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao encontrado. Tentando instalar via winget...
    winget --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo.
        echo Instalando Python 3.11 (pode demorar alguns minutos)...
        winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
        if %errorlevel% neq 0 (
            echo ERRO ao instalar Python via winget.
            echo Abrindo pagina de download manual...
            start https://www.python.org/downloads/
            echo.
            echo INSTRUCOES:
            echo 1. Baixe e instale o Python
            echo 2. IMPORTANTE: marque "Add Python to PATH" na instalacao
            echo 3. Feche esta janela e abra instalar.bat novamente
            pause
            exit /b
        )
        echo.
        echo Python instalado com sucesso!
        echo.
        echo IMPORTANTE: Feche esta janela e abra instalar.bat novamente
        echo para que o Python seja reconhecido.
        pause
        exit /b
    ) else (
        echo winget nao disponivel neste Windows.
        echo Abrindo pagina de download do Python...
        start https://www.python.org/downloads/
        echo.
        echo INSTRUCOES:
        echo 1. Baixe e instale o Python
        echo 2. IMPORTANTE: marque "Add Python to PATH" na instalacao
        echo 3. Feche esta janela e abra instalar.bat novamente
        pause
        exit /b
    )
)

for /f "tokens=2" %%a in ('python --version 2^>^&1') do echo Python encontrado: versao %%a
echo.

echo [1/3] Instalando dependencias Python...
pip install -r "%~dp0requirements.txt"
if %errorlevel% neq 0 (
    echo.
    echo ERRO ao instalar dependencias. Verifique sua conexao com a internet.
    pause
    exit /b
)
echo OK!
echo.

echo [2/3] Instalando navegador Chromium para o bot...
playwright install chromium
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
