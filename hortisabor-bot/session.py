import json
import os
import platform
from pathlib import Path


def _default_data_dir() -> Path:
    env = os.environ.get('HORTISABOR_DATA_DIR')
    if env:
        return Path(env)
    if platform.system() == 'Windows':
        return Path(os.environ.get('APPDATA', Path.home())) / 'lista-mercado'
    return Path.home() / '.hortisabor-bot'


COOKIES_PATH = _default_data_dir() / 'hortisabor_session.json'


def carregar_cookies():
    """Retorna lista de cookies ou None se não houver arquivo."""
    if not COOKIES_PATH.exists():
        return None
    with open(COOKIES_PATH, encoding='utf-8') as f:
        return json.load(f)


def salvar_cookies(cookies):
    """Salva lista de cookies no disco. Cria diretório se necessário."""
    COOKIES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(COOKIES_PATH, 'w', encoding='utf-8') as f:
        json.dump(cookies, f)


def limpar_cookies():
    """Remove o arquivo de cookies se existir."""
    if COOKIES_PATH.exists():
        COOKIES_PATH.unlink()
