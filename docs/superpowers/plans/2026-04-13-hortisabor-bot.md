# Hortisabor Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um serviço Python local que monta o carrinho no Hortisabor automaticamente a partir da lista de compras do lista-mercado, com autenticação via cookie persistence para contornar CAPTCHA.

**Architecture:** FastAPI em `localhost:7430` recebe a lista de itens do lista-mercado (React/GitHub Pages) e usa Playwright para automatizar o Hortisabor headless. Sessão é persistida em cookies para evitar re-login a cada uso. Na ausência de cookies válidos, abre Chrome visível para o usuário logar manualmente uma vez. O lista-mercado adiciona um botão "Pedir no Hortisabor" que oculta a si mesmo quando o serviço não está rodando.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, Playwright (Chromium), pytest, pytest-asyncio, httpx — React 18 + Vitest (lado frontend, padrão existente do projeto)

---

## Mapa de arquivos

### Criados (Python service)
| Arquivo | Responsabilidade |
|---------|-----------------|
| `hortisabor-bot/session.py` | Carregar/salvar/limpar cookies em `%APPDATA%\lista-mercado\hortisabor_session.json` |
| `hortisabor-bot/bot.py` | FastAPI app + Playwright automation (login, busca, adicionar ao carrinho) |
| `hortisabor-bot/requirements.txt` | Dependências Python |
| `hortisabor-bot/descobrir_seletores.py` | Script único de descoberta: abre Hortisabor e dumpa inputs/botões para arquivo |
| `hortisabor-bot/instalar.bat` | Setup único no Windows (Python + deps + Chromium) |
| `hortisabor-bot/iniciar.bat` | Inicia o serviço |
| `hortisabor-bot/tests/test_session.py` | Testes unitários de session.py |
| `hortisabor-bot/tests/test_bot_api.py` | Testes dos endpoints FastAPI |

### Modificados (React app)
| Arquivo | O que muda |
|---------|-----------|
| `src/components/BarraAcoes.jsx` | Adiciona botão "Pedir no Hortisabor" (condicional em `botOnline`) |
| `src/App.jsx` | Adiciona `botOnline` state, `pedidoStatus` state, `handlePedirHortisabor`, modal de resultado |

### Criados (React testes)
| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/components/__tests__/BarraAcoes.test.jsx` | Testa renderização do novo botão |

---

## Task 1: Session management

**Files:**
- Create: `hortisabor-bot/session.py`
- Create: `hortisabor-bot/tests/test_session.py`
- Create: `hortisabor-bot/requirements.txt`

- [ ] **Step 1: Criar requirements.txt e pytest.ini**

`hortisabor-bot/requirements.txt`:
```
fastapi==0.115.12
uvicorn[standard]==0.34.0
playwright==1.51.0
pytest==8.3.5
pytest-asyncio==0.25.3
httpx==0.28.1
```

`hortisabor-bot/pytest.ini` (permite `import session` e `import bot` nos testes sem instalar como pacote):
```ini
[pytest]
testpaths = tests
pythonpath = .
```

- [ ] **Step 2: Escrever testes de session.py**

Criar `hortisabor-bot/tests/test_session.py` (sem `__init__.py` — desnecessário com pytest.ini):

```python
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
```

- [ ] **Step 3: Rodar testes para verificar que falham**

```bash
cd hortisabor-bot
pip install -r requirements.txt
pytest tests/test_session.py -v
```

Esperado: `ModuleNotFoundError: No module named 'session'`

- [ ] **Step 4: Criar session.py**

```python
import json
import os
from pathlib import Path

COOKIES_PATH = Path(os.environ.get('APPDATA', Path.home())) / 'lista-mercado' / 'hortisabor_session.json'


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
```

- [ ] **Step 5: Rodar testes para verificar que passam**

```bash
pytest tests/test_session.py -v
```

Esperado: 5 testes PASS.

- [ ] **Step 6: Commit**

```bash
git add hortisabor-bot/session.py hortisabor-bot/requirements.txt hortisabor-bot/tests/
git commit -m "feat(bot): session management com cookie persistence"
```

---

## Task 2: FastAPI skeleton com /status

**Files:**
- Create: `hortisabor-bot/bot.py`
- Modify: `hortisabor-bot/tests/test_bot_api.py`

- [ ] **Step 1: Escrever teste para /status**

Criar `hortisabor-bot/tests/test_bot_api.py`:

```python
from unittest.mock import patch, AsyncMock
import pytest


