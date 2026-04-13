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
# Reauth state
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
# Seletores DOM do Hortisabor — descobertos via descobrir_seletores.py
# Atualizar se o site mudar layout
# ---------------------------------------------------------------------------
SEL_BUSCA = 'input[placeholder*="buscar" i]'
SEL_RESULTADO_ITEM = '[class*="product"]:first-child'
SEL_ADICIONAR = 'button[class*="add" i]'
SEL_QUANTIDADE = 'input[type="number"]'
URL_HOME = 'https://www.delivery.hortisabor.com.br/'
URL_LOGIN = 'https://www.delivery.hortisabor.com.br/login/'
URL_CARRINHO = 'https://www.delivery.hortisabor.com.br/carrinho/'


async def _abrir_reauth():
    """Abre Chrome visível na página de login do Hortisabor."""
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=False)
    context = await browser.new_context()
    page = await context.new_page()
    await page.goto(URL_LOGIN)
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


async def _adicionar_item(page, item: ItemRequest, termo: str) -> bool:
    """Busca um item e adiciona ao carrinho. Retorna True se encontrado."""
    try:
        campo_busca = page.locator(SEL_BUSCA).first
        await campo_busca.click()
        await campo_busca.fill(termo)
        await campo_busca.press('Enter')

        primeiro_resultado = page.locator(SEL_RESULTADO_ITEM).first
        await primeiro_resultado.wait_for(state='visible', timeout=10000)
        await primeiro_resultado.click()
        await page.wait_for_load_state('networkidle', timeout=10000)

        if item.quantidade and item.quantidade != '1':
            campo_qtd = page.locator(SEL_QUANTIDADE).first
            if await campo_qtd.is_visible():
                await campo_qtd.fill(item.quantidade)

        btn = page.locator(SEL_ADICIONAR).first
        await btn.click()
        await page.wait_for_timeout(1000)
        return True

    except Exception as e:
        print(f'[bot] Item não encontrado: {termo} — {e}')
        return False


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
        remaining = [i.nome for i in itens if i.nome not in encontrados]
        return {'encontrados': encontrados, 'nao_encontrados': nao_encontrados + remaining}

    finally:
        await browser.close()
        await pw.stop()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get('/status')
async def status():
    return {'ok': True}


@app.post('/montar-carrinho')
async def montar_carrinho(itens: list[ItemRequest]):
    cookies = carregar_cookies()

    if not cookies:
        if not _reauth.aberto():
            await _abrir_reauth()
        return {'status': 'reauth_needed', 'mensagem': 'Faça login na janela que abriu. Depois clique em Pedir novamente.'}

    if _reauth.aberto():
        logado = await _verificar_login_reauth()
        if not logado:
            return {'status': 'reauth_needed', 'mensagem': 'Ainda não logado. Faça login e clique em Pedir novamente.'}
        await _finalizar_reauth()

    resultado = await _executar_headless(cookies, itens)

    if resultado is None:
        limpar_cookies()
        if not _reauth.aberto():
            await _abrir_reauth()
        return {'status': 'reauth_needed', 'mensagem': 'Sessão expirada. Faça login na janela que abriu.'}

    return {
        'status': 'ok',
        'url_carrinho': URL_CARRINHO,
        'encontrados': resultado['encontrados'],
        'nao_encontrados': resultado['nao_encontrados'],
    }
