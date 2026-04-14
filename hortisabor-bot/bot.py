import asyncio
from contextlib import asynccontextmanager
from typing import Optional
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright

from session import carregar_cookies, salvar_cookies, limpar_cookies


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ItemRequest(BaseModel):
    id: str = ''
    nome: str
    quantidade: str
    marca: str = ''
    detalhes: str = ''
    url_hortisabor: str = ''


class MontagemRequest(BaseModel):
    itens: list[ItemRequest]
    ai_provider: str = ''   # groq | openrouter | gemini | custom
    ai_api_key: str = ''
    ai_url: str = ''        # usado apenas com provider 'custom'


class FornecerUrlRequest(BaseModel):
    item_id: str
    url: str


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


class _MontagemState:
    def __init__(self):
        self.estado: str = 'idle'       # idle | processando | aguardando_url | concluido | erro
        self.item_atual: str = ''
        self.item_id: str = ''
        self.progresso: dict = {'feitos': 0, 'total': 0}
        self.encontrados: list = []
        self.nao_encontrados: list = []
        self._url_event = None          # asyncio.Event — criado na hora
        self._url_fornecida: str = ''

    def reset(self, total: int) -> None:
        self.estado = 'processando'
        self.item_atual = ''
        self.item_id = ''
        self.progresso = {'feitos': 0, 'total': total}
        self.encontrados = []
        self.nao_encontrados = []
        self._url_event = None
        self._url_fornecida = ''


_montagem = _MontagemState()

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
    """Extrai nomes dos produtos visíveis com botão Adicionar.

    Usa três estratégias em cascata:
    1. Heading tags (h2/h3/h4) dentro do card
    2. Elementos com 'name', 'title' ou 'product' no class
    3. Primeira linha de texto do card que não seja preço/número
    """
    await page.screenshot(path='debug_search.png')

    resultado = await page.evaluate("""() => {
        const btns = [...document.querySelectorAll('button')]
            .filter(b => b.innerText.trim() === 'Adicionar');

        // Debug: HTML do primeiro card para diagnóstico
        const card0 = btns.length > 0
            ? (btns[0].closest('[class]') || btns[0].parentElement)
                ?.outerHTML?.substring(0, 600) || ''
            : 'sem botoes Adicionar';

        const isNomeLinha = (l) => {
            if (l.length <= 4) return false;
            if (/^r\\$/i.test(l)) return false;          // preços R$
            if (/^\\d+([,.]\\d+)?\\s*(kg|g|ml|l|un)?$/i.test(l)) return false;  // pesos/qtd
            if (l.toLowerCase() === 'adicionar') return false;
            return true;
        };

        const nomes = btns.slice(0, 8).map((btn, i) => {
            let el = btn.parentElement;

            for (let j = 0; j < 10; j++) {
                if (!el) break;

                // Estratégia 1: heading tags
                for (const tag of ['h2', 'h3', 'h4', 'h5']) {
                    const h = el.querySelector(tag);
                    if (h) {
                        const txt = h.innerText.trim();
                        if (txt.length > 4) return txt.split('\\n')[0].trim();
                    }
                }

                // Estratégia 2: classe com fragmento de nome
                for (const frag of ['name', 'title', 'product', 'descri', 'label']) {
                    const found = el.querySelector(`[class*="${frag}"]`);
                    if (found && !found.contains(btn) && found !== btn) {
                        const txt = found.innerText.trim();
                        if (txt.length > 4 && txt.toLowerCase() !== 'adicionar')
                            return txt.split('\\n')[0].trim();
                    }
                }

                el = el.parentElement;
            }

            // Estratégia 3: primeira linha de texto válida subindo o DOM
            el = btn.parentElement;
            for (let j = 0; j < 8; j++) {
                if (!el) break;
                const lines = el.innerText.trim().split('\\n')
                    .map(l => l.trim())
                    .filter(isNomeLinha);
                if (lines.length >= 1) return lines[0];
                el = el.parentElement;
            }

            return `Produto ${i + 1}`;
        });

        return { card0, nomes };
    }""")

    print(f'[bot] HTML primeiro card: {resultado["card0"][:400]}')
    return resultado['nomes']


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


