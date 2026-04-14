# Bot Hortisabor no Hetzner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover o bot Hortisabor de localhost para o servidor Hetzner com HTTPS, eliminando a necessidade de instalar qualquer software no PC da Analu.

**Architecture:** Bot (FastAPI + Playwright) roda no Hetzner como systemd service. Caddy faz reverse proxy com HTTPS automatico via DuckDNS. Web app (GitHub Pages) conecta na URL configuravel com Bearer token.

**Tech Stack:** Python/FastAPI/Playwright (bot), Caddy (reverse proxy), DuckDNS (DNS gratuito), Let's Encrypt (HTTPS), systemd (service)

**Spec:** `docs/superpowers/specs/2026-04-14-bot-hetzner-deploy-design.md`

---

## File Structure

### Modified files
- `src/components/ConfigToken.jsx` — add getBotUrl(), getBotApiKey(), UI fields for bot settings
- `src/App.jsx` — replace hardcoded localhost:7430 with getBotUrl(), add auth headers
- `hortisabor-bot/bot.py` — add API key middleware, login programatico, remove reauth visual
- `hortisabor-bot/session.py` — cross-platform cookie path (Windows + Linux)

### New files
- `hortisabor-bot/auth.py` — API key middleware (small, focused)
- `hortisabor-bot/login.py` — login programatico do Hortisabor
- `src/lib/botApi.js` — helper para fetch com URL configuravel + auth header

### Server files (created on Hetzner via SSH)
- `/etc/caddy/Caddyfile` — reverse proxy config
- `/etc/systemd/system/hortisabor-bot.service` — systemd service
- `/root/.hortisabor-bot/.env` — credenciais

---

## Task 1: Web App — Helper de fetch para o bot

**Files:**
- Create: `src/lib/botApi.js`
- Modify: `src/components/ConfigToken.jsx:1-13`

- [ ] **Step 1: Create botApi.js with getBotUrl, getBotApiKey, botFetch**

Create `src/lib/botApi.js`:

```javascript
const STORAGE_KEY_BOT_URL = 'lista-mercado-bot-url'
const STORAGE_KEY_BOT_API_KEY = 'lista-mercado-bot-api-key'

export function getBotUrl() {
  return localStorage.getItem(STORAGE_KEY_BOT_URL) || 'http://localhost:7430'
}

export function getBotApiKey() {
  return localStorage.getItem(STORAGE_KEY_BOT_API_KEY) || ''
}

export function setBotUrl(url) {
  localStorage.setItem(STORAGE_KEY_BOT_URL, url)
}

export function setBotApiKey(key) {
  localStorage.setItem(STORAGE_KEY_BOT_API_KEY, key)
}

/**
 * Fetch wrapper that prepends bot URL and adds auth header.
 * Usage: botFetch('/status') or botFetch('/iniciar-montagem', { method: 'POST', ... })
 */
export function botFetch(path, options = {}) {
  const url = getBotUrl() + path
  const apiKey = getBotApiKey()
  if (apiKey) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${apiKey}`,
    }
  }
  return fetch(url, options)
}
```

- [ ] **Step 2: Run dev server to verify no syntax errors**

Run: `npm run dev` — verify it starts without errors. Stop it after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/lib/botApi.js
git commit -m "feat: add botApi helper with configurable URL and auth"
```

---

## Task 2: Web App — Replace hardcoded localhost in App.jsx

**Files:**
- Modify: `src/App.jsx:16,80-84,341,371,402,415`

- [ ] **Step 1: Add botFetch import to App.jsx**

In `src/App.jsx`, add to the imports (after line 16):

```javascript
import { botFetch } from './lib/botApi'
```

- [ ] **Step 2: Replace all 5 occurrences of hardcoded fetch**

Replace line 82:
```javascript
// Old:
fetch('http://localhost:7430/status')
// New:
botFetch('/status')
```

Replace line 341:
```javascript
// Old:
const res = await fetch('http://localhost:7430/iniciar-montagem', {
// New:
const res = await botFetch('/iniciar-montagem', {
```

Replace line 371:
```javascript
// Old:
const statusRes = await fetch('http://localhost:7430/status')
// New:
const statusRes = await botFetch('/status')
```

Replace line 402:
```javascript
// Old:
await fetch('http://localhost:7430/fornecer-url', {
// New:
await botFetch('/fornecer-url', {
```

Replace line 415:
```javascript
// Old:
await fetch('http://localhost:7430/fornecer-url', {
// New:
await botFetch('/fornecer-url', {
```

- [ ] **Step 3: Verify no remaining hardcoded localhost:7430**

Run: `grep -r "localhost:7430" src/` — should return no results.

- [ ] **Step 4: Run dev server and verify bot polling works (should show bot offline)**