# Patch playwright antes de importar bot para evitar conexão real
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
```

- [ ] **Step 2: Rodar teste para verificar que falha**

```bash
pytest tests/test_bot_api.py::test_status -v
```

Esperado: `ModuleNotFoundError: No module named 'bot'`

- [ ] **Step 3: Criar bot.py com esqueleto FastAPI**

```python
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright

from session import carregar_cookies, salvar_cookies, limpar_cookies


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ItemRequest(BaseModel):
    nome: str
    quantidade: str
    marca: str = ''
    detalhes: str = ''


# ---------------------------------------------------------------------------
# Reauth state — mantém o browser visível aberto entre requisições
# ---------------------------------------------------------------------------

class _ReauthState:
    playwright: Optional[Playwright] = None
    browser: Optional[Browser] = None
    context: Optional[BrowserContext] = None
    page: Optional[Page] = None

    def aberto(self) -> bool:
        return self.browser is not None


_reauth = _ReauthState()

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    if _reauth.browser:
        await _reauth.browser.close()
    if _reauth.playwright:
        await _reauth.playwright.stop()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'https://apbulcao.github.io',
        'http://localhost:5173',
        'http://localhost:4173',
    ],
    allow_methods=['GET', 'POST'],
    allow_headers=['*'],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get('/status')
async def status():
    return {'ok': True}


@app.post('/montar-carrinho')
async def montar_carrinho(itens: list[ItemRequest]):
    # Implementado na Task 5
    return {'status': 'nao_implementado'}
```

- [ ] **Step 4: Rodar testes**

```bash
pytest tests/test_bot_api.py::test_status -v
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add hortisabor-bot/bot.py hortisabor-bot/tests/test_bot_api.py
git commit -m "feat(bot): FastAPI skeleton com /status"
```

---

## Task 3: Lógica do /montar-carrinho (com Playwright mockado)

**Files:**
- Modify: `hortisabor-bot/tests/test_bot_api.py`
- Modify: `hortisabor-bot/bot.py`

- [ ] **Step 1: Adicionar testes de /montar-carrinho**

Adicionar ao final de `hortisabor-bot/tests/test_bot_api.py`:

```python
def test_montar_carrinho_sem_cookies_retorna_reauth(monkeypatch):
    from fastapi.testclient import TestClient
    import bot

    monkeypatch.setattr(bot, 'carregar_cookies', lambda: None)

    async def fake_abrir_reauth():
        pass

    monkeypatch.setattr(bot, '_abrir_reauth', fake_abrir_reauth, raising=False)

    client = TestClient(bot.app)
    response = client.post('/montar-carrinho', json=[
        {'nome': 'leite integral', 'quantidade': '2', 'marca': '', 'detalhes': ''}
    ])
    assert response.status_code == 200
    assert response.json()['status'] == 'reauth_needed'


def test_montar_carrinho_com_cookies_chama_headless(monkeypatch):
    from fastapi.testclient import TestClient
    import bot

    cookies = [{'name': 'session', 'value': 'abc', 'domain': '.hortisabor.com.br'}]
    monkeypatch.setattr(bot, 'carregar_cookies', lambda: cookies)

    resultado_fake = {
        'encontrados': ['leite integral'],
        'nao_encontrados': [],
    }

    async def fake_executar_headless(cookies, itens):
        return resultado_fake

    monkeypatch.setattr(bot, '_executar_headless', fake_executar_headless, raising=False)

    client = TestClient(bot.app)
    response = client.post('/montar-carrinho', json=[
        {'nome': 'leite integral', 'quantidade': '2', 'marca': '', 'detalhes': ''}
    ])
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

    async def fake_headless_expirado(cookies, itens):
        return None  # None = cookies expiraram (redirecionou para login)

    async def fake_abrir_reauth():
        pass

    monkeypatch.setattr(bot, '_executar_headless', fake_headless_expirado, raising=False)
    monkeypatch.setattr(bot, '_abrir_reauth', fake_abrir_reauth, raising=False)

    client = TestClient(bot.app)
    response = client.post('/montar-carrinho', json=[
        {'nome': 'leite', 'quantidade': '1', 'marca': '', 'detalhes': ''}
    ])
    assert response.status_code == 200
    assert response.json()['status'] == 'reauth_needed'