async def _fechar_modal_se_visivel(page) -> None:
    """Fecha qualquer modal VIP aberto que esteja bloqueando a UI."""
    try:
        modal = page.locator('.vip-modal.show').first
        if not await modal.is_visible(timeout=500):
            return
        print('[bot] Modal detectado — fechando')
        await page.keyboard.press('Escape')
        await page.wait_for_timeout(600)
        if not await modal.is_visible(timeout=400):
            return
        # Escape não funcionou: tenta botão de fechar dentro do modal
        for sel in ['button[aria-label*="echar"]', 'button[aria-label*="lose"]',
                    '[class*="close"]', '[class*="fechar"]']:
            btn = page.locator(f'.vip-modal {sel}').first
            if await btn.is_visible(timeout=300):
                await btn.click()
                await page.wait_for_timeout(500)
                return
    except Exception:
        pass


async def _js_preencher_quantidade(page, quantidade: str) -> bool:
    """Preenche input de quantidade via JS com eventos React-compatíveis.

    O React intercepta o setter nativo do <input> — por isso não basta
    setar input.value diretamente. É preciso usar o setter original do
    protótipo antes de disparar os eventos sintéticos.
    """
    return await page.evaluate(f"""() => {{
        const input = document.querySelector('{SEL_QUANTIDADE}');
        if (!input) return false;
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        ).set;
        setter.call(input, '{quantidade}');
        input.dispatchEvent(new Event('input',  {{bubbles: true}}));
        input.dispatchEvent(new Event('change', {{bubbles: true}}));
        return true;
    }}""")


async def _js_clicar_adicionar(page) -> bool:
    """Clica no botão de adicionar ao carrinho via JS.

    Usa innerText (visível ao usuário) em vez de textContent (inclui nós ocultos).
    Tenta correspondência em cascata para cobrir variações do site:
      1. Texto exato 'Adicionar' (resultados de busca)
      2. Contém 'adicionar ao carrinho' (página de produto)
      3. Começa com 'adicionar' (qualquer variação futura)
    """
    return await page.evaluate("""() => {
        const btns = [...document.querySelectorAll('button')];
        const btn = btns.find(b => b.innerText.trim() === 'Adicionar')
                 || btns.find(b => b.innerText.toLowerCase().includes('adicionar ao carrinho'))
                 || btns.find(b => b.innerText.toLowerCase().startsWith('adicionar'));
        if (!btn) return false;
        btn.click();
        return true;
    }""")


async def _incrementar_quantidade_spinner(page, quantidade: str) -> bool:
    """Tenta ajustar quantidade via spinner na página atual (funciona em listagens).

    Retorna False se o spinner não aparecer — nesse caso usar _ajustar_qtd_no_carrinho.
    """
    try:
        qty = int(quantidade)
    except (ValueError, TypeError):
        return True
    if qty <= 1:
        return True

    # Aguarda spinner aparecer — timeout curto porque em página de produto ele não existe
    try:
        await page.locator(SEL_QUANTIDADE).first.wait_for(state='visible', timeout=2000)
    except Exception:
        print(f'[bot] Spinner não apareceu na página de produto — tentando carrinho')
        return False

    incrementos = qty - 1
    for i in range(incrementos):
        clicou = await page.evaluate(f"""() => {{
            const input = document.querySelector('{SEL_QUANTIDADE}');
            if (!input) return false;
            const container = input.closest('[class*="spin"]') || input.parentElement;
            if (!container) return false;
            const btns = [...container.querySelectorAll('button')];
            const plus = btns.find(b => b.innerText.trim() === '+')
                      || btns.find(b => /increment|plus|mais/i.test(b.className + (b.getAttribute('aria-label') || '')))
                      || btns[btns.length - 1];
            if (!plus) return false;
            plus.click();
            return true;
        }}""")
        if not clicou:
            print(f'[bot] Botão + não encontrado (iteração {i + 1}/{incrementos})')
            break
        await page.wait_for_timeout(300)

    valor_final = await page.evaluate(f"() => document.querySelector('{SEL_QUANTIDADE}')?.value")
    print(f'[bot] Spinner: esperado={quantidade} final={valor_final} {"✓" if str(valor_final) == str(quantidade) else "✗ diverge"}')
    return True


