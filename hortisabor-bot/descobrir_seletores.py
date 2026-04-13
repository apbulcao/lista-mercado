"""
Script único de descoberta de seletores DOM do Hortisabor.
Execute uma vez: python descobrir_seletores.py
Saída: seletores_descobertos.txt

Uso: Abra o site, interaja manualmente, pressione Enter quando terminar.
Os seletores encontrados devem ser usados para atualizar as constantes SEL_*
em bot.py.
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
            f.write("=== ELEMENTOS INTERATIVOS ===\n\n")
            for el in elementos:
                f.write(str(el) + "\n")

        print("\nSalvo em seletores_descobertos.txt")
        print("Agora navegue no site: faça uma busca, abra um produto, clique em adicionar ao carrinho.")
        print("Pressione Enter quando terminar para capturar mais seletores...")
        input()

        elementos2 = await page.evaluate("""() => {
            return [...document.querySelectorAll('button, input, [class*="cart"], [class*="add"], [class*="busca"], [class*="search"]')]
                .slice(0, 40)
                .map(el => ({
                    tag: el.tagName,
                    text: el.innerText?.trim().slice(0, 60),
                    id: el.id,
                    className: el.className.slice(0, 80),
                }))
        }""")

        with open('seletores_descobertos.txt', 'a', encoding='utf-8') as f:
            f.write("\n\n=== APÓS NAVEGAÇÃO MANUAL ===\n\n")
            for el in elementos2:
                f.write(str(el) + "\n")

        await browser.close()
        print("seletores_descobertos.txt atualizado.")
        print("\nUse os seletores encontrados para atualizar SEL_* em bot.py.")


asyncio.run(main())
