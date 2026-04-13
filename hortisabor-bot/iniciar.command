#!/bin/bash
# Inicia o bot do Hortisabor. Clique duplo para abrir.

cd "$(dirname "$0")"

PYTHON=/opt/homebrew/bin/python3.11

if ! command -v "$PYTHON" &>/dev/null; then
  echo "Python 3.11 não encontrado em $PYTHON"
  echo "Instale com: brew install python@3.11"
  read -p "Pressione Enter para fechar..."
  exit 1
fi

echo "============================================"
echo "  Bot Hortisabor — iniciando na porta 7430"
echo "  Ctrl+C para parar"
echo "============================================"
echo ""

# Abre o site após 2s (tempo para o servidor subir)
(sleep 2 && open "https://apbulcao.github.io/lista-mercado/") &

"$PYTHON" -m uvicorn bot:app --host 127.0.0.1 --port 7430