async def _ajustar_qtd_no_carrinho(page, quantidade: str, nome_item: str) -> bool:
    """Fallback: navega ao carrinho e ajusta a quantidade do item recém-adicionado.

    Usa o último spinner visível no carrinho (item mais recente fica no final da lista).
    """
    try:
        qty = int(quantidade)
    except (ValueError, TypeError):
        return True
    if qty <= 1:
        return True

    print(f'[bot] Carrinho: ajustando "{nome_item}" → qty={qty}')
    await page.goto(URL_CARRINHO, wait_until='domcontentloaded', timeout=15000)
    await _fechar_modal_se_visivel(page)

    # Encontra spinners de quantidade — tenta seletores em cascata
    sel_usado = None
    for sel in ['input.vip-spin__quantity', 'input[class*="spin"]', 'input[class*="quant"]', 'input[type="number"]']:
        n = await page.locator(sel).count()
        if n > 0:
            sel_usado = sel
            print(f'[bot] Carrinho: {n} spinner(s) via "{sel}"')
            break

    if not sel_usado:
        # Debug: loga todos os inputs para diagnóstico
        inputs_info = await page.evaluate("""() =>
            [...document.querySelectorAll('input')].slice(0, 10).map(inp => ({
                type: inp.type, cls: inp.className.substring(0, 50), val: inp.value
            }))
        """)
        print(f'[bot] Carrinho: nenhum spinner — inputs disponíveis: {inputs_info}')
        return False

    # Usa o último spinner — item mais recentemente adicionado
    spinner = page.locator(sel_usado).last
    valor_atual = int(await spinner.input_value() or '1')
    incrementos = qty - valor_atual

    if incrementos <= 0:
        print(f'[bot] Carrinho: "{nome_item}" já com qty={valor_atual}')
        return True

    for i in range(incrementos):
        clicou = await page.evaluate(f"""() => {{
            const all = [...document.querySelectorAll('{sel_usado}')];
            const input = all[all.length - 1];
            if (!input) return false;
            const container = input.closest('[class*="spin"]') || input.parentElement;
            if (!container) return false;
            const btns = [...container.querySelectorAll('button')];
            const plus = btns.find(b => b.innerText.trim() === '+')
                      || btns.find(b => /increment|plus|mais/i.test(b.className + (b.getAttribute('aria-label') || '')))
                      || btns[btns.length - 1];
            if (!plus) return false;
            plus.click();
            return true;
        }}""")
        if not clicou:
            print(f'[bot] Carrinho: botão + não encontrado ({i + 1}/{incrementos})')
            break
        await page.wait_for_timeout(400)

    valor_final = await spinner.input_value()
    ok = valor_final == str(qty)
    print(f'[bot] Carrinho: "{nome_item}" esperado={qty} final={valor_final} {"✓" if ok else "✗ diverge"}')
    return ok