Run: `npm run dev` — open in browser. The bot status should show offline (as before when no bot is running). Check browser console for no errors on the fetch calls.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "refactor: use botFetch helper instead of hardcoded localhost"
```

---

## Task 3: Web App — Setup hash params + ConfigToken UI

**Files:**
- Modify: `src/App.jsx:59-76` (setup hash parsing)
- Modify: `src/components/ConfigToken.jsx` (add bot URL + API key fields)

- [ ] **Step 1: Add botUrl and botApiKey to setup hash parsing in App.jsx**

In `src/App.jsx`, in the `useEffect` that parses the hash (around line 59-76), add after the groq block:

```javascript
const botUrl = params.get('botUrl')
const botApiKey = params.get('botApiKey')
if (botUrl) localStorage.setItem('lista-mercado-bot-url', botUrl)
if (botApiKey) localStorage.setItem('lista-mercado-bot-api-key', botApiKey)
```

- [ ] **Step 2: Add bot fields to ConfigToken.jsx**

Add imports at top of `src/components/ConfigToken.jsx`:

```javascript
import { getBotUrl, getBotApiKey, setBotUrl, setBotApiKey } from '../lib/botApi'
```

Add state in the component (after the existing useState declarations):

```javascript
const [botUrl, setBotUrlLocal] = useState(() => getBotUrl())
const [botApiKeyLocal, setBotApiKeyLocal] = useState(() => getBotApiKey())
```

Add to `handleSalvar`:

```javascript
setBotUrl(botUrl)
setBotApiKey(botApiKeyLocal)
```

Add a new section in the JSX after the "Smart Input (IA)" section:

```jsx
<div className="pt-3 border-t border-gray-100">
  <h4 className="text-sm font-bold text-[#2D6A4F] mb-3">Bot Hortisabor</h4>
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">URL do Bot</label>
      <input type="text" value={botUrl} onChange={e => setBotUrlLocal(e.target.value)} placeholder="http://localhost:7430" className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors duration-200" style={{ border: '1px solid #E5DDD0', backgroundColor: '#F2EDE4', color: '#1C1A16' }} />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">API Key do Bot</label>
      <input type="password" value={botApiKeyLocal} onChange={e => setBotApiKeyLocal(e.target.value)} placeholder="Chave de acesso" className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors duration-200" style={{ border: '1px solid #E5DDD0', backgroundColor: '#F2EDE4', color: '#1C1A16' }} />
    </div>
  </div>
</div>
```

- [ ] **Step 3: Test setup hash in browser**

Run: `npm run dev`
Open: `http://localhost:5173/lista-mercado/#setup&botUrl=https://test.example.com&botApiKey=abc123`
Verify: open browser console, run `localStorage.getItem('lista-mercado-bot-url')` — should return `https://test.example.com`.
Verify: open Settings modal — bot fields should show the saved values.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/ConfigToken.jsx
git commit -m "feat: bot URL and API key configurable via settings and setup hash"
```

---

## Task 4: Bot — Cross-platform cookie path

**Files:**
- Modify: `hortisabor-bot/session.py`

- [ ] **Step 1: Update session.py for cross-platform path**

Replace the entire `COOKIES_PATH` line in `hortisabor-bot/session.py`:

```python
import json
import os
import platform
from pathlib import Path


def _default_data_dir() -> Path:
    env = os.environ.get('HORTISABOR_DATA_DIR')
    if env:
        return Path(env)
    if platform.system() == 'Windows':
        return Path(os.environ.get('APPDATA', Path.home())) / 'lista-mercado'
    return Path.home() / '.hortisabor-bot'


COOKIES_PATH = _default_data_dir() / 'hortisabor_session.json'


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

- [ ] **Step 2: Commit**

```bash
git add hortisabor-bot/session.py
git commit -m "fix: cross-platform cookie path (Windows + Linux)"
```

---

## Task 5: Bot — API key middleware

**Files:**
- Create: `hortisabor-bot/auth.py`
- Modify: `hortisabor-bot/bot.py:102-113`

- [ ] **Step 1: Create auth.py**

Create `hortisabor-bot/auth.py`:

```python
import os

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

BOT_API_KEY = os.environ.get('BOT_API_KEY', '')


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Validates Bearer token on all endpoints except /health.
    Disabled when BOT_API_KEY env var is empty (local dev)."""

    async def dispatch(self, request: Request, call_next):
        if not BOT_API_KEY:
            return await call_next(request)
        if request.url.path == '/health':
            return await call_next(request)
        if request.method == 'OPTIONS':
            return await call_next(request)

        auth = request.headers.get('Authorization', '')
        if auth != f'Bearer {BOT_API_KEY}':
            return JSONResponse(status_code=401, content={'detail': 'Unauthorized'})
        return await call_next(request)
```

