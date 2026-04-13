# Spec: Catálogo de URLs Hortisabor + Bot com Pausa

**Data:** 2026-04-13
**Status:** aprovado

---

## Problema

O bot Hortisabor usa busca por texto + IA para encontrar produtos, o que é lento e impreciso. A solução é mapear cada item do catálogo a uma URL direta no site. Uma vez mapeado, o bot navega direto sem busca.

O desafio é popular e manter esse mapeamento de forma sustentável.

---

## Solução

Três mudanças coordenadas:

1. **Aba Catálogo no app** — visão geral de todos os 61 itens, separados em "sem URL" e "com URL". Edição inline de URL por item.
2. **Modal de pausa durante a compra** — quando o bot encontra item sem URL, pausa e pede a URL via app. A URL é salva permanentemente no catálogo.
3. **Campo URL ao adicionar item** — qualquer item novo já pode entrar mapeado.

---

## Arquitetura

### Fluxo de uma compra com item sem URL

```
App → POST /iniciar-montagem
  bot spawna background task (Playwright fica aberto)

  item 1: tem url → navega direto → adiciona → próximo
  item 2: sem url → pausa (asyncio.Event)

App (polling /status a cada 1s)
  → { estado: "aguardando_url", item_id: "bananas-prata", nome: "banana prata", progresso: {feitos: 1, total: 11} }

App mostra PausaModal
  usuário abre Hortisabor em outra aba, copia URL

App → handleUrlHortisaborChange("bananas-prata", url) → salva no GitHub (mecanismo existente)
App → POST /fornecer-url { item_id, url }

bot retoma: usa url para item 2 → navega direto → adiciona → próximo
...

App (polling) → { estado: "concluido", encontrados: [...], nao_encontrados: [...] }
App fecha modal, mostra resultado
```

### Persistência de URLs

Quando o usuário fornece uma URL (seja no modal de pausa, no catálogo, ou no formulário de novo item), o **frontend** salva via GitHub Contents API — o mesmo mecanismo já usado para salvar listas. O bot não precisa gravar nada; lê o `data.json` na próxima compra já atualizado.

---

## Componentes

### Frontend (React)

#### `Catalogo.jsx` — novo componente

- Duas colunas: "Sem URL" (vermelho claro) e "Com URL" (verde)
- Barra de progresso no topo: "X / 61 mapeados"
- Clicar num item sem URL expande campo de edição inline (borda amarela)
- Botão "Salvar" chama `onUrlChange(id, url)` — migra item para coluna direita
- Itens na coluna direita têm botão ↗ que abre a URL do produto em nova aba
- Sem ordenação especial; itens sem URL aparecem na ordem atual do catálogo

#### `PausaModal.jsx` — novo componente

- Overlay escurecido sobre a lista principal
- Exibe: nome do produto, categoria, quantidade
- Campo de URL com botão "Salvar e continuar"
- Botão "Pular item" — envia `/fornecer-url` com url vazia, bot segue sem adicionar esse item
- Rodapé: progresso "X adicionados · 1 pausado · Y na fila"
- Renderizado condicionalmente quando `pedidoStatus.estado === "aguardando_url"`

#### `AdicionarItemNovo.jsx` — modificação

- Adicionar campo "URL Hortisabor" (opcional) após os campos existentes
- Placeholder: "Cole o link do produto no site..."
- Texto auxiliar: "Se não souber agora, o bot vai pedir na próxima compra."
- Valor passado junto com os outros campos no `handleAdicionarItem`

#### `App.jsx` — modificações

- Nova aba "Catálogo" na navegação (ao lado de "Lista" e "Histórico")
- Renderiza `<Catalogo />` quando `view === "catalogo"`
- Polling durante compra: quando `pedidoStatus === "loading"`, aumentar frequência para 1s
- Detectar `estado === "aguardando_url"` no polling → renderizar `<PausaModal />`
- Ao confirmar URL no modal: chamar `handleUrlHortisaborChange` + `POST /fornecer-url`
- Endpoint de chamada muda: `/montar-carrinho` → `/iniciar-montagem` (endpoint antigo removido)
- `pedidoStatus` ganha novo formato durante montagem: `{ estado, item_id, nome, progresso }` em vez da string `"loading"`

### Backend (Python / FastAPI)

#### `_MontagemState` — nova classe em `bot.py`

```python
class _MontagemState:
    estado: str = "idle"          # idle | processando | aguardando_url | concluido | erro
    item_atual: str = ""          # nome do item que pausou
    item_id: str = ""             # id do item que pausou
    progresso: dict = {}          # { feitos: int, total: int }
    encontrados: list = []
    nao_encontrados: list = []
    _url_event: asyncio.Event     # bot aguarda aqui quando estado == aguardando_url
    _url_fornecida: str = ""      # URL enviada pelo frontend via /fornecer-url
```

#### Endpoints novos/modificados

| Endpoint | Método | Comportamento |
|----------|--------|---------------|
| `/iniciar-montagem` | POST | Recebe lista de itens (cada um com `id` adicionado ao `ItemRequest`), spawna background task, retorna imediatamente `{status: "iniciado"}` |
| `/status` | GET | Expande payload atual: retorna `_MontagemState` serializada além do status de saúde do bot |
| `/fornecer-url` | POST | Recebe `{item_id, url}`, seta `_url_fornecida`, dispara `_url_event` |

#### Lógica da background task

```python
async def _processar_montagem(itens, page):
    for item in itens:
        _montagem.estado = "processando"
        _montagem.item_atual = item.nome

        url = item.url_hortisabor
        if not url:
            # pausa
            _montagem.estado = "aguardando_url"
            _montagem.item_id = item.id
            _montagem._url_event.clear()
            await _montagem._url_event.wait()   # frontend vai setar
            url = _montagem._url_fornecida

        if url:
            await _navegar_e_adicionar(page, url, item)
            _montagem.encontrados.append(item.nome)
        else:
            _montagem.nao_encontrados.append(item.nome)

        _montagem.progresso["feitos"] += 1

    _montagem.estado = "concluido"
```

---

## Data model

Sem mudanças de schema. O campo `urlHortisabor` já existe em todos os itens do `data.json`. O campo `id` já existe e é usado como chave no `/fornecer-url`.

---

## Casos de borda

| Caso | Comportamento |
|------|---------------|
| Usuário clica "Pular item" | Frontend chama `/fornecer-url` com `url: ""` — bot registra item em `nao_encontrados`, segue |
| Bot em execução e usuário tenta iniciar nova montagem | `/iniciar-montagem` retorna erro `409 Conflict` se `estado != "idle"` |
| App fecha durante compra | Background task continua rodando no servidor local; ao reabrir, polling retoma de onde parou |
| URL fornecida é inválida | Bot tenta navegar; se falhar, registra em `nao_encontrados` e segue (comportamento já existente) |

---

## O que não muda

- Algoritmo de score e sugestão de itens
- Fluxo de confirmação de lista / histórico
- Formato de exportação para WhatsApp
- Mecanismo de salvamento via GitHub Contents API (apenas reutilizado)
- Autenticação Hortisabor (cookies em `hortisabor_session.json`)