async def _adicionar_item(page, item: ItemRequest, termo: str, ai_config: dict) -> bool:
    """Busca um item e adiciona ao carrinho. Retorna True se encontrado."""
    try:
        await _fechar_modal_se_visivel(page)

        # Navegação direta se URL do produto for conhecida.
        # IA não é usada neste caminho: a URL já identifica o produto exato.
        if item.url_hortisabor:
            print(f'[bot] URL direta: {item.url_hortisabor}')
            await page.goto(item.url_hortisabor, wait_until='domcontentloaded', timeout=15000)
            # Espera o botão Adicionar renderizar (mais confiável que networkidle)
            try:
                await page.locator('button', has_text='Adicionar').first.wait_for(
                    state='visible', timeout=10000)
            except Exception:
                pass
            await _fechar_modal_se_visivel(page)

            n_btns = await page.locator('button', has_text='Adicionar').count()
            print(f'[bot] Botões "Adicionar" encontrados: {n_btns}')
            slug = item.url_hortisabor.rstrip('/').split('/')[-1][:40]
            await page.screenshot(path=f'debug_{slug}_antes.png')

            if n_btns == 0:
                print(f'[bot] AVISO: nenhum botão Adicionar — produto indisponível?')
                return False

            clicou = await _js_clicar_adicionar(page)
            print(f'[bot] Clique "Adicionar": {"ok" if clicou else "FALHOU"}')
            if not clicou:
                return False

            # O site exige seleção de entrega/loja antes de confirmar a adição.
            # Sem confirmar, o item NÃO entra no carrinho.
            # Usa Playwright locators (clique real) em vez de JS evaluate
            # porque element.click() não dispara handlers React do site.
            await page.wait_for_timeout(1500)
            confirmou = await _confirmar_modal_entrega(page)
            if confirmou:
                print(f'[bot] Modal de entrega: {confirmou}')
            else:
                await page.screenshot(path=f'debug_{slug}_modal_falhou.png')
                print('[bot] AVISO: modal de entrega não confirmado')

            await page.screenshot(path=f'debug_{slug}_depois.png')

            # Navega de volta ao home
            await page.goto(URL_HOME, wait_until='domcontentloaded', timeout=15000)
            await _fechar_modal_se_visivel(page)
            return True

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

        # IA escolhe o produto certo entre os resultados da busca
        nomes = await _extrair_nomes_produtos(page)
        print(f'[bot] Produtos para "{termo}": {nomes}')
        idx = await _escolher_produto_ia(nomes, termo, **ai_config)

        if idx is None:
            print(f'[bot] IA descartou: {termo}')
            return False

        btn_escolhido = todos_btns.nth(idx)

        # Quantidade: usa nth(idx) para acertar o produto escolhido pela IA
        if item.quantidade and item.quantidade not in ('', '1'):
            qtd_input = page.locator(SEL_QUANTIDADE).nth(idx)
            if await qtd_input.is_visible():
                await qtd_input.fill(item.quantidade)

        await btn_escolhido.click()
        await page.wait_for_timeout(1500)
        await _fechar_modal_se_visivel(page)
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


async def _confirmar_modal_entrega(page) -> Optional[str]:
    """Confirma seleção de entrega/loja no modal pós-Adicionar.

    Usa Playwright locators (simula clique real do mouse) porque
    JS evaluate element.click() não dispara handlers React do site.

    Estratégia em cascata:
    1. Clica na primeira loja Hortisabor (opção mais simples — 1 clique)
    2. Tenta botões comuns (Retirar, Confirmar)
    3. Se nada funcionar, loga diagnóstico
    """
    # 1. Tenta clicar na primeira loja pelo endereço
    for texto_loja in ['Tabapuã', 'Luis Ju']:
        try:
            el = page.get_by_text(texto_loja, exact=False).first
            if await el.is_visible(timeout=800):
                await el.click()
                await page.wait_for_timeout(1500)
                return f'loja:{texto_loja}'
        except Exception:
            continue

    # 2. Tenta botões com texto relevante
    for texto_btn in ['Retirar', 'Confirmar', 'Selecionar', 'Continuar']:
        try:
            btn = page.locator('button', has_text=texto_btn).first
            if await btn.is_visible(timeout=500):
                await btn.click()
                await page.wait_for_timeout(1500)
                return f'botao:{texto_btn}'
        except Exception:
            continue

    # 3. Tenta clicar em qualquer elemento com "Hortisabor" (card genérico)
    try:
        el = page.get_by_text('Hortisabor', exact=False).first
        if await el.is_visible(timeout=500):
            await el.click()
            await page.wait_for_timeout(1500)
            return 'loja:hortisabor'
    except Exception:
        pass

    # 4. Diagnóstico: loga elementos clicáveis visíveis no modal
    diag = await page.evaluate("""() => {
        const els = [...document.querySelectorAll('button, a, [role="button"]')]
            .filter(el => el.offsetParent !== null)
            .slice(0, 15)
            .map(el => el.tagName + ': ' + (el.innerText||'').trim().substring(0, 50));
        return els;
    }""")
    print(f'[bot] Modal diagnóstico — elementos clicáveis: {diag}')
    return None