- [ ] **Step 2: Wire middleware into bot.py**

In `hortisabor-bot/bot.py`, add import after the existing imports:

```python
from auth import ApiKeyMiddleware
```

Add after the CORSMiddleware block (after line 113):

```python
app.add_middleware(ApiKeyMiddleware)
```

Add a health endpoint at the end of the file (before the last endpoint):

```python
@app.get('/health')
async def health():
    return {'ok': True}
```

- [ ] **Step 3: Test locally (no API key = passthrough)**

Run: `cd hortisabor-bot && uvicorn bot:app --host 127.0.0.1 --port 7430`
Test: `curl http://localhost:7430/health` — should return `{"ok":true}`
Test: `curl http://localhost:7430/status` — should return status (no auth needed when BOT_API_KEY is empty)

- [ ] **Step 4: Test with API key set**

Run: `BOT_API_KEY=test123 uvicorn bot:app --host 127.0.0.1 --port 7430`
Test: `curl http://localhost:7430/health` — should return `{"ok":true}` (exempt)
Test: `curl http://localhost:7430/status` — should return 401
Test: `curl -H "Authorization: Bearer test123" http://localhost:7430/status` — should return status

- [ ] **Step 5: Commit**

```bash
git add hortisabor-bot/auth.py hortisabor-bot/bot.py
git commit -m "feat: API key middleware for remote access security"
```

---

## Task 6: Bot — Login programatico

**Files:**
- Create: `hortisabor-bot/login.py`
- Modify: `hortisabor-bot/bot.py:1004-1021` (iniciar-montagem endpoint)

- [ ] **Step 1: Create login.py**

Create `hortisabor-bot/login.py`:

```python
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
```

- [ ] **Step 2: Update iniciar-montagem endpoint in bot.py**

In `hortisabor-bot/bot.py`, add import:

```python
from login import login_programatico
```

Replace the reauth block in `iniciar_montagem` (the `if not cookies:` block, lines ~1011-1021) with:

```python
    if not cookies:
        # Tenta login programatico
        cookies_login = await login_programatico()
        if cookies_login:
            salvar_cookies(cookies_login)
            cookies = cookies_login
        else:
            return {
                'status': 'erro',
                'mensagem': 'Login falhou. Verifique credenciais HORTISABOR_EMAIL/PASSWORD no servidor.',
            }
```

- [ ] **Step 3: Remove old reauth code from bot.py**

Remove the `_ReauthState` class, the `_reauth` global instance, and the functions `_abrir_reauth`, `_verificar_login_reauth`, `_finalizar_reauth`. Also remove `_reauth` cleanup from the `lifespan` function.

The lifespan becomes:

```python
async def lifespan(app: FastAPI):
    yield
```

- [ ] **Step 4: Commit**

```bash
git add hortisabor-bot/login.py hortisabor-bot/bot.py
git commit -m "feat: login programatico substitui reauth visual"
```

---

## Task 7: Infra — DuckDNS + Caddy + UFW no Hetzner

**Files:** All on Hetzner via SSH. SSH alias: `hetzner` (key: `~/.ssh/hetzner`)

- [ ] **Step 1: Register DuckDNS subdomain**

Go to https://www.duckdns.org/, login, create subdomain `listamercado` pointing to `46.62.253.237`.
Note the DuckDNS token for auto-update (save for later).

- [ ] **Step 2: Install Caddy on Hetzner**

```bash
ssh hetzner "apt-get update && apt-get install -y caddy"
```

- [ ] **Step 3: Configure Caddyfile**

```bash
ssh hetzner "cat > /etc/caddy/Caddyfile << 'EOF'
listamercado.duckdns.org {
    reverse_proxy 127.0.0.1:7430
}
EOF"
```

- [ ] **Step 4: Start Caddy and enable on boot**

```bash
ssh hetzner "systemctl restart caddy && systemctl enable caddy"
```

- [ ] **Step 5: Open UFW ports 80 and 443**

```bash
ssh hetzner "ufw allow 80/tcp && ufw allow 443/tcp && ufw status"
```

- [ ] **Step 6: Verify Caddy is serving (will show 502 until bot is deployed)**

```bash
curl -I https://listamercado.duckdns.org/health
```

Expected: 502 Bad Gateway (Caddy is up, bot not yet running). If HTTPS works, the certificate is valid.

---

## Task 8: Deploy — Python + Playwright + systemd no Hetzner

- [ ] **Step 1: Install Python deps on Hetzner**

```bash
ssh hetzner "apt-get install -y python3 python3-pip python3-venv"
```

- [ ] **Step 2: Create bot directory and venv**