```

- [ ] **Step 2: Rodar testes para verificar que falham**

```bash
pytest tests/test_bot_api.py -v
```

Esperado: os 3 novos testes falham (funções `_abrir_reauth`, `_executar_headless` não existem ainda).

- [ ] **Step 3: Implementar lógica do endpoint em bot.py**

Substituir o endpoint `montar_carrinho` e adicionar as funções auxiliares:

```python
# Adicionar ANTES do endpoint montar_carrinho:

async def _abrir_reauth():
    """Abre Chrome visível na página de login do Hortisabor."""
    global _reauth
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=False)
    context = await browser.new_context()
    page = await context.new_page()
    await page.goto('https://www.delivery.hortisabor.com.br/login/')
    _reauth.playwright = pw
    _reauth.browser = browser
    _reauth.context = context
    _reauth.page = page


async def _verificar_login_reauth() -> bool:
    """Retorna True se o usuário já fez login no browser visível."""
    if not _reauth.page:
        return False
    return '/login/' not in _reauth.page.url


async def _finalizar_reauth():
    """Salva cookies do browser visível e o fecha."""
    cookies = await _reauth.context.cookies()
    salvar_cookies(cookies)
    await _reauth.browser.close()
    await _reauth.playwright.stop()
    _reauth.playwright = None
    _reauth.browser = None
    _reauth.context = None
    _reauth.page = None


async def _executar_headless(cookies, itens: list[ItemRequest]) -> Optional[dict]:
    """
    Executa automação headless. Retorna dict com encontrados/nao_encontrados,
    ou None se os cookies estiverem expirados (redirecionou para /login/).
    Implementação completa na Task 5.
    """
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context()
    await context.add_cookies(cookies)
    page = await context.new_page()

    try:
        await page.goto('https://www.delivery.hortisabor.com.br/', wait_until='networkidle')

        if '/login/' in page.url:
            return None  # Cookies expirados

        # Placeholder: substituir na Task 5 com automação real
        return {'encontrados': [], 'nao_encontrados': [i.nome for i in itens]}
    finally:
        await browser.close()
        await pw.stop()


# Substituir o endpoint montar_carrinho por:

@app.post('/montar-carrinho')
async def montar_carrinho(itens: list[ItemRequest]):
    cookies = carregar_cookies()

    # Sem cookies: abre reauth e retorna
    if not cookies:
        if not _reauth.aberto():
            await _abrir_reauth()
        return {'status': 'reauth_needed', 'mensagem': 'Faça login na janela que abriu. Depois clique em Pedir novamente.'}

    # Reauth browser aberto: verifica se já logou
    if _reauth.aberto():
        logado = await _verificar_login_reauth()
        if not logado:
            return {'status': 'reauth_needed', 'mensagem': 'Ainda não logado. Faça login e clique em Pedir novamente.'}
        await _finalizar_reauth()

    # Executa headless com cookies salvos
    resultado = await _executar_headless(cookies, itens)

    # Cookies expiraram durante a execução
    if resultado is None:
        limpar_cookies()
        if not _reauth.aberto():
            await _abrir_reauth()
        return {'status': 'reauth_needed', 'mensagem': 'Sessão expirada. Faça login na janela que abriu.'}

    return {
        'status': 'ok',
        'url_carrinho': 'https://www.delivery.hortisabor.com.br/carrinho/',
        'encontrados': resultado['encontrados'],
        'nao_encontrados': resultado['nao_encontrados'],
    }
```

- [ ] **Step 4: Rodar todos os testes**

```bash
pytest tests/ -v
```

Esperado: 8 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add hortisabor-bot/bot.py hortisabor-bot/tests/test_bot_api.py
git commit -m "feat(bot): lógica do endpoint montar-carrinho com reauth flow"
```