async def _ajustar_quantidades_no_carrinho(page, itens: list[ItemRequest]) -> dict:
    """Navega ao carrinho e ajusta quantidades de itens que precisam qty > 1.

    Estratégia:
    1. Encontra todos os itens no carrinho (nome + controles de qty)
    2. Para cada item da lista com qty > 1, faz match por nome
    3. Clica "+" até chegar na quantidade desejada
    4. Retorna dict com resultados por item

    Retorna: {'ajustados': [...], 'nao_encontrados': [...]}
    """
    # Filtra itens que precisam de ajuste (qty > 1)
    itens_para_ajustar = []
    for item in itens:
        try:
            qty = int(item.quantidade) if item.quantidade else 1
        except (ValueError, TypeError):
            qty = 1
        if qty > 1:
            itens_para_ajustar.append((item, qty))

    if not itens_para_ajustar:
        print('[bot] Carrinho: nenhum item precisa de ajuste de quantidade')
        return {'ajustados': [], 'nao_encontrados': []}

    print(f'[bot] Carrinho: {len(itens_para_ajustar)} item(ns) precisam ajuste de qty')
    await page.goto(URL_CARRINHO, wait_until='domcontentloaded', timeout=15000)
    await page.wait_for_timeout(2000)  # Aguarda renderização dos itens do carrinho
    await _fechar_modal_se_visivel(page)
    await page.screenshot(path='debug_carrinho_antes.png')

    # Diagnóstico: mapeia itens visíveis no carrinho e seus controles
    cart_info = await page.evaluate("""() => {
        // Estratégia em cascata para encontrar "linhas" do carrinho
        // Cada site organiza de forma diferente — tenta padrões comuns
        // NB: NÃO usar [class*="carrinho"] > div — pega divs estruturais
        // (ex: título "Carrinho") que bypassam o filtro hasPlus
        const rows = document.querySelectorAll(
            '[class*="cart-item"], [class*="cart_item"], '
          + '[class*="product-item"], [class*="item-cart"], tr[class*="item"]'
        );

        // Se seletores de classe não funcionam, tenta por estrutura:
        // procura elementos que contêm TANTO texto de produto QUANTO botões +/-
        let items = [];
        const candidates = rows.length > 0
            ? [...rows]
            : [...document.querySelectorAll('div, li, tr')].filter(el => {
                const text = el.innerText || '';
                const hasPlus = el.querySelector('button')
                    && [...el.querySelectorAll('button')].some(b =>
                        b.innerText.trim() === '+' || b.textContent.trim() === '+');
                const hasProductText = text.length > 20 && text.length < 500;
                return hasPlus && hasProductText;
              });

        for (const row of candidates) {
            // Extrai nome do produto
            const nameEl = row.querySelector('h2, h3, h4, h5, [class*="name"], [class*="title"], [class*="descri"], a[href*="/"]');
            const name = nameEl
                ? nameEl.innerText.trim().split('\\n')[0].trim()
                : row.innerText.trim().split('\\n')[0].trim();

            // Extrai quantidade atual
            const qtyInput = row.querySelector('input[type="number"], input[class*="quant"], input[class*="spin"]');
            const qtyText = row.querySelector('[class*="quant"], [class*="qty"]');
            const currentQty = qtyInput
                ? qtyInput.value
                : (qtyText ? qtyText.innerText.trim() : '?');

            // Verifica se tem botão +
            const btns = [...row.querySelectorAll('button')];
            const hasPlus = btns.some(b => b.innerText.trim() === '+' || b.textContent.trim() === '+');

            if (name && name.length > 3) {
                items.push({ name: name.substring(0, 80), currentQty, hasPlus, hasInput: !!qtyInput });
            }
        }

        // Fallback: se nada funcionou, retorna HTML parcial para diagnóstico
        if (items.length === 0) {
            const main = document.querySelector('main, [class*="content"], [class*="cart"]');
            return {
                items: [],
                debug_html: (main || document.body).innerHTML.substring(0, 2000),
                all_buttons: [...document.querySelectorAll('button')].slice(0, 20).map(b => ({
                    text: b.innerText.trim().substring(0, 30),
                    cls: b.className.substring(0, 40)
                })),
                all_inputs: [...document.querySelectorAll('input')].slice(0, 15).map(inp => ({
                    type: inp.type, cls: inp.className.substring(0, 40), val: inp.value
                }))
            };
        }

        return { items, debug_html: null, all_buttons: null, all_inputs: null };
    }""")

    print(f'[bot] Carrinho: {len(cart_info.get("items", []))} item(ns) encontrados')
    for ci in cart_info.get('items', []):
        print(f'  - "{ci["name"]}" qty={ci["currentQty"]} plus={ci["hasPlus"]} input={ci["hasInput"]}')

    if not cart_info.get('items'):
        print(f'[bot] Carrinho: DIAGNÓSTICO — nenhum item detectado')
        if cart_info.get('all_buttons'):
            print(f'[bot]   Botões: {cart_info["all_buttons"][:10]}')
        if cart_info.get('all_inputs'):
            print(f'[bot]   Inputs: {cart_info["all_inputs"][:10]}')
        if cart_info.get('debug_html'):
            print(f'[bot]   HTML (trecho): {cart_info["debug_html"][:500]}')
        await page.screenshot(path='debug_carrinho_diagnostico.png')
        return {'ajustados': [], 'nao_encontrados': [i.nome for i, _ in itens_para_ajustar]}

    # Match e ajuste de quantidades
    ajustados = []
    nao_encontrados = []

    for item, target_qty in itens_para_ajustar:
        # Match por nome: slug da URL vs nome no carrinho (case-insensitive, parcial)
        slug_parts = item.url_hortisabor.rstrip('/').split('/')[-1].replace('-', ' ').lower().split() if item.url_hortisabor else []
        nome_parts = item.nome.lower().split()
        raw_terms = slug_parts if slug_parts else nome_parts
        search_terms = [t for t in raw_terms if len(t) >= 4]

        matched_idx = None
        best_score = 0
        for idx, ci in enumerate(cart_info['items']):
            cart_name_lower = ci['name'].lower()
            score = sum(1 for term in search_terms if term in cart_name_lower)
            if score > best_score:
                best_score = score
                matched_idx = idx

        if matched_idx is None or best_score < 2:
            print(f'[bot] Carrinho: "{item.nome}" não encontrado (melhor score={best_score})')
            nao_encontrados.append(item.nome)
            continue

        ci = cart_info['items'][matched_idx]
        print(f'[bot] Carrinho: "{item.nome}" → match "{ci["name"]}" (score={best_score})')

        try:
            current = int(ci['currentQty'])
        except (ValueError, TypeError):
            current = 1

        clicks_needed = target_qty - current
        if clicks_needed <= 0:
            print(f'[bot] Carrinho: "{item.nome}" já com qty={current} (target={target_qty})')
            ajustados.append(item.nome)
            continue

        # Clica "+" o número necessário de vezes
        # Usa o índice do item no carrinho para achar o botão certo
        for click_i in range(min(clicks_needed, 20)):
            clicou = await page.evaluate("""(idx) => {
                // Re-scan os itens do carrinho para pegar o estado atual
                const candidates = [...document.querySelectorAll('div, li, tr')].filter(el => {
                    const text = el.innerText || '';
                    const hasPlus = el.querySelector('button')
                        && [...el.querySelectorAll('button')].some(b =>
                            b.innerText.trim() === '+' || b.textContent.trim() === '+');
                    const hasProductText = text.length > 20 && text.length < 500;
                    return hasPlus && hasProductText;
                });

                if (idx >= candidates.length) return false;
                const row = candidates[idx];
                const btns = [...row.querySelectorAll('button')];
                const plus = btns.find(b => b.innerText.trim() === '+')
                          || btns.find(b => b.textContent.trim() === '+');
                if (!plus) return false;
                plus.click();
                return true;
            }""", matched_idx)

            if not clicou:
                print(f'[bot] Carrinho: "+" não encontrado para "{item.nome}" (click {click_i + 1}/{clicks_needed})')
                break
            await page.wait_for_timeout(500)

        ajustados.append(item.nome)
        print(f'[bot] Carrinho: "{item.nome}" ajustado → target={target_qty}')

    await page.screenshot(path='debug_carrinho_depois.png')
    return {'ajustados': ajustados, 'nao_encontrados': nao_encontrados}


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

        # Ajusta quantidades no carrinho (itens com qty > 1)
        itens_adicionados = [item for item in itens if item.nome in encontrados]
        if itens_adicionados:
            resultado_cart = await _ajustar_quantidades_no_carrinho(page, itens_adicionados)
            print(f'[bot] Carrinho: ajustados={resultado_cart["ajustados"]} nao_encontrados={resultado_cart["nao_encontrados"]}')

        return {'encontrados': encontrados, 'nao_encontrados': nao_encontrados}

    except Exception as e:
        print(f'[bot] Erro na automação: {e}')
        remaining = [i.nome for i in itens if i.nome not in encontrados]
        return {'encontrados': encontrados, 'nao_encontrados': nao_encontrados + remaining}

    finally:
        await browser.close()
        await pw.stop()


