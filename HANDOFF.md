# HANDOFF — lista-mercado
**Data:** 2026-04-14 (sessão 11)
**Branch:** `main`
**Commit:** `6030d53`

---

## O que foi feito nesta sessão

### Fix: CRLF nos .bat para Windows
- `instalar.bat` e `iniciar.bat` tinham line endings Unix (LF) — CMD do Windows quebrava
- Convertidos para CRLF, criado `.gitattributes` para forçar CRLF em `*.bat`/`*.env`
- Trocou `pip`/`playwright`/`uvicorn` por `python -m ...` (mais robusto quando Scripts/ não está no PATH)
- Adicionado `pause` no final do `iniciar.bat` para não fechar silenciosamente
- Atualizado `instalar.bat` com instruções para Microsoft Store (sem admin)
- `pip install --user` para não precisar de admin

### Limpeza git
- Removidos: 5 docs superpowers, 4 arquivos de teste bot, `descobrir_seletores.py` (commit `4bfc47b`)
- Worktree `feat-hortisabor-bot` removido + branch deletada
- `.gitignore` atualizado: bloqueia `tokens.env` e `bug-*.jpeg/png`

### Deploy do bot no Hetzner (Tasks 1-9)
**Motivação:** PC da Analu é corporativo, sem permissão de admin/instalação. Bot precisa rodar remotamente.

**Infra criada:**
- DuckDNS: `listamercado.duckdns.org` → `46.62.253.237` (token: `738cce89-3fc2-4689-bf6a-9e6048fd1248`)
- Caddy reverse proxy com HTTPS automático (Let's Encrypt)
- UFW: portas 80 e 443 abertas
- systemd service: `hortisabor-bot.service`

**Código alterado (6 commits: `9fa95cb`..`6030d53`):**
- `src/lib/botApi.js` — novo: `getBotUrl()`, `getBotApiKey()`, `botFetch()` helper
- `src/App.jsx` — 5x `localhost:7430` substituídos por `botFetch('/...')` + setup hash lê `botUrl`/`botApiKey`
- `src/components/ConfigToken.jsx` — seção "Bot Hortisabor" com URL e API Key
- `hortisabor-bot/session.py` — path de cookies cross-platform (Windows + Linux)
- `hortisabor-bot/auth.py` — novo: middleware Bearer token (desativado se BOT_API_KEY vazio)
- `hortisabor-bot/login.py` — novo: login headless com email/senha (substitui reauth visual)
- `hortisabor-bot/bot.py` — removido todo o reauth visual, adicionado `/health` endpoint

**Deploy no Hetzner:**
- Bot em `/opt/hortisabor-bot/` com venv Python
- Playwright + Chromium ARM64 instalados
- `.env` em `/root/.hortisabor-bot/.env` (chmod 600)
- Service rodando: `systemctl status hortisabor-bot`

---

## BUG EM ABERTO: app não detecta bot como online

### Sintoma
O app no celular mostra "Serviço não encontrado" ao clicar "Pedir no Hortisabor", mesmo com as configurações corretas salvas (URL do bot + API key visíveis no modal de settings).

### O que JÁ FOI VERIFICADO (tudo OK)
1. **Servidor acessível:** `curl https://listamercado.duckdns.org/health` → `{"ok":true}`
2. **Auth funciona:** `curl -H "Authorization: Bearer <key>" https://listamercado.duckdns.org/status` → 200 com dados
3. **CORS correto:** Preflight com `Origin: https://apbulcao.github.io` + `Access-Control-Request-Headers: Authorization` retorna headers corretos
4. **Código deployado:** Bundle no GitHub Pages contém `botFetch`, `botUrl`, `lista-mercado-bot-url` (verificado via curl do JS bundle)
5. **Settings salvos:** Screenshot confirma URL e API Key preenchidos no modal

### O que NÃO FOI VERIFICADO (próximo passo)
- **Console do browser:** Precisa abrir DevTools no celular (ou testar no Mac) para ver o erro real — pode ser mixed content, CORS na prática, encoding do token, etc.
- **Estado do `botOnline`:** O `checarBot` useEffect roda a cada 5s e chama `botFetch('/status')`. Se falha, `setBotOnline(false)`.
- **Diferença entre `botOnline` e `pedidoStatus`:** "Serviço não encontrado" vem de `pedidoStatus === 'error'`, que é setado quando o fetch de `iniciar-montagem` falha. Pode ser que o `botOnline` esteja true mas o POST falhou.

### Como debugar na próxima sessão
1. Abrir `http://localhost:5173/lista-mercado/` no Mac com DevTools
2. Setar localStorage: `lista-mercado-bot-url` = `https://listamercado.duckdns.org` e `lista-mercado-bot-api-key` = `e813a6aa2d889b50a9b553937ef8e20c960ec0a509218d6ac2a69010ed0aad10`
3. Recarregar e observar Console + Network tab
4. Verificar se `botFetch('/status')` retorna 200 ou falha
5. Se `/status` funciona, testar `botFetch('/iniciar-montagem', ...)` com POST

---

## Credenciais e tokens (referência)

- **BOT_API_KEY:** `e813a6aa2d889b50a9b553937ef8e20c960ec0a509218d6ac2a69010ed0aad10`
- **DuckDNS token:** `738cce89-3fc2-4689-bf6a-9e6048fd1248`
- **Hetzner SSH:** `ssh hetzner` (key `~/.ssh/hetzner`, IP `46.62.253.237`)
- **Bot service:** `systemctl restart/status/stop hortisabor-bot`
- **Bot logs:** `journalctl -u hortisabor-bot -f`
- **Caddy config:** `/etc/caddy/Caddyfile`

---

## Arquivos relevantes

- `src/lib/botApi.js` — helper de fetch com URL configurável
- `src/App.jsx:60-83` — setup hash parsing + checarBot poll
- `src/App.jsx:702-713` — mensagem "Serviço não encontrado"
- `src/components/ConfigToken.jsx` — settings modal com seção Bot Hortisabor
- `hortisabor-bot/auth.py` — API key middleware
- `hortisabor-bot/login.py` — login programático
- `hortisabor-bot/bot.py` — endpoints /health, /status, /iniciar-montagem
- `docs/superpowers/specs/2026-04-14-bot-hetzner-deploy-design.md` — spec
- `docs/superpowers/plans/2026-04-14-bot-hetzner-deploy.md` — plano de implementação