---

## Task 4: Descoberta de seletores do Hortisabor

**Files:**
- Create: `hortisabor-bot/descobrir_seletores.py`

Esta task é manual. O script abre o Hortisabor em modo visível e dumpa a estrutura DOM relevante para identificar os seletores necessários na Task 5.

- [ ] **Step 1: Criar o script de descoberta**

```python
"""
Script único de descoberta de seletores.
Execute uma vez: python descobrir_seletores.py
Saída: seletores_descobertos.txt
"""
import asyncio
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        print("Abrindo Hortisabor...")
        await page.goto('https://www.delivery.hortisabor.com.br/', wait_until='networkidle')

        print("Coletando elementos interativos...")
        elementos = await page.evaluate("""() => {
            const inputs = [...document.querySelectorAll('input')].map(el => ({
                tipo: 'input',
                type: el.type,
                placeholder: el.placeholder,
                name: el.name,
                id: el.id,
                className: el.className.slice(0, 80)
            }))
            const buttons = [...document.querySelectorAll('button')].slice(0, 30).map(el => ({
                tipo: 'button',
                text: el.innerText.trim().slice(0, 60),
                id: el.id,
                className: el.className.slice(0, 80)
            }))
            return [...inputs, ...buttons]
        }""")

        with open('seletores_descobertos.txt', 'w', encoding='utf-8') as f:
            f.write("=== ELEMENTOS INTERATIVOS ===\\n\\n")
            for el in elementos:
                f.write(str(el) + "\\n")

        print("\\nSalvo em seletores_descobertos.txt")
        print("Agora adicione um item ao carrinho manualmente no browser aberto.")
        print("Pressione Enter quando terminar para capturar mais seletores...")
        input()

        # Captura seletores da página atual (ex: carrinho ou produto)
        elementos2 = await page.evaluate("""() => {
            return [...document.querySelectorAll('button, input, [class*="cart"], [class*="add"], [class*="busca"], [class*="search"]')]
                .slice(0, 40)
                .map(el => ({
                    tag: el.tagName,
                    text: el.innerText?.trim().slice(0, 60),
                    id: el.id,
                    className: el.className.slice(0, 80),
                    href: el.href
                }))
        }""")

        with open('seletores_descobertos.txt', 'a', encoding='utf-8') as f:
            f.write("\\n\\n=== APÓS NAVEGAÇÃO MANUAL ===\\n\\n")
            for el in elementos2:
                f.write(str(el) + "\\n")

        await browser.close()
        print("seletores_descobertos.txt atualizado.")


asyncio.run(main())
```

- [ ] **Step 2: Executar o script**

```bash
cd hortisabor-bot
python descobrir_seletores.py
```

Navegue manualmente no browser que abrir: faça uma busca, abra um produto, clique em adicionar ao carrinho. Pressione Enter no terminal quando terminar.

- [ ] **Step 3: Registrar seletores encontrados**

Abrir `seletores_descobertos.txt` e anotar:
- **Seletor do campo de busca** (ex: `input[placeholder*="buscar"]` ou `input#search`)
- **Seletor do primeiro resultado** (ex: `.produto-item:first-child` ou `[data-testid="product-card"]`)
- **Seletor do botão "Adicionar ao carrinho"** (ex: `button[class*="add-to-cart"]`)
- **Seletor do campo de quantidade** (ex: `input[class*="quantidade"]`)
- **Como detectar login** (ex: URL muda de `/login/` para `/`, ou aparece elemento `.usuario-logado`)

Esses valores são usados na Task 5. Guardar em comentário no topo de `bot.py`.

- [ ] **Step 4: Commit**

```bash
git add hortisabor-bot/descobrir_seletores.py
git commit -m "feat(bot): script de descoberta de seletores DOM"
```

---

## Task 5: Automação Playwright completa

**Files:**
- Modify: `hortisabor-bot/bot.py`

Esta task substitui o placeholder de `_executar_headless` com a automação real, usando os seletores descobertos na Task 4.

- [ ] **Step 1: Adicionar constantes de seletores no topo de bot.py**

