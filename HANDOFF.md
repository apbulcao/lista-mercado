# HANDOFF — lista-mercado
**Data:** 2026-04-13
**Branch ativa:** `feat/hortisabor-bot` (worktree em `.worktrees/feat-hortisabor-bot`)
**Branch principal:** `main`

---

## O que foi feito nesta sessão

### 1. Brainstorm + spec + plano
- Spec: `docs/superpowers/specs/2026-04-13-hortisabor-bot-design.md`
- Plano: `docs/superpowers/plans/2026-04-13-hortisabor-bot.md`

### 2. Implementação (branch feat/hortisabor-bot)

| Commit | O que faz |
|--------|-----------|
| `6d21d17` | fix: localStorage polyfill para Vitest 4 + jsdom (29/29 testes) |
| `cd9d30d` | feat(bot): session.py — carregar/salvar/limpar cookies |
| `092574d` | feat(bot): bot.py — FastAPI + /status + /montar-carrinho + reauth flow |
| `95f9023` | feat(bot): descobrir_seletores.py — script de descoberta DOM |
| `05a9e3b` | feat(bot): instalar.bat + iniciar.bat (Windows) |
| `3118bf7` | feat: BarraAcoes.jsx + testes (botão condicional Hortisabor) |
| `14cb029` | feat: App.jsx — botOnline, handlePedirHortisabor, modal resultado |

**Testes:** 33/33 passando na branch.

### 3. Fix colateral
- `src/test-setup.js`: polyfill de localStorage adicionado (Vitest 4 + jsdom)
- `vite.config.js`: `environmentOptions.jsdom.url = 'http://localhost'`

---

## Estado atual — o que falta para funcionar

### Próximo passo imediato: descobrir seletores do Hortisabor

Os seletores CSS do site estão com valores placeholder em `hortisabor-bot/bot.py`:
```python
SEL_BUSCA = 'input[placeholder*="buscar" i]'
SEL_RESULTADO_ITEM = '[class*="product"]:first-child'
SEL_ADICIONAR = 'button[class*="add" i]'
SEL_QUANTIDADE = 'input[type="number"]'
```

**Para descobrir os seletores reais:**

1. Instalar deps Python (no diretório `hortisabor-bot/`):
```bash
cd .worktrees/feat-hortisabor-bot/hortisabor-bot
pip3 install -r requirements.txt
playwright install chromium
```

2. Rodar o script de descoberta (abre Chrome visível):
```bash
python3 descobrir_seletores.py
```
- Interagir no browser: fazer uma busca, abrir um produto, clicar em adicionar ao carrinho
- Pressionar Enter no terminal quando terminar
- Ler `seletores_descobertos.txt` e atualizar as constantes `SEL_*` em `bot.py`

### Depois dos seletores: testar no Mac

1. Iniciar o bot service:
```bash
cd .worktrees/feat-hortisabor-bot/hortisabor-bot
python3 -m uvicorn bot:app --host 127.0.0.1 --port 7430
```

2. Em outro terminal, iniciar o dev server:
```bash
cd .worktrees/feat-hortisabor-bot
npm run dev
```

3. Abrir `http://localhost:5173` no browser
4. Clicar em "🛒 Pedir no Hortisabor" — Chrome vai abrir para login (primeira vez)
5. Fazer login, clicar em Pedir novamente — bot deve montar o carrinho headless
6. Verificar se itens aparecem no carrinho do Hortisabor

### Depois de validado no Mac: ajustes para Windows

- Os `.bat` files já estão prontos (`instalar.bat`, `iniciar.bat`)
- Testar no computador da esposa
- Se necessário, ajustar paths ou dependências

### Finalizando a branch

Após validação:
```bash
# Merge para main
git checkout main
git merge feat/hortisabor-bot
git push origin main

# Limpar worktree
git worktree remove .worktrees/feat-hortisabor-bot
git branch -d feat/hortisabor-bot
```

---

## Arquitetura do bot (resumo rápido)

```
[lista-mercado - GitHub Pages]
    → POST http://localhost:7430/montar-carrinho
    → [FastAPI + Playwright - local]
    → [delivery.hortisabor.com.br]
```

- **Sem cookies:** bot abre Chrome visível → usuária loga → cookies salvos em `~/.config/lista-mercado/hortisabor_session.json` (Mac) ou `%APPDATA%\lista-mercado\` (Windows)
- **Com cookies:** headless, sem interação
- **Botão no app:** aparece só quando o serviço está rodando (`GET /status`)
- **WhatsApp export:** inalterado

---

## Problemas conhecidos / avisos

- O Python do sistema no Mac é 3.9 (`/usr/bin/python3`). As dependências requerem 3.11+. Verificar se há Python mais novo instalado (pyenv, homebrew) antes de instalar os requirements.
- Se `pip3 install -r requirements.txt` falhar com versão antiga, usar: `python3 -m pip install -r requirements.txt` ou instalar Python 3.11+ via `brew install python@3.11`
