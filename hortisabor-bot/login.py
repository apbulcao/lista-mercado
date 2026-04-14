"""Login programatico no Hortisabor.

Navega headless ate a pagina de login, preenche email/senha, submete.
Retorna cookies em caso de sucesso, None em caso de falha.
"""
import os

from playwright.async_api import async_playwright


URL_LOGIN = 'https://www.delivery.hortisabor.com.br/login/'

HORTISABOR_EMAIL = os.environ.get('HORTISABOR_EMAIL', '')
HORTISABOR_PASSWORD = os.environ.get('HORTISABOR_PASSWORD', '')


async def login_programatico() -> list | None:
    """Tenta login headless. Retorna lista de cookies ou None."""
    if not HORTISABOR_EMAIL or not HORTISABOR_PASSWORD:
        print('[login] HORTISABOR_EMAIL ou HORTISABOR_PASSWORD nao definidos')
        return None

    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context()
    page = await context.new_page()

    try:
        await page.goto(URL_LOGIN, wait_until='networkidle', timeout=30000)

        # Preenche formulario de login
        await page.fill('input[type="email"], input[name="email"]', HORTISABOR_EMAIL)
        await page.fill('input[type="password"], input[name="password"]', HORTISABOR_PASSWORD)
        await page.click('button[type="submit"], input[type="submit"]')

        # Espera redirecionamento (sai da /login/)
        await page.wait_for_url(lambda url: '/login/' not in url, timeout=15000)

        if '/login/' in page.url:
            print(f'[login] Falha — ainda na pagina de login: {page.url}')
            return None

        cookies = await context.cookies()
        print(f'[login] Sucesso — {len(cookies)} cookies obtidos')
        return cookies

    except Exception as e:
        print(f'[login] Erro: {e}')
        return None

    finally:
        await browser.close()
        await pw.stop()