async def _processar_montagem(itens: list[ItemRequest], cookies: list, ai_config: dict) -> None:
    """Processa itens em background; pausa com asyncio.Event quando precisa de URL."""
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context()
    await context.add_cookies(cookies)
    page = await context.new_page()

    try:
        await page.goto(URL_HOME, wait_until='networkidle', timeout=30000)

        if '/login/' in page.url:
            _montagem.estado = 'erro'
            return

        await _fechar_modal_entrega(page)

        for item in itens:
            _montagem.estado = 'processando'
            _montagem.item_atual = item.nome
            _montagem.item_id = item.id

            url = item.url_hortisabor
            if not url:
                _montagem.estado = 'aguardando_url'
                _montagem._url_event = asyncio.Event()
                await _montagem._url_event.wait()
                url = _montagem._url_fornecida

            item_com_url = ItemRequest(
                id=item.id,
                nome=item.nome,
                quantidade=item.quantidade,
                marca=item.marca,
                detalhes=item.detalhes,
                url_hortisabor=url,
            )
            termo = f'{item.nome} {item.marca}'.strip()
            adicionado = await _adicionar_item(page, item_com_url, termo, ai_config)

            if adicionado:
                _montagem.encontrados.append(item.nome)
            else:
                _montagem.nao_encontrados.append(item.nome)

            _montagem.progresso['feitos'] += 1

        # Ajusta quantidades no carrinho
        itens_adicionados = [item for item in itens if item.nome in _montagem.encontrados]
        if itens_adicionados:
            resultado_cart = await _ajustar_quantidades_no_carrinho(page, itens_adicionados)
            print(f'[bot] Carrinho: ajustados={resultado_cart["ajustados"]}')

        _montagem.estado = 'concluido'

    except Exception as e:
        print(f'[bot] Erro na montagem: {e}')
        restantes = [i.nome for i in itens if i.nome not in _montagem.encontrados]
        _montagem.nao_encontrados.extend(restantes)
        _montagem.estado = 'erro'

    finally:
        await browser.close()
        await pw.stop()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get('/status')
async def status():
    return {
        'ok': True,
        'montagem': {
            'estado': _montagem.estado,
            'item_atual': _montagem.item_atual,
            'item_id': _montagem.item_id,
            'progresso': _montagem.progresso,
            'encontrados': _montagem.encontrados,
            'nao_encontrados': _montagem.nao_encontrados,
        },
    }


@app.post('/fornecer-url')
async def fornecer_url(req: FornecerUrlRequest):
    if _montagem.estado != 'aguardando_url':
        raise HTTPException(status_code=400, detail='Bot não está aguardando URL')
    _montagem._url_fornecida = req.url
    if _montagem._url_event:
        _montagem._url_event.set()
    return {'status': 'ok'}


@app.post('/iniciar-montagem')
async def iniciar_montagem(req: MontagemRequest):
    if _montagem.estado in ('processando', 'aguardando_url'):
        raise HTTPException(status_code=409, detail='Montagem já em andamento')

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

    ai_config = {'provider': req.ai_provider, 'api_key': req.ai_api_key, 'api_url': req.ai_url}
    _montagem.reset(total=len(req.itens))
    asyncio.create_task(_processar_montagem(req.itens, cookies, ai_config))

    return {'status': 'iniciado'}
