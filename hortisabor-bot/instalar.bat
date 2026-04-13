@echo off
chcp 65001 > nul
echo === Instalando Hortisabor Bot ===
echo.

REM Verifica Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao encontrado. Tentando instalar via winget...
    winget --version >nul 2>&1
    if %errorlevel% equ 0 (
        winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
        echo.
        echo Python instalado. FECHE esta janela e abra instalar.bat novamente.
        pause
        exit /b
    ) else (
        echo winget nao disponivel neste Windows.
        echo Abrindo pagina de download do Python...
        start https://www.python.org/downloads/
        echo.
        echo INSTRUCOES:
        echo 1. Baixe e instale o Python (marque "Add Python to PATH")
        echo 2. Feche esta janela
        echo 3. Abra instalar.bat novamente
        pause
        exit /b
    )
)

echo Python encontrado.
echo.
echo Instalando dependencias Python...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERRO ao instalar dependencias. Verifique sua conexao.
    pause
    exit /b
)

echo.
echo Instalando navegador Chromium...
playwright install chromium
if %errorlevel% neq 0 (
    echo ERRO ao instalar Chromium.
    pause
    exit /b
)

echo.
echo === Instalacao concluida! ===
echo Para usar: abra iniciar.bat antes de fazer as compras.
pause
