from contextlib import asynccontextmanager
from typing import Optional
import httpx
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


class MontagemRequest(BaseModel):
    itens: list[ItemRequest]
    ai_provider: str = ''   # groq | openrouter | gemini | custom
    ai_api_key: str = ''
    ai_url: str = ''        # usado apenas com provider 'custom'


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


async def _extrair_nomes_produtos(page) -> list[str]:
    """Extrai nomes dos produtos visíveis com botão Adicionar."""
    return await page.evaluate("""() => {
        const btns = [...document.querySelectorAll('button')]
            .filter(b => b.innerText.trim() === 'Adicionar');
        return btns.slice(0, 8).map((btn, i) => {
            let el = btn.parentElement;
            for (let j = 0; j < 6; j++) {
                if (!el) break;
                const lines = el.innerText.trim().split('\\n')
                    .map(l => l.trim()).filter(l => l.length > 3);
                if (lines.length >= 2) return lines[0];
                el = el.parentElement;
            }
            return `Produto ${i + 1}`;
        });
    }""")


async def _escolher_produto_ia(nomes: list[str], termo: str, provider: str, api_key: str, api_url: str) -> Optional[int]:
    """Pede à IA para escolher o índice (0-based) do produto mais adequado.
    Retorna None se nenhum corresponder."""
    if not api_key or not nomes:
        return 0

    lista = '\n'.join(f'{i+1}. {n}' for i, n in enumerate(nomes))
    prompt = (
        f'Você está montando um carrinho de supermercado.\n'
        f'O cliente quer: "{termo}"\n\n'
        f'Produtos encontrados:\n{lista}\n\n'
        f'Qual número corresponde melhor ao que o cliente quer? '
        f'Responda APENAS com o número (1, 2, 3...) ou "nenhum" se nenhum for adequado.'
    )

    try:
        if provider == 'gemini':
            url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}'
            payload = {'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'maxOutputTokens': 5}}
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(url, json=payload)
                text = r.json()['candidates'][0]['content']['parts'][0]['text'].strip()
        else:
            urls = {
                'groq': 'https://api.groq.com/openai/v1/chat/completions',
                'openrouter': 'https://openrouter.ai/api/v1/chat/completions',
                'custom': api_url or 'https://api.groq.com/openai/v1/chat/completions',
            }
            models = {
                'groq': 'llama-3.1-8b-instant',
                'openrouter': 'meta-llama/llama-3.1-8b-instruct:free',
            }
            url = urls.get(provider, urls['groq'])
            model = models.get(provider, 'llama-3.1-8b-instant')
            payload = {'model': model, 'messages': [{'role': 'user', 'content': prompt}], 'max_tokens': 5, 'temperature': 0}
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(url, headers={'Authorization': f'Bearer {api_key}'}, json=payload)
                text = r.json()['choices'][0]['message']['content'].strip()

        print(f'[bot] IA escolheu "{text}" para: {termo}')
        if text.isdigit():
            idx = int(text) - 1
            return idx if 0 <= idx < len(nomes) else 0
        return None  # "nenhum"
    except Exception as e:
        print(f'[bot] IA falhou ({e}), usando primeiro resultado')
        return 0


async def _adicionar_item(page, item: ItemRequest, termo: str, ai_config: dict) -> bool:
    """Busca um item e adiciona ao carrinho. Retorna True se encontrado."""
    try:
        campo_busca = page.locator(SEL_BUSCA)
        await campo_busca.click()
        await campo_busca.fill('')
        await page.keyboard.type(termo, delay=40)
        await page.wait_for_timeout(1500)

        todos_btns = page.locator('button', has_text='Adicionar')

        # Tenta autocomplete; se não aparecer, navega para resultados
        try:
            await todos_btns.first.wait_for(state='visible', timeout=5000)
        except Exception:
            await campo_busca.press('Enter')
            await page.wait_for_timeout(2000)
            try:
                await todos_btns.first.wait_for(state='visible', timeout=8000)
            except Exception:
                print(f'[bot] Sem resultados: {termo}')
                return False

        # IA escolhe o produto certo
        nomes = await _extrair_nomes_produtos(page)
        print(f'[bot] Produtos para "{termo}": {nomes}')
        idx = await _escolher_produto_ia(nomes, termo, **ai_config)

        if idx is None:
            print(f'[bot] IA descartou: {termo}')
            return False

        btn_escolhido = todos_btns.nth(idx)

        # Ajusta quantidade
        if item.quantidade and item.quantidade not in ('', '1'):
            qtd_input = page.locator(SEL_QUANTIDADE).nth(idx)
            if await qtd_input.is_visible():
                await qtd_input.fill(item.quantidade)

        await btn_escolhido.click()
        await page.wait_for_timeout(1500)
        return True

    except Exception as e:
        print(f'[bot] Erro inesperado "{termo}": {e}')
        return False


async def _fechar_modal_entrega(page) -> None:
    """Fecha modal de seleção de endereço/modalidade se aparecer após o carregamento."""
    # Candidatos comuns de botão para fechar/confirmar o modal de entrega
    candidatos = ['Confirmar', 'Entrega', 'Retirar', 'OK', 'Fechar', 'Continuar']
    for texto in candidatos:
        try:
            btn = page.locator('button', has_text=texto).first
            if await btn.is_visible(timeout=1000):
                print(f'[bot] Modal de entrega: clicando em "{texto}"')
                await btn.click()
                await page.wait_for_timeout(1500)
                return
        except Exception:
            continue
    # Tenta Escape como fallback
    await page.keyboard.press('Escape')
    await page.wait_for_timeout(500)


async def _executar_headless(cookies, itens: list[ItemRequest], ai_config: dict) -> Optional[dict]:
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

        await _fechar_modal_entrega(page)
        await page.screenshot(path='debug_home.png')
        print(f'[bot] Home carregada. URL: {page.url}')

        for item in itens:
            termo = f'{item.nome} {item.marca}'.strip()
            adicionado = await _adicionar_item(page, item, termo, ai_config)
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
async def montar_carrinho(req: MontagemRequest):
    itens = req.itens
    ai_config = {'provider': req.ai_provider, 'api_key': req.ai_api_key, 'api_url': req.ai_url}
    cookies = carregar_cookies()

    if not cookies:
        if not _reauth.aberto():
            await _abrir_reauth()
            return {'status': 'reauth_needed', 'mensagem': 'Faça login na janela que abriu. Depois clique em Pedir novamente.'}
        logado = await _verificar_login_reauth()
        if not logado:
            return {'status': 'reauth_needed', 'mensagem': 'Ainda não logado. Faça login e clique em Pedir novamente.'}
        await _finalizar_reauth()
        cookies = carregar_cookies()
        if not cookies:
            return {'status': 'reauth_needed', 'mensagem': 'Erro ao salvar sessão. Tente novamente.'}

    resultado = await _executar_headless(cookies, itens, ai_config)

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
