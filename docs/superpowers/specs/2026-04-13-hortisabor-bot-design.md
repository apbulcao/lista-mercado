# Spec: Hortisabor Bot

**Data:** 2026-04-13
**Status:** Aprovado

---

## Objetivo

Adicionar ao lista-mercado um botão "Pedir no Hortisabor" que, ao ser clicado, envia a lista de compras selecionada para um serviço local que monta o carrinho automaticamente no site do Hortisabor. Quando o carrinho estiver pronto, o app exibe uma notificação com o link para a usuária revisar e finalizar o pagamento.

---

## Contexto

- O lista-mercado é um app React hospedado no GitHub Pages (HTTPS)
- A usuária final (esposa) usa Windows, sempre no mesmo computador
- O site Hortisabor (`delivery.hortisabor.com.br`) é uma SPA com JavaScript dinâmico — sem API pública identificada
- O carrinho do Hortisabor é baseado em conta (confirmado em teste): item adicionado em um dispositivo aparece em outro
- O site tem CAPTCHA no login — a autenticação manual é feita uma vez e os cookies são persistidos

---

## Arquitetura

Dois componentes que se comunicam via HTTP local:

```
[lista-mercado - GitHub Pages]
        |
        | POST http://localhost:7430/montar-carrinho
        |
[hortisabor-bot - serviço Python local]
        |
        | Playwright (Chromium headless)
        |
[delivery.hortisabor.com.br]
```

---

## Componente 1 — Serviço Python local (`hortisabor-bot/`)

### Estrutura de arquivos

```
lista-mercado/
  hortisabor-bot/
    instalar.bat        ← setup único: instala Python, deps, Chromium
    iniciar.bat         ← inicia o serviço antes de fazer compras
    bot.py              ← FastAPI + Playwright
    requirements.txt
```

### Endpoints

**`GET /status`**
Retorna `{ "ok": true }`. Usado pelo lista-mercado para saber se o serviço está rodando.

**`POST /montar-carrinho`**
Recebe a lista de itens e monta o carrinho no Hortisabor.

Request:
```json
[
  { "nome": "leite integral", "quantidade": "2", "marca": "Parmalat", "detalhes": "" },
  { "nome": "bananas prata", "quantidade": "6", "marca": "", "detalhes": "" }
]
```

Response (sucesso):
```json
{
  "status": "ok",
  "url_carrinho": "https://www.delivery.hortisabor.com.br/carrinho/",
  "encontrados": ["leite integral", "bananas prata"],
  "nao_encontrados": []
}
```

Response (erro de sessão — cookies expirados):
```json
{
  "status": "reauth_needed",
  "mensagem": "Sessão expirada. Abrindo janela para login..."
}
```

### Autenticação (cookie persistence)

Cookies salvos em `%APPDATA%\lista-mercado\hortisabor_session.json`.

**Fluxo de primeira execução ou reautenticação:**
1. Bot recebe `POST /montar-carrinho`
2. Detecta ausência ou expiração de cookies
3. Abre Chrome **visível** na página de login do Hortisabor e retorna `reauth_needed` imediatamente
4. Frontend mostra: "Uma janela do Chrome abriu. Faça login lá. Quando terminar, clique em Pedir novamente."
5. Usuária faz login manualmente (resolve CAPTCHA) — Chrome permanece aberto
6. Usuária clica "Pedir novamente" no app
7. Bot recebe nova requisição, verifica se a sessão aberta está autenticada (checa URL/cookies), salva cookies e fecha o Chrome, prossegue em headless

**Execuções normais:**
- Playwright carrega cookies salvos e opera em modo **headless** sem abrir janela
- Cookies de sessão do Hortisabor tipicamente duram semanas a meses — re-login é evento raro

### Matching de itens

1. Para cada item da lista, digita `nome + marca` (se houver) no campo de busca do Hortisabor
2. Aguarda resultados aparecerem (timeout: 10s)
3. Seleciona o **primeiro resultado** da lista (sem julgamento de relevância)
4. Adiciona a `quantidade` ao carrinho
5. Se nenhum resultado em 10s: marca como `nao_encontrado` e segue para o próximo

### CORS

FastAPI configurado para aceitar requisições de `https://apbulcao.github.io` (origem do lista-mercado) e `http://localhost:*` (para desenvolvimento local).

### Instalação (`instalar.bat`)

1. Verifica se Python 3.11+ está instalado
   - Se `winget` disponível (Windows 10 1709+ / Windows 11): instala via `winget install Python.Python.3.11`
   - Fallback: abre o browser na página de download do Python com instruções na tela
2. Executa `pip install -r requirements.txt`
3. Executa `playwright install chromium`
4. Exibe "Instalação concluída. Abra iniciar.bat antes de fazer compras."

---

## Componente 2 — Integração no lista-mercado

### Arquivos modificados

- `src/components/BarraAcoes.jsx` — adiciona botão "Pedir no Hortisabor"
- `src/App.jsx` — adiciona handler `handlePedirHortisabor` e estado de UI

### Comportamento do botão

- Na carga do app: faz `GET localhost:7430/status` silenciosamente
  - Se serviço online: botão aparece habilitado
  - Se offline: botão oculto (não confunde a usuária)
- Ao clicar:
  - Botão muda para estado loading: "Montando carrinho…"
  - Envia `POST /montar-carrinho` com os itens selecionados (marcados como `checked`)
  - Se retornar `reauth_needed`: exibe alerta "Uma janela do Chrome vai abrir para você fazer login. Após logar, clique em Pedir novamente."
  - Se retornar `ok`: exibe modal/toast com:
    - Link "Abrir carrinho" (abre `url_carrinho` em nova aba)
    - Lista de itens não encontrados (se houver)
  - Se erro de rede (serviço offline): exibe "Serviço não encontrado. Verifique se iniciar.bat está rodando."

---

## Fora do escopo

- Finalização automática do pedido (pagamento)
- Busca de alternativas para itens não encontrados
- Integração com outros supermercados
- App mobile ou versão web do serviço

---

## Validação esperada

Após implementação, testar manualmente:
1. `instalar.bat` roda sem erros em Windows fresh
2. `iniciar.bat` sobe o serviço na porta 7430
3. Botão aparece no lista-mercado após serviço iniciado
4. Primeira execução abre Chrome visível, login funciona, cookies são salvos
5. Segunda execução é headless, itens aparecem no carrinho do Hortisabor
6. Itens não encontrados aparecem na notificação
7. Cookies expirados disparam reauth corretamente
