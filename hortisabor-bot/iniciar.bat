@echo off
chcp 65001 > nul
echo === Hortisabor Bot ===
echo Servico rodando em http://localhost:7430
echo Para encerrar: feche esta janela
echo.
uvicorn bot:app --host 127.0.0.1 --port 7430
