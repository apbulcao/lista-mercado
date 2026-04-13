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
        if self.browser is None:
            return False
        if not self.browser.is_connected():
            # Browser foi fechado externamente — limpa estado sem tentar fechar
            self.playwright = None
            self.browser = None
            self.context = None
            self.page = None
            return False
        return True


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
SEL_BUSCA = '#search-term'
SEL_QUANTIDADE = 'input.vip-spin__quantity'
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
        campo_busca = page.locator(SEL_BUSCA)
        await campo_busca.click()
        await campo_busca.fill(termo)
        await campo_busca.press('Enter')

        # Aguarda resultados carregarem (Angular renderiza após request)
        btn_adicionar = page.locator('button', has_text='Adicionar').first
        sem_resultado = page.locator('button', has_text='Nenhum resultado encontrado')

        # Espera pelo primeiro que aparecer: resultado ou ausência de resultado
        await page.wait_for_selector(
            'button:text("Adicionar"), button:text("Nenhum resultado encontrado")',
            timeout=12000,
        )

        if await sem_resultado.is_visible():
            print(f'[bot] Sem resultados para: {termo}')
            return False

        # Ajusta quantidade antes de adicionar (campo já visível no card)
        if item.quantidade and item.quantidade not in ('', '1'):
            qtd_input = page.locator(SEL_QUANTIDADE).first
            if await qtd_input.is_visible():
                await qtd_input.triple_click()
                await qtd_input.fill(item.quantidade)

        await btn_adicionar.click()
        await page.wait_for_timeout(1500)
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
        # Chrome está aberto — verificar se o usuário já fez login
        logado = await _verificar_login_reauth()
        if not logado:
            return {'status': 'reauth_needed', 'mensagem': 'Ainda não logado. Faça login e clique em Pedir novamente.'}
        await _finalizar_reauth()
        cookies = carregar_cookies()  # recarrega após salvar
        if not cookies:
            return {'status': 'reauth_needed', 'mensagem': 'Erro ao salvar sessão. Tente novamente.'}

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