Após os imports, adicionar bloco de seletores (preencher com os valores de `seletores_descobertos.txt`):

```python
# ---------------------------------------------------------------------------
# Seletores DOM do Hortisabor — descobertos via descobrir_seletores.py
# Atualizar se o site mudar layout
# ---------------------------------------------------------------------------
SEL_BUSCA = 'input[placeholder*="buscar" i]'         # campo de busca principal
SEL_RESULTADO_ITEM = '[class*="product"]:first-child'  # primeiro item nos resultados
SEL_ADICIONAR = 'button[class*="add" i]'              # botão adicionar ao carrinho
SEL_QUANTIDADE = 'input[type="number"]'               # campo de quantidade (se existir)
URL_HOME = 'https://www.delivery.hortisabor.com.br/'
URL_LOGIN = 'https://www.delivery.hortisabor.com.br/login/'
URL_CARRINHO = 'https://www.delivery.hortisabor.com.br/carrinho/'
```

- [ ] **Step 2: Substituir `_executar_headless` pela implementação completa**

```python
async def _executar_headless(cookies, itens: list[ItemRequest]) -> Optional[dict]:
    """
    Executa automação headless com cookies salvos.
    Retorna dict com encontrados/nao_encontrados, ou None se cookies expiraram.
    """
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context()
    await context.add_cookies(cookies)
    page = await context.new_page()

    encontrados = []
    nao_encontrados = []

    try:
        await page.goto(URL_HOME, wait_until='networkidle', timeout=30000)

        # Verifica se cookies ainda são válidos
        if '/login/' in page.url:
            return None

        for item in itens:
            termo = f'{item.nome} {item.marca}'.strip()
            adicionado = await _adicionar_item(page, item, termo)
            if adicionado:
                encontrados.append(item.nome)
            else:
                nao_encontrados.append(item.nome)

        return {'encontrados': encontrados, 'nao_encontrados': nao_encontrados}

    except Exception as e:
        print(f'[bot] Erro na automação: {e}')
        return {'encontrados': encontrados, 'nao_encontrados': nao_encontrados + [i.nome for i in itens if i.nome not in encontrados]}

    finally:
        await browser.close()
        await pw.stop()


async def _adicionar_item(page, item: ItemRequest, termo: str) -> bool:
    """
    Busca um item e adiciona ao carrinho. Retorna True se encontrado.
    Timeout de 10s por item.
    """
    try:
        # Busca
        campo_busca = page.locator(SEL_BUSCA).first
        await campo_busca.click()
        await campo_busca.fill(termo)
        await campo_busca.press('Enter')

        # Aguarda resultados
        primeiro_resultado = page.locator(SEL_RESULTADO_ITEM).first
        await primeiro_resultado.wait_for(state='visible', timeout=10000)

        # Clica no primeiro resultado
        await primeiro_resultado.click()
        await page.wait_for_load_state('networkidle', timeout=10000)

        # Ajusta quantidade se > 1
        if item.quantidade and item.quantidade != '1':
            campo_qtd = page.locator(SEL_QUANTIDADE).first
            qtd_visivel = await campo_qtd.is_visible()
            if qtd_visivel:
                await campo_qtd.fill(item.quantidade)

        # Adiciona ao carrinho
        btn = page.locator(SEL_ADICIONAR).first
        await btn.click()
        await page.wait_for_timeout(1000)  # aguarda feedback visual

        return True

    except Exception as e:
        print(f'[bot] Item não encontrado: {termo} — {e}')
        return False
```

- [ ] **Step 3: Teste manual — primeira execução (reauth)**

Com o serviço rodando (`uvicorn bot:app --host 127.0.0.1 --port 7430`), enviar requisição de teste:

```bash
curl -X POST http://localhost:7430/montar-carrinho \
  -H "Content-Type: application/json" \
  -d '[{"nome": "banana", "quantidade": "1", "marca": "", "detalhes": ""}]'
```

Esperado: Chrome abre na página de login do Hortisabor e resposta é `{"status": "reauth_needed", ...}`.

- [ ] **Step 4: Fazer login manualmente no Chrome que abriu**

