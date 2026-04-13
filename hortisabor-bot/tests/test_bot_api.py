from unittest.mock import patch
import pytest

PAYLOAD_BASE = {
    'itens': [{'nome': 'leite integral', 'quantidade': '2', 'marca': '', 'detalhes': ''}],
    'ai_provider': 'groq',
    'ai_api_key': '',
    'ai_url': '',
}


@pytest.fixture(autouse=True)
def mock_playwright(monkeypatch):
    with patch('playwright.async_api.async_playwright'):
        yield


def test_status():
    from fastapi.testclient import TestClient
    from bot import app
    client = TestClient(app)
    response = client.get('/status')
    assert response.status_code == 200
    assert response.json() == {'ok': True}


def test_montar_carrinho_sem_cookies_retorna_reauth(monkeypatch):
    from fastapi.testclient import TestClient
    import bot

    monkeypatch.setattr(bot, 'carregar_cookies', lambda: None)

    async def fake_abrir_reauth():
        pass

    monkeypatch.setattr(bot, '_abrir_reauth', fake_abrir_reauth, raising=False)

    client = TestClient(bot.app)
    response = client.post('/montar-carrinho', json=PAYLOAD_BASE)
    assert response.status_code == 200
    assert response.json()['status'] == 'reauth_needed'


def test_montar_carrinho_com_cookies_chama_headless(monkeypatch):
    from fastapi.testclient import TestClient
    import bot

    cookies = [{'name': 'session', 'value': 'abc', 'domain': '.hortisabor.com.br'}]
    monkeypatch.setattr(bot, 'carregar_cookies', lambda: cookies)

    resultado_fake = {'encontrados': ['leite integral'], 'nao_encontrados': []}

    async def fake_executar_headless(cookies, itens, ai_config):
        return resultado_fake

    monkeypatch.setattr(bot, '_executar_headless', fake_executar_headless, raising=False)

    client = TestClient(bot.app)
    response = client.post('/montar-carrinho', json=PAYLOAD_BASE)
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'ok'
    assert 'leite integral' in data['encontrados']
    assert data['url_carrinho'] == 'https://www.delivery.hortisabor.com.br/carrinho/'


def test_montar_carrinho_cookies_expirados_retorna_reauth(monkeypatch):
    from fastapi.testclient import TestClient
    import bot

    cookies = [{'name': 'session', 'value': 'expirado'}]
    monkeypatch.setattr(bot, 'carregar_cookies', lambda: cookies)
    monkeypatch.setattr(bot, 'limpar_cookies', lambda: None)

    async def fake_headless_expirado(cookies, itens, ai_config):
        return None

    async def fake_abrir_reauth():
        pass

    monkeypatch.setattr(bot, '_executar_headless', fake_headless_expirado, raising=False)
    monkeypatch.setattr(bot, '_abrir_reauth', fake_abrir_reauth, raising=False)

    client = TestClient(bot.app)
    response = client.post('/montar-carrinho', json=PAYLOAD_BASE)
    assert response.status_code == 200
    assert response.json()['status'] == 'reauth_needed'