```bash
ssh hetzner "mkdir -p /opt/hortisabor-bot && python3 -m venv /opt/hortisabor-bot/venv"
```

- [ ] **Step 3: Upload bot files**

```bash
cd hortisabor-bot
tar czf /tmp/hortisabor-bot.tar.gz bot.py auth.py login.py session.py requirements.txt
scp -i ~/.ssh/hetzner /tmp/hortisabor-bot.tar.gz root@46.62.253.237:/opt/hortisabor-bot/
ssh hetzner "cd /opt/hortisabor-bot && tar xzf hortisabor-bot.tar.gz && rm hortisabor-bot.tar.gz"
```

- [ ] **Step 4: Install Python packages**

```bash
ssh hetzner "/opt/hortisabor-bot/venv/bin/pip install -r /opt/hortisabor-bot/requirements.txt"
```

- [ ] **Step 5: Install Playwright Chromium**

```bash
ssh hetzner "/opt/hortisabor-bot/venv/bin/playwright install --with-deps chromium"
```

Note: ARM64 (aarch64) support for Playwright Chromium should work on Ubuntu 24.04. If it fails, this is the fallback blocker and we need to investigate alternatives.

- [ ] **Step 6: Create .env file**

```bash
ssh hetzner "mkdir -p /root/.hortisabor-bot && cat > /root/.hortisabor-bot/.env << 'EOF'
HORTISABOR_EMAIL=<email-da-conta-hortisabor>
HORTISABOR_PASSWORD=<senha-da-conta-hortisabor>
BOT_API_KEY=<gerar-token-aleatorio-com-openssl-rand-hex-32>
GROQ_API_KEY=<chave-groq>
HORTISABOR_DATA_DIR=/root/.hortisabor-bot
EOF
chmod 600 /root/.hortisabor-bot/.env"
```

- [ ] **Step 7: Create systemd service**

```bash
ssh hetzner "cat > /etc/systemd/system/hortisabor-bot.service << 'EOF'
[Unit]
Description=Hortisabor Bot (lista-mercado)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/hortisabor-bot
EnvironmentFile=/root/.hortisabor-bot/.env
ExecStart=/opt/hortisabor-bot/venv/bin/uvicorn bot:app --host 127.0.0.1 --port 7430
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable hortisabor-bot && systemctl start hortisabor-bot"
```

- [ ] **Step 8: Verify bot is running**

```bash
ssh hetzner "systemctl status hortisabor-bot"
curl https://listamercado.duckdns.org/health
```

Expected: `{"ok":true}`

- [ ] **Step 9: Test auth from outside**

```bash
curl https://listamercado.duckdns.org/status
```
Expected: 401 Unauthorized

```bash
curl -H "Authorization: Bearer <BOT_API_KEY>" https://listamercado.duckdns.org/status
```
Expected: `{"ok":true,"montagem":{...}}`

---

## Task 9: Teste end-to-end

- [ ] **Step 1: Push web app changes**

```bash
git push
```

Wait for GitHub Pages deploy (~2 min).

- [ ] **Step 2: Open web app with setup URL**

Open in browser:
```
https://apbulcao.github.io/lista-mercado/#setup&token=<GH_TOKEN>&repo=<GH_REPO>&groq=<GROQ_KEY>&botUrl=https://listamercado.duckdns.org&botApiKey=<BOT_API_KEY>
```

Verify: bot status indicator should show online (green).

- [ ] **Step 3: Test montagem flow**

1. Create a short test list (2-3 items with URLs Hortisabor)
2. Click "Pedir no Hortisabor"
3. Verify bot starts processing (status updates in real time)
4. After completion, open https://www.delivery.hortisabor.com.br/carrinho/ and verify items are in cart

- [ ] **Step 4: Update iniciar.bat with Hetzner URL**

Update `hortisabor-bot/iniciar.bat` setup URL to include `botUrl` and `botApiKey` params. This way the Analu just double-clicks the bat to open the pre-configured web app.

```batch
set "APP_URL=https://apbulcao.github.io/lista-mercado/#setup&token=%GH_TOKEN%&repo=%GH_REPO%&groq=%GROQ_KEY%&botUrl=https://listamercado.duckdns.org&botApiKey=%BOT_API_KEY%"
```

Note: The bat no longer needs to start uvicorn since the bot runs on Hetzner. Simplify to just open the URL.

- [ ] **Step 5: Generate setup link for Analu**

Since she can't install anything, the simplest approach: send her a single URL via WhatsApp that she opens once in her browser. The URL has all config params. After opening, she just bookmarks `https://apbulcao.github.io/lista-mercado/`.

- [ ] **Step 6: Commit final changes**

```bash
git add -A
git commit -m "feat: bot remoto no Hetzner — setup completo"
git push
```
