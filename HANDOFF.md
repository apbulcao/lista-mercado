# HANDOFF — lista-mercado
**Data:** 2026-04-13
**Branch:** `main` (feature branch `feat/hortisabor-bot` já mergeada e limpa)

---

## O que foi feito nesta sessão

### Bugs corrigidos

| Commit | Fix |
|--------|-----|
| `f714dbf` | `vite.config.js` `base: '/'` → `'/lista-mercado/'` — site em branco no GitHub Pages |
| `81b3518` | Polling do status do bot a cada 5s (antes: check único no mount) |
| `f38a90e` | Fluxo de reauth nunca salvava cookies — bug de lógica no endpoint |
| `1cbbd17` | `_ReauthState.aberto()` detecta browser fechado externamente |

### Features implementadas

| Commit | Feature |
|--------|---------|
| `53b938d` | Merge do feat/hortisabor-bot: bot completo, BarraAcoes, App.jsx |
| `3c09495` | Seletores reais do Hortisabor + iniciar.command |
| `380f3dc` | Seleção inteligente de produto via IA (Groq/Gemini/OpenRouter) |

---

## Estado atual

### O que está funcionando
- Site no ar: `https://apbulcao.github.io/lista-mercado/`
- Botão "Pedir no Hortisabor" aparece quando `iniciar.command` está rodando
- Login via Chrome visível na primeira vez; cookies salvos em `~/lista-mercado/hortisabor_session.json`
- Seleção de produto via IA: extrai nomes dos resultados, pergunta ao Groq/Gemini qual corresponde
- Fallback para primeiro resultado se IA não configurada

### Pendente / Pode precisar de ajuste

**1. Modal de seleção de endereço**
O site mostra um modal perguntando "aonde quer entregar" ao carregar a página.
A função `_fechar_modal_entrega` tenta fechar automaticamente com candidatos:
`['Confirmar', 'Entrega', 'Retirar', 'OK', 'Fechar', 'Continuar']`
Pode ser que o texto exato do botão não esteja nessa lista. O usuário fechou manualmente uma vez e funcionou. Se continuar precisando fechar manualmente:
- Abrir `bot.py` headless=False temporariamente (linha no `_executar_headless`)
- Ver qual botão o modal tem
- Adicionar o texto exato em `_fechar_modal_entrega`

**2. Qualidade da seleção via IA**
Não foi possível confirmar em produção se a IA está escolhendo o produto certo.
O log do uvicorn deve mostrar:
```
[bot] Produtos para "leite integral Parmalat": ['Leite Integral Parmalat 1L', ...]
[bot] IA escolheu "1" para: leite integral Parmalat
```
Se a IA estiver escolhendo errado, revisar o prompt em `_escolher_produto_ia` em `bot.py`.

**3. Extração de nomes dos produtos**
`_extrair_nomes_produtos` usa JS para subir pelo DOM a partir do botão "Adicionar".
Se retornar nomes vazios ou genéricos ("Produto 1"), o seletor pode precisar de ajuste.
Ver log: `[bot] Produtos para "X": [...]`

---

## Arquitetura atual do bot

```
[GitHub Pages - App React]
    → POST http://localhost:7430/montar-carrinho
      { itens: [...], ai_provider: "groq", ai_api_key: "...", ai_url: "" }
    → [FastAPI + Playwright - local Mac]
        1. Carregar cookies de ~/lista-mercado/hortisabor_session.json
        2. Abrir browser headless com cookies
        3. Navegar para delivery.hortisabor.com.br
        4. Fechar modal de endereço se aparecer
        5. Para cada item: buscar → IA escolhe produto → clicar Adicionar
    → Retorna { status: "ok", encontrados: [...], nao_encontrados: [...] }
```

**Arquivos-chave do bot:**
- `hortisabor-bot/bot.py` — lógica principal, seletores, IA
- `hortisabor-bot/session.py` — persistência de cookies
- `hortisabor-bot/iniciar.command` — entry point Mac (duplo clique)

**Seletores DOM (descobertos em 2026-04-13):**
```python
SEL_BUSCA = '#search-term'
SEL_QUANTIDADE = 'input.vip-spin__quantity'
# botão adicionar: page.locator('button', has_text='Adicionar')
```

---

## Para rodar localmente

```bash
# Subir o bot
cd hortisabor-bot/
/opt/homebrew/bin/python3.11 -m uvicorn bot:app --host 127.0.0.1 --port 7430
# ou: duplo clique em iniciar.command
```

Python 3.11 em `/opt/homebrew/bin/python3.11`. Dependências já instaladas.
Cookies em `~/lista-mercado/hortisabor_session.json` (7 cookies, válidos).

---

## Próximos passos sugeridos

1. Confirmar que modal fecha automaticamente (ou fixar o seletor)
2. Verificar logs de seleção da IA em uma compra real
3. Testar no Windows (instalar.bat + iniciar.bat já prontos)
4. Considerar: limpar cookies e forçar novo login se seleção de produtos estiver errada (pode ser que cookies de sessão antiga não tenham endereço de entrega selecionado)
