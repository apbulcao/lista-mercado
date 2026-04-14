# Design: Bot Hortisabor no Hetzner

## Problema

A Analu usa um PC corporativo com bloqueio total de instalacao. O bot precisa de Python + Playwright + Chromium, que nao podem ser instalados nesse PC. A solucao eh rodar o bot no servidor Hetzner (46.62.253.237) e o web app (GitHub Pages) conectar remotamente.

## Restricoes

- PC corporativo: sem admin, sem instalacao de software
- Web app em HTTPS (GitHub Pages) — bot precisa de HTTPS (mixed content blocking)
- Sem dominio proprio
- Hetzner: Ubuntu 24.04 ARM, 4GB RAM, 40GB disco, ja roda OpenClaw

## Arquitetura

```
Browser (Analu)                  Hetzner (46.62.253.237)
+-----------------------+        +----------------------------------+
| GitHub Pages (HTTPS)  |        | Caddy (443)                      |
| apbulcao.github.io    | -----> |   reverse proxy                  |
| /lista-mercado/       |  HTTPS |   listamercado.duckdns.org       |
+-----------------------+        |        |                          |
                                 |        v                          |
                                 | uvicorn (127.0.0.1:7430)         |
                                 |   bot.py (FastAPI)                |
                                 |   Playwright + Chromium headless  |
                                 +----------------------------------+
```

## Componentes

### 1. DuckDNS + Caddy (HTTPS)

- Subdominio gratuito DuckDNS (ex: `listamercado.duckdns.org`) apontando para o IP do Hetzner
- Caddy como reverse proxy com HTTPS automatico (Let's Encrypt)
- UFW abre portas 80 e 443
- Caddyfile:
  ```
  listamercado.duckdns.org {
      reverse_proxy 127.0.0.1:7430
  }
  ```

### 2. Bot — adaptacoes para servidor

#### Login programatico (substitui reauth visual)
- Hoje: abre browser visivel (`headless=False`) para o usuario logar manualmente
- Novo: navega headless ate `/login/`, preenche email/senha, submete
- Credenciais em `/root/.hortisabor-bot/.env`
- Fallback se tiver CAPTCHA: endpoint `POST /upload-cookies` para enviar cookies manualmente

#### Autenticacao da API
- Middleware que valida header `Authorization: Bearer <token>` em todos os endpoints exceto health check
- Token definido no `.env` do servidor
- Requests sem token ou com token errado: 401

#### Path de cookies
- `session.py` hoje usa `APPDATA` (Windows). Adaptar para `~/.hortisabor-bot/session.json` em Linux
- Usa `HORTISABOR_DATA_DIR` env var se disponivel, senao fallback por OS

#### CORS
- Ja configurado para `https://apbulcao.github.io` — nenhuma mudanca necessaria

### 3. Web App — URL configuravel

- `localhost:7430` hardcoded em 5 pontos no `App.jsx`
- Extrair para funcao `getBotUrl()` que le de `localStorage.botUrl`
- Fallback: `http://localhost:7430` (manter compatibilidade local)
- Header `Authorization: Bearer <token>` em todos os fetch para o bot
- Token lido de `localStorage.botApiKey`

### 4. Setup da Analu

- `iniciar.bat` passa URL do Hetzner + API key na URL de setup:
  `#setup&token=...&repo=...&groq=...&botUrl=https://listamercado.duckdns.org&botApiKey=...`
- Web app ja tem logica de ler params do hash — adicionar `botUrl` e `botApiKey`

### 5. Deploy

- Systemd service `hortisabor-bot.service` (mesmo padrao de OpenClaw)
- Deploy via tar + scp + ssh
- Variaveis de ambiente:
  - `HORTISABOR_EMAIL` — login do Hortisabor
  - `HORTISABOR_PASSWORD` — senha do Hortisabor
  - `BOT_API_KEY` — token de autenticacao da API
  - `GROQ_API_KEY` — chave da IA (Groq)

## Seguranca

- API protegida por Bearer token
- HTTPS end-to-end (Caddy + Let's Encrypt)
- Credenciais em `.env` com chmod 600
- Cookies do Hortisabor em arquivo local com permissao restrita

## Ordem de implementacao sugerida

1. Infra: DuckDNS + Caddy + UFW
2. Bot: adaptar session.py, login programatico, middleware de auth
3. Web app: URL configuravel + header de auth + setup params
4. Deploy: systemd + env + scp
5. Teste end-to-end