Logar com as credenciais do Hortisabor (resolver CAPTCHA). Após login bem-sucedido, enviar a requisição novamente:

```bash
curl -X POST http://localhost:7430/montar-carrinho \
  -H "Content-Type: application/json" \
  -d '[{"nome": "banana", "quantidade": "1", "marca": "", "detalhes": ""}]'
```

Esperado: Chrome fecha, resposta é `{"status": "ok", "url_carrinho": "...", "encontrados": ["banana"], "nao_encontrados": []}`.

- [ ] **Step 5: Se seletores falharem, corrigir SEL_* e repetir Step 3-4**

Reabrir `descobrir_seletores.py`, usar `page.pause()` para inspecionar o DOM, ajustar as constantes `SEL_*` em `bot.py` conforme necessário.

- [ ] **Step 6: Commit**

```bash
git add hortisabor-bot/bot.py
git commit -m "feat(bot): automação Playwright completa com busca e add-to-cart"
```

---

## Task 6: Scripts Windows

**Files:**
- Create: `hortisabor-bot/instalar.bat`
- Create: `hortisabor-bot/iniciar.bat`

- [ ] **Step 1: Criar instalar.bat**

```batch
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
```

- [ ] **Step 2: Criar iniciar.bat**

```batch
@echo off
chcp 65001 > nul
echo === Hortisabor Bot ===
echo Servico rodando em http://localhost:7430
echo Para encerrar: feche esta janela
echo.
uvicorn bot:app --host 127.0.0.1 --port 7430
```

- [ ] **Step 3: Testar instalar.bat em Windows**

Copiar a pasta `hortisabor-bot/` para um Windows (ou a máquina da usuária) e executar `instalar.bat`. Verificar que instala sem erros.

- [ ] **Step 4: Commit**

```bash
git add hortisabor-bot/instalar.bat hortisabor-bot/iniciar.bat
git commit -m "feat(bot): scripts de instalação e inicialização Windows"
```

---

## Task 7: BarraAcoes.jsx — botão Hortisabor

**Files:**
- Create: `src/components/__tests__/BarraAcoes.test.jsx`
- Modify: `src/components/BarraAcoes.jsx`

- [ ] **Step 1: Escrever testes**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BarraAcoes from '../BarraAcoes'

