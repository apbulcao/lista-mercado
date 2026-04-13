import asyncio
import pytest
from fastapi.testclient import TestClient

from bot import app, _montagem

client = TestClient(app)


def reset_state():
    _montagem.estado = "idle"
    _montagem.item_atual = ""
    _montagem.item_id = ""
    _montagem.progresso = {"feitos": 0, "total": 0}
    _montagem.encontrados = []
    _montagem.nao_encontrados = []
    _montagem._url_event = None
    _montagem._url_fornecida = ""


def test_iniciar_montagem_sem_cookies_retorna_reauth(monkeypatch):
    reset_state()
    monkeypatch.setattr("bot.carregar_cookies", lambda: None)
    async def mock_abrir():
        pass
    monkeypatch.setattr("bot._abrir_reauth", mock_abrir)

    res = client.post("/iniciar-montagem", json={
        "itens": [{"id": "banana", "nome": "banana prata", "quantidade": "6"}]
    })
    assert res.status_code == 200
    assert res.json()["status"] == "reauth_needed"


def test_iniciar_montagem_conflito_quando_ja_rodando(monkeypatch):
    reset_state()
    _montagem.estado = "processando"
    monkeypatch.setattr("bot.carregar_cookies", lambda: [{"name": "x", "value": "y", "domain": "hortisabor.com.br", "path": "/"}])

    res = client.post("/iniciar-montagem", json={
        "itens": [{"id": "banana", "nome": "banana prata", "quantidade": "6"}]
    })
    assert res.status_code == 409


def test_fornecer_url_quando_nao_aguardando_retorna_400():
    reset_state()
    res = client.post("/fornecer-url", json={"item_id": "banana", "url": "https://example.com"})
    assert res.status_code == 400


def test_status_retorna_montagem():
    reset_state()
    res = client.get("/status")
    data = res.json()
    assert data["ok"] is True
    assert "montagem" in data
    assert data["montagem"]["estado"] == "idle"
