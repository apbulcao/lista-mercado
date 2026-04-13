import json
import pytest
from pathlib import Path


def test_carregar_cookies_sem_arquivo(tmp_path, monkeypatch):
    import session
    monkeypatch.setattr(session, 'COOKIES_PATH', tmp_path / 'inexistente.json')
    assert session.carregar_cookies() is None


def test_salvar_e_carregar_cookies(tmp_path, monkeypatch):
    import session
    monkeypatch.setattr(session, 'COOKIES_PATH', tmp_path / 'session.json')
    cookies = [{'name': 'session', 'value': 'abc123', 'domain': '.hortisabor.com.br'}]
    session.salvar_cookies(cookies)
    loaded = session.carregar_cookies()
    assert loaded == cookies


def test_salvar_cria_diretorio(tmp_path, monkeypatch):
    import session
    nested = tmp_path / 'sub' / 'dir' / 'session.json'
    monkeypatch.setattr(session, 'COOKIES_PATH', nested)
    session.salvar_cookies([{'name': 'x', 'value': 'y'}])
    assert nested.exists()


def test_limpar_cookies(tmp_path, monkeypatch):
    import session
    path = tmp_path / 'session.json'
    monkeypatch.setattr(session, 'COOKIES_PATH', path)
    session.salvar_cookies([{'name': 'x', 'value': 'y'}])
    session.limpar_cookies()
    assert session.carregar_cookies() is None


def test_limpar_cookies_sem_arquivo_nao_lanca_erro(tmp_path, monkeypatch):
    import session
    monkeypatch.setattr(session, 'COOKIES_PATH', tmp_path / 'nao_existe.json')
    session.limpar_cookies()  # não deve levantar exceção
