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

# Lê tokens do arquivo .tokens na raiz do projeto (um nível acima)
TOKENS_FILE="$(dirname "$0")/../.tokens"
GH_TOKEN=""
GH_REPO=""
GROQ_KEY=""

if [ -f "$TOKENS_FILE" ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    case "$key" in
      GH_TOKEN) GH_TOKEN="$value" ;;
      GH_REPO)  GH_REPO="$value"  ;;
      GROQ_KEY) GROQ_KEY="$value" ;;
    esac
  done < "$TOKENS_FILE"
fi

# Monta URL com setup params se os tokens estiverem configurados
APP_URL="https://apbulcao.github.io/lista-mercado/"
if [ -n "$GH_TOKEN" ] && [ "$GH_TOKEN" != "ghp_SEU_TOKEN_AQUI" ]; then
  PARAMS="token=${GH_TOKEN}&repo=${GH_REPO}&groq=${GROQ_KEY}"
  APP_URL="https://apbulcao.github.io/lista-mercado/#setup&${PARAMS}"
fi

# Abre o site após 2s (tempo para o servidor subir)
(sleep 2 && open "$APP_URL") &

"$PYTHON" -m uvicorn bot:app --host 127.0.0.1 --port 7430