describe('BarraAcoes', () => {
  it('renderiza botão Copiar para WhatsApp', () => {
    render(<BarraAcoes onCopiar={() => {}} onConfirmar={() => {}} botOnline={false} onPedirHortisabor={() => {}} />)
    expect(screen.getByText('📋 Copiar para WhatsApp')).toBeInTheDocument()
  })

  it('oculta botão Hortisabor quando botOnline=false', () => {
    render(<BarraAcoes onCopiar={() => {}} onConfirmar={() => {}} botOnline={false} onPedirHortisabor={() => {}} />)
    expect(screen.queryByText(/Pedir no Hortisabor/i)).not.toBeInTheDocument()
  })

  it('exibe botão Hortisabor quando botOnline=true', () => {
    render(<BarraAcoes onCopiar={() => {}} onConfirmar={() => {}} botOnline={true} onPedirHortisabor={() => {}} />)
    expect(screen.getByText(/Pedir no Hortisabor/i)).toBeInTheDocument()
  })

  it('chama onPedirHortisabor ao clicar no botão Hortisabor', () => {
    const handler = vi.fn()
    render(<BarraAcoes onCopiar={() => {}} onConfirmar={() => {}} botOnline={true} onPedirHortisabor={handler} />)
    fireEvent.click(screen.getByText(/Pedir no Hortisabor/i))
    expect(handler).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Rodar testes para verificar que falham**

```bash
npm test -- src/components/__tests__/BarraAcoes.test.jsx
```

Esperado: testes que usam `botOnline` / `onPedirHortisabor` falham.

- [ ] **Step 3: Modificar BarraAcoes.jsx**

```jsx
import { useState } from 'react'

export default function BarraAcoes({ onCopiar, onConfirmar, botOnline, onPedirHortisabor }) {
  const [copiado, setCopiado] = useState(false)

  const handleCopiar = async () => {
    await onCopiar()
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div
      className="fixed z-20"
      style={{
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      <div
        className="flex gap-2 items-center"
        style={{
          background: 'rgba(249,246,241,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid #E0D9CE',
          borderRadius: '100px',
          padding: '7px 10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <button
          onClick={handleCopiar}
          className="flex items-center gap-2 font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
          style={{
            backgroundColor: copiado ? '#52B788' : '#2D6A4F',
            color: '#fff',
            border: 'none',
            borderRadius: '100px',
            padding: '9px 20px',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {copiado ? '✓ Copiado!' : '📋 Copiar para WhatsApp'}
        </button>

        {botOnline && (
          <button
            onClick={onPedirHortisabor}
            className="font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
            style={{
              backgroundColor: '#1B4332',
              color: '#fff',
              border: 'none',
              borderRadius: '100px',
              padding: '9px 20px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            🛒 Pedir no Hortisabor
          </button>
        )}

        <button
          onClick={onConfirmar}
          className="font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
          style={{
            backgroundColor: 'transparent',
            color: '#1A1814',
            border: '1.5px solid #E0D9CE',
            borderRadius: '100px',
            padding: '9px 20px',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E0D9CE'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          Confirmar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm test -- src/components/__tests__/BarraAcoes.test.jsx
```

Esperado: 4 testes PASS.

- [ ] **Step 5: Rodar suite completa para garantir nenhuma regressão**

```bash
npm test
```

Esperado: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/components/BarraAcoes.jsx src/components/__tests__/BarraAcoes.test.jsx
git commit -m "feat: botão Pedir no Hortisabor na BarraAcoes (condicional)"
```

---

## Task 8: App.jsx — handler, estado e modal de resultado

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Adicionar estado e useEffect de status check**

Em `App.jsx`, logo após os `useState` existentes (linha ~28), adicionar:

```jsx
const [botOnline, setBotOnline] = useState(false)
const [pedidoStatus, setPedidoStatus] = useState(null)
// pedidoStatus: null | 'loading' | 'reauth' | 'error' | { url, encontrados, nao_encontrados }
```

Dentro do componente, após o `useEffect` de `carregarApp`, adicionar:

```jsx
useEffect(() => {
  fetch('http://localhost:7430/status')
    .then(r => { if (r.ok) setBotOnline(true) })
    .catch(() => {}) // offline = silencioso
}, [])
```

- [ ] **Step 2: Adicionar handler handlePedirHortisabor**

Após a função `handleConfirmar` (linha ~263), adicionar:

```jsx
async function handlePedirHortisabor() {
  const checkedItens = getItensSelecionadosValidos()
  if (!checkedItens) return

  setPedidoStatus('loading')

  try {
    const res = await fetch('http://localhost:7430/montar-carrinho', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        checkedItens.map(i => ({
          nome: i.nome,
          quantidade: i.quantidade,
          marca: i.marca || '',
          detalhes: i.detalhes || '',
        }))
      ),
    })

    const data = await res.json()

    if (data.status === 'reauth_needed') {
      setPedidoStatus('reauth')
    } else if (data.status === 'ok') {
      setPedidoStatus({ url: data.url_carrinho, encontrados: data.encontrados, nao_encontrados: data.nao_encontrados })
    } else {
      setPedidoStatus('error')
    }
  } catch {
    setPedidoStatus('error')
  }
}
```

- [ ] **Step 3: Atualizar chamada de BarraAcoes**

Substituir a linha que renderiza `<BarraAcoes>` (linha ~449):

```jsx
{view === 'lista' && (
  <BarraAcoes
    onCopiar={handleCopiar}
    onConfirmar={handleConfirmar}
    botOnline={botOnline}
    onPedirHortisabor={handlePedirHortisabor}
  />
)}
```

- [ ] **Step 4: Adicionar modal de resultado**

Antes do `<FeedbackModal />` (última linha do return), adicionar:

```jsx
{pedidoStatus && (
  <div
    className="fixed inset-0 z-30 flex items-end justify-center pb-28 px-4"
    style={{ pointerEvents: 'none' }}
  >
    <div
      className="w-full max-w-sm rounded-2xl p-4 shadow-xl space-y-3"
      style={{
        backgroundColor: '#FDFAF7',
        border: '1px solid #E0D9CE',
        pointerEvents: 'all',
      }}
    >
      {pedidoStatus === 'loading' && (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-[#2D6A4F] rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm font-medium" style={{ color: '#1A1814' }}>Montando carrinho…</span>
        </div>
      )}

      {pedidoStatus === 'reauth' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: '#1A1814' }}>Login necessário</p>
          <p className="text-xs" style={{ color: '#7A7267' }}>
            Uma janela do Chrome abriu. Faça login no Hortisabor e clique em Pedir novamente.
          </p>
          <button
            onClick={() => setPedidoStatus(null)}
            className="text-xs font-medium"
            style={{ color: '#7A7267' }}
          >
            Fechar
          </button>
        </div>
      )}

      {pedidoStatus === 'error' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: '#B91C1C' }}>Serviço não encontrado</p>
          <p className="text-xs" style={{ color: '#7A7267' }}>Verifique se iniciar.bat está rodando.</p>
          <button
            onClick={() => setPedidoStatus(null)}
            className="text-xs font-medium"
            style={{ color: '#7A7267' }}
          >
            Fechar
          </button>
        </div>
      )}

      {pedidoStatus !== null && typeof pedidoStatus === 'object' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#1A1814' }}>Carrinho pronto!</p>
            <button
              onClick={() => setPedidoStatus(null)}
              className="text-xs font-medium"
              style={{ color: '#7A7267' }}
            >
              Fechar
            </button>
          </div>
          <a
            href={pedidoStatus.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#2D6A4F' }}
          >
            🛒 Abrir carrinho no Hortisabor
          </a>
          {pedidoStatus.nao_encontrados.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#7A7267' }}>
                Não encontrados ({pedidoStatus.nao_encontrados.length}):
              </p>
              <p className="text-xs" style={{ color: '#B0AA9F' }}>
                {pedidoStatus.nao_encontrados.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 5: Rodar suite de testes**

```bash
npm test
```

Esperado: todos os testes passam (App.jsx não tem testes diretos que cubram as funções novas, mas nenhum teste existente deve quebrar).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: integração frontend com hortisabor-bot (estado, handler, modal)"
```

---

## Task 9: Validação manual end-to-end

Esta task é inteiramente manual. Nenhum arquivo é modificado — apenas verificação.

- [ ] **Step 1: Iniciar o serviço**

Na pasta `hortisabor-bot/`:
```bash
uvicorn bot:app --host 127.0.0.1 --port 7430
```

- [ ] **Step 2: Abrir o app em dev**

```bash
npm run dev
```

- [ ] **Step 3: Verificar que o botão aparece**

Abrir `http://localhost:5173`. O botão "🛒 Pedir no Hortisabor" deve aparecer na barra de ações.

- [ ] **Step 4: Testar fluxo de reauth (primeira vez)**

Com cookies deletados (`del "%APPDATA%\lista-mercado\hortisabor_session.json"`), clicar no botão. Verificar:
- Chrome abre na página de login
- Modal mostra "Login necessário"

- [ ] **Step 5: Logar e testar headless**

Fazer login no Chrome que abriu. Clicar em "Pedir" novamente. Verificar:
- Chrome fecha
- Modal muda para "Carrinho pronto!"
- Link "Abrir carrinho" funciona e mostra os itens adicionados no Hortisabor

- [ ] **Step 6: Verificar que WhatsApp export continua funcionando**

Clicar em "📋 Copiar para WhatsApp". Verificar que copia o texto normalmente, sem nenhuma alteração de comportamento.

- [ ] **Step 7: Commit final**

```bash
git add .
git commit -m "chore: validação manual e-2-e concluída — hortisabor bot funcional"
git push origin main
```

---

## Ordem de execução recomendada

```
Task 1 → Task 2 → Task 3  (Python, TDD)
Task 4                    (discovery manual — necessário antes da Task 5)
Task 5                    (automação Playwright — pode precisar de ajustes nos seletores)
Task 6                    (scripts Windows)
Task 7 → Task 8           (React, TDD)
Task 9                    (validação e-2-e)
```
