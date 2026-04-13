# Catálogo URL Hortisabor + Bot com Pausa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mapear cada item do catálogo a uma URL direta no Hortisabor; bot pausa durante a compra quando encontra item sem URL e aguarda o usuário colar o link antes de continuar.

**Architecture:** Aba "Catálogo" no frontend (duas colunas: sem/com URL) + modal de pausa durante compra (PausaModal) + campo URL ao adicionar item. No backend, a montagem vira uma background task asyncio; quando o bot precisa de URL pausa com `asyncio.Event`; o frontend faz polling em `/status` a cada 1s e envia a URL via `/fornecer-url`.

**Tech Stack:** React 18 + Vite + Tailwind CSS v4, Vitest + Testing Library, Python 3.11 + FastAPI + Playwright

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `hortisabor-bot/bot.py` | Modificar | State machine de montagem, novos endpoints |
| `hortisabor-bot/test_bot_state.py` | Criar | Testes da state machine (sem Playwright) |
| `src/components/Catalogo.jsx` | Criar | Aba catálogo — duas colunas |
| `src/components/__tests__/Catalogo.test.jsx` | Criar | Testes do catálogo |
| `src/components/PausaModal.jsx` | Criar | Modal de pausa durante compra |
| `src/components/__tests__/PausaModal.test.jsx` | Criar | Testes do modal |
| `src/components/AdicionarItemNovo.jsx` | Modificar | Campo URL opcional |
| `src/components/__tests__/AdicionarItemNovo.test.jsx` | Criar | Testes do formulário com URL |
| `src/App.jsx` | Modificar | Nova aba, polling de montagem, integração PausaModal |

---

## Task 1: Backend — _MontagemState + endpoint /iniciar-montagem

**Files:**
- Modify: `hortisabor-bot/bot.py`
- Create: `hortisabor-bot/test_bot_state.py`

- [ ] **Step 1: Escrever os testes de estado**

Criar `hortisabor-bot/test_bot_state.py`:

```python
import asyncio
import pytest
from fastapi.testclient import TestClient

# Importar depois que o bot.py for modificado
from bot import app, _montagem

client = TestClient(app)


def reset_state():
    _montagem.estado = "idle"
    _montagem.item_atual = ""
    _montagem.item_id = ""
    _montagem.progresso = {"feitos": 0, "total": 0}
    _montagem.encontrados = []
    _montagem.nao_encontrados = []
    _montagem._url_event = None
    _montagem._url_fornecida = ""


def test_iniciar_montagem_sem_cookies_retorna_reauth(monkeypatch):
    reset_state()
    monkeypatch.setattr("bot.carregar_cookies", lambda: None)
    # _abrir_reauth é async — mockar para não abrir browser
    async def mock_abrir():
        pass
    monkeypatch.setattr("bot._abrir_reauth", mock_abrir)

    res = client.post("/iniciar-montagem", json={
        "itens": [{"id": "banana", "nome": "banana prata", "quantidade": "6"}]
    })
    assert res.status_code == 200
    assert res.json()["status"] == "reauth_needed"


def test_iniciar_montagem_conflito_quando_ja_rodando(monkeypatch):
    reset_state()
    _montagem.estado = "processando"
    monkeypatch.setattr("bot.carregar_cookies", lambda: [{"name": "x", "value": "y", "domain": "hortisabor.com.br", "path": "/"}])

    res = client.post("/iniciar-montagem", json={
        "itens": [{"id": "banana", "nome": "banana prata", "quantidade": "6"}]
    })
    assert res.status_code == 409


def test_fornecer_url_quando_nao_aguardando_retorna_400():
    reset_state()
    res = client.post("/fornecer-url", json={"item_id": "banana", "url": "https://example.com"})
    assert res.status_code == 400


def test_status_retorna_montagem():
    reset_state()
    res = client.get("/status")
    data = res.json()
    assert data["ok"] is True
    assert "montagem" in data
    assert data["montagem"]["estado"] == "idle"
```

- [ ] **Step 2: Rodar os testes — confirmar que falham (bot ainda não modificado)**

```bash
cd hortisabor-bot && /opt/homebrew/bin/python3.11 -m pytest test_bot_state.py -v 2>&1 | head -40
```

Esperado: erros de importação ou falhas nos asserts (bot ainda sem _montagem nem novos endpoints).

- [ ] **Step 3: Adicionar `id` ao `ItemRequest` e criar `_MontagemState`**

Em `hortisabor-bot/bot.py`, substituir o bloco `ItemRequest` e adicionar `_MontagemState` após `_ReauthState`:

```python
class ItemRequest(BaseModel):
    id: str = ''
    nome: str
    quantidade: str
    marca: str = ''
    detalhes: str = ''
    url_hortisabor: str = ''


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


_reauth = _ReauthState()
_montagem = _MontagemState()
```

- [ ] **Step 4: Criar a background task `_processar_montagem`**

Adicionar antes dos endpoints em `bot.py`:

```python
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

        _montagem.estado = 'concluido'

    except Exception as e:
        print(f'[bot] Erro na montagem: {e}')
        restantes = [i.nome for i in itens if i.nome not in _montagem.encontrados]
        _montagem.nao_encontrados.extend(restantes)
        _montagem.estado = 'erro'

    finally:
        await browser.close()
        await pw.stop()
```

- [ ] **Step 5: Substituir `/montar-carrinho` por `/iniciar-montagem`**

Em `bot.py`, remover o endpoint `montar_carrinho` e adicionar:

```python
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
```

- [ ] **Step 6: Rodar os testes — confirmar que passam**

```bash
cd hortisabor-bot && /opt/homebrew/bin/python3.11 -m pytest test_bot_state.py -v
```

Esperado: 4 testes passando.

- [ ] **Step 7: Commit**

```bash
cd hortisabor-bot && git add bot.py test_bot_state.py && git commit -m "feat(bot): _MontagemState + /iniciar-montagem com background task"
```

---

## Task 2: Backend — /status expandido + /fornecer-url

**Files:**
- Modify: `hortisabor-bot/bot.py`
- Modify: `hortisabor-bot/test_bot_state.py`

- [ ] **Step 1: Adicionar testes para os novos endpoints**

Acrescentar ao final de `hortisabor-bot/test_bot_state.py`:

```python
def test_fornecer_url_resume_quando_aguardando(monkeypatch):
    reset_state()
    _montagem.estado = "aguardando_url"
    _montagem._url_event = asyncio.Event()

    res = client.post("/fornecer-url", json={"item_id": "banana", "url": "https://hortisabor.com.br/banana"})
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert _montagem._url_fornecida == "https://hortisabor.com.br/banana"
    assert _montagem._url_event.is_set()


def test_status_exposto_durante_aguardando_url():
    reset_state()
    _montagem.estado = "aguardando_url"
    _montagem.item_atual = "banana prata"
    _montagem.item_id = "bananas-prata"
    _montagem.progresso = {"feitos": 2, "total": 10}

    res = client.get("/status")
    data = res.json()
    assert data["montagem"]["estado"] == "aguardando_url"
    assert data["montagem"]["item_atual"] == "banana prata"
    assert data["montagem"]["item_id"] == "bananas-prata"
    assert data["montagem"]["progresso"]["feitos"] == 2
```

- [ ] **Step 2: Rodar os testes novos — confirmar que falham**

```bash
cd hortisabor-bot && /opt/homebrew/bin/python3.11 -m pytest test_bot_state.py::test_fornecer_url_resume_quando_aguardando test_bot_state.py::test_status_exposto_durante_aguardando_url -v
```

Esperado: FAIL — endpoints ainda não existem com a nova assinatura.

- [ ] **Step 3: Expandir /status e adicionar /fornecer-url**

Em `bot.py`, substituir o endpoint `/status` existente e adicionar `FornecerUrlRequest` + `/fornecer-url`:

```python
class FornecerUrlRequest(BaseModel):
    item_id: str
    url: str


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
```

- [ ] **Step 4: Rodar todos os testes do bot**

```bash
cd hortisabor-bot && /opt/homebrew/bin/python3.11 -m pytest test_bot_state.py -v
```

Esperado: 6 testes passando.

- [ ] **Step 5: Commit**

```bash
cd hortisabor-bot && git add bot.py test_bot_state.py && git commit -m "feat(bot): /status expandido + /fornecer-url"
```

---

## Task 3: Frontend — Catalogo.jsx

**Files:**
- Create: `src/components/Catalogo.jsx`
- Create: `src/components/__tests__/Catalogo.test.jsx`

- [ ] **Step 1: Escrever o teste**

Criar `src/components/__tests__/Catalogo.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Catalogo from '../Catalogo'

const catalogo = [
  { id: 'banana', nome: 'banana prata', categoria: 'frutas', urlHortisabor: '' },
  { id: 'cebola', nome: 'cebola nacional', categoria: 'legumes', urlHortisabor: 'https://hortisabor.com.br/cebola' },
  { id: 'cenoura', nome: 'cenoura', categoria: 'legumes', urlHortisabor: 'https://hortisabor.com.br/cenoura' },
]

describe('Catalogo', () => {
  it('exibe contagem de cobertura correta', () => {
    render(<Catalogo catalogo={catalogo} onUrlChange={() => {}} />)
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('item sem URL aparece na coluna esquerda', () => {
    render(<Catalogo catalogo={catalogo} onUrlChange={() => {}} />)
    // Coluna "Sem URL" deve conter banana prata
    const semUrl = screen.getByText(/Sem URL/)
    expect(semUrl).toBeInTheDocument()
    expect(screen.getAllByText('banana prata').length).toBeGreaterThan(0)
  })

  it('item com URL aparece na coluna direita', () => {
    render(<Catalogo catalogo={catalogo} onUrlChange={() => {}} />)
    const comUrl = screen.getByText(/Com URL/)
    expect(comUrl).toBeInTheDocument()
    expect(screen.getAllByText('cebola nacional').length).toBeGreaterThan(0)
  })

  it('clicar em item sem URL abre campo de edição', () => {
    render(<Catalogo catalogo={catalogo} onUrlChange={() => {}} />)
    fireEvent.click(screen.getByText('banana prata'))
    expect(screen.getByPlaceholderText(/Cole o link/i)).toBeInTheDocument()
  })

  it('salvar URL chama onUrlChange com id e url', () => {
    const onUrlChange = vi.fn()
    render(<Catalogo catalogo={catalogo} onUrlChange={onUrlChange} />)
    fireEvent.click(screen.getByText('banana prata'))
    const input = screen.getByPlaceholderText(/Cole o link/i)
    fireEvent.change(input, { target: { value: 'https://hortisabor.com.br/banana' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }))
    expect(onUrlChange).toHaveBeenCalledWith('banana', 'https://hortisabor.com.br/banana')
  })
})
```

- [ ] **Step 2: Rodar o teste — confirmar que falha**

```bash
npm test -- src/components/__tests__/Catalogo.test.jsx
```

Esperado: FAIL — `Catalogo` não existe.

- [ ] **Step 3: Implementar Catalogo.jsx**

Criar `src/components/Catalogo.jsx`:

```jsx
import { useState } from 'react'

export default function Catalogo({ catalogo, onUrlChange }) {
  const [editandoId, setEditandoId] = useState(null)
  const [urlInput, setUrlInput] = useState('')

  const semUrl = catalogo.filter((i) => !i.urlHortisabor)
  const comUrl = catalogo.filter((i) => i.urlHortisabor)
  const cobertura = comUrl.length
  const total = catalogo.length
  const pct = total > 0 ? Math.round((cobertura / total) * 100) : 0

  function abrirEdicao(item) {
    setEditandoId(item.id)
    setUrlInput(item.urlHortisabor || '')
  }

  function salvar(id) {
    onUrlChange(id, urlInput.trim())
    setEditandoId(null)
    setUrlInput('')
  }

  function handleKeyDown(e, id) {
    if (e.key === 'Enter') salvar(id)
    if (e.key === 'Escape') { setEditandoId(null); setUrlInput('') }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E5DDD0', backgroundColor: '#FDFAF7' }}>

      {/* Barra de cobertura */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #E5DDD0', backgroundColor: 'white' }}>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold" style={{ color: '#1A1814' }}>Cobertura Hortisabor</span>
          <span className="text-xs font-bold" style={{ color: '#2D6A4F' }}>{cobertura} / {total}</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: '#E5DDD0' }}>
          <div style={{ height: 6, width: `${pct}%`, backgroundColor: '#2D6A4F', borderRadius: 99 }} />
        </div>
      </div>

      {/* Duas colunas */}
      <div className="flex" style={{ height: 480 }}>

        {/* Sem URL */}
        <div className="flex-1 overflow-y-auto" style={{ borderRight: '1px solid #E5DDD0' }}>
          <div className="sticky top-0 px-3 py-2 text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: '#FFF8F8', borderBottom: '1px solid #F5C6C6', color: '#C0392B' }}>
            ⚠ Sem URL — {semUrl.length}
          </div>
          <div className="p-2 flex flex-col gap-1.5">
            {semUrl.map((item) => (
              <div key={item.id}>
                <div
                  className="rounded-lg px-3 py-2 cursor-pointer"
                  style={{ backgroundColor: editandoId === item.id ? '#FFFBF0' : 'white', border: `1.5px solid ${editandoId === item.id ? '#F5A623' : '#F5C6C6'}` }}
                  onClick={() => editandoId !== item.id && abrirEdicao(item)}
                >
                  <div className="text-sm font-medium" style={{ color: '#1A1814' }}>{item.nome}</div>
                  <div className="text-xs" style={{ color: '#A09890' }}>{item.categoria}</div>
                </div>
                {editandoId === item.id && (
                  <div className="flex gap-1.5 mt-1 px-1">
                    <input
                      autoFocus
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, item.id)}
                      placeholder="Cole o link do produto no Hortisabor..."
                      className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                      style={{ border: '1px solid #C5BAB0', backgroundColor: '#FAFAF8', color: '#1A1814' }}
                    />
                    <button
                      onClick={() => salvar(item.id)}
                      className="text-xs font-semibold rounded-lg px-3 py-1.5 text-white"
                      style={{ backgroundColor: '#2D6A4F', border: 'none', cursor: 'pointer' }}
                    >
                      Salvar
                    </button>
                  </div>
                )}
              </div>
            ))}
            {semUrl.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: '#A09890' }}>Todos os itens mapeados!</p>
            )}
          </div>
        </div>

        {/* Com URL */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 px-3 py-2 text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: '#F0FAF6', borderBottom: '1px solid #B7DDD0', color: '#2D6A4F' }}>
            ✓ Com URL — {comUrl.length}
          </div>
          <div className="p-2 flex flex-col gap-1.5">
            {comUrl.map((item) => (
              <div
                key={item.id}
                className="rounded-lg px-3 py-2 flex items-center justify-between"
                style={{ backgroundColor: '#E8F4F0', border: '1px solid #B7DDD0' }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: '#1A1814' }}>{item.nome}</div>
                  <div className="text-xs" style={{ color: '#5A8A78' }}>{item.categoria}</div>
                </div>
                <a
                  href={item.urlHortisabor}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs rounded px-1.5 py-0.5 font-medium"
                  style={{ color: '#2D6A4F', backgroundColor: 'white', border: '1px solid #B7DDD0', textDecoration: 'none' }}
                >
                  ↗
                </a>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste — confirmar que passa**

```bash
npm test -- src/components/__tests__/Catalogo.test.jsx
```

Esperado: 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/components/Catalogo.jsx src/components/__tests__/Catalogo.test.jsx
git commit -m "feat: Catalogo.jsx — duas colunas sem/com URL com edição inline"
```

---

## Task 4: Frontend — Campo URL em AdicionarItemNovo

**Files:**
- Modify: `src/components/AdicionarItemNovo.jsx`
- Create: `src/components/__tests__/AdicionarItemNovo.test.jsx`

- [ ] **Step 1: Escrever o teste**

Criar `src/components/__tests__/AdicionarItemNovo.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AdicionarItemNovo from '../AdicionarItemNovo'

describe('AdicionarItemNovo', () => {
  it('mostra botão para abrir o formulário', () => {
    render(<AdicionarItemNovo onAdicionar={() => {}} />)
    expect(screen.getByText(/item não listado/i)).toBeInTheDocument()
  })

  it('abre formulário ao clicar no botão', () => {
    render(<AdicionarItemNovo onAdicionar={() => {}} />)
    fireEvent.click(screen.getByText(/item não listado/i))
    expect(screen.getByPlaceholderText('Nome do item')).toBeInTheDocument()
  })

  it('campo URL é exibido quando formulário está aberto', () => {
    render(<AdicionarItemNovo onAdicionar={() => {}} />)
    fireEvent.click(screen.getByText(/item não listado/i))
    expect(screen.getByPlaceholderText(/Cole o link do produto/i)).toBeInTheDocument()
  })

  it('chama onAdicionar com nome, categoria e url ao submeter', () => {
    const onAdicionar = vi.fn()
    render(<AdicionarItemNovo onAdicionar={onAdicionar} />)
    fireEvent.click(screen.getByText(/item não listado/i))
    fireEvent.change(screen.getByPlaceholderText('Nome do item'), { target: { value: 'cream cheese' } })
    fireEvent.change(screen.getByPlaceholderText(/Cole o link do produto/i), {
      target: { value: 'https://hortisabor.com.br/cream-cheese' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }))
    expect(onAdicionar).toHaveBeenCalledWith('cream cheese', 'outros', 'https://hortisabor.com.br/cream-cheese')
  })

  it('chama onAdicionar com url vazia quando campo URL não preenchido', () => {
    const onAdicionar = vi.fn()
    render(<AdicionarItemNovo onAdicionar={onAdicionar} />)
    fireEvent.click(screen.getByText(/item não listado/i))
    fireEvent.change(screen.getByPlaceholderText('Nome do item'), { target: { value: 'cream cheese' } })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }))
    expect(onAdicionar).toHaveBeenCalledWith('cream cheese', 'outros', '')
  })
})
```

- [ ] **Step 2: Rodar o teste — confirmar falhas**

```bash
npm test -- src/components/__tests__/AdicionarItemNovo.test.jsx
```

Esperado: testes de URL falham — campo ainda não existe.

- [ ] **Step 3: Adicionar campo URL em AdicionarItemNovo.jsx**

Substituir o conteúdo completo de `src/components/AdicionarItemNovo.jsx`:

```jsx
import { useState } from 'react'
import { CATEGORIAS } from '../lib/data'

export default function AdicionarItemNovo({ onAdicionar }) {
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('outros')
  const [url, setUrl] = useState('')
  const [aberto, setAberto] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) return
    const adicionado = onAdicionar(nomeTrimmed, categoria, url.trim())
    if (adicionado !== false) {
      setNome('')
      setCategoria('outros')
      setUrl('')
      setAberto(false)
    }
  }

  if (!aberto) {
    return (
      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="text-xs font-medium cursor-pointer py-3 transition-colors duration-200"
          style={{ color: '#9A8F83' }}
        >
          + item não listado acima
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-2xl p-4" style={{ backgroundColor: '#FDFAF7', border: '1px solid #E5DDD0' }}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Nome do item"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors duration-200"
          style={{ color: '#1C1A16', border: '1px solid #E5DDD0', backgroundColor: '#F2EDE4' }}
          autoFocus
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors duration-200"
          style={{ color: '#1C1A16', border: '1px solid #E5DDD0', backgroundColor: '#F2EDE4' }}
        >
          {CATEGORIAS.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.emoji} {cat.nome}
            </option>
          ))}
        </select>
        <div>
          <input
            type="url"
            placeholder="Cole o link do produto no Hortisabor (opcional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors duration-200"
            style={{ color: '#1C1A16', border: '1px solid #E5DDD0', backgroundColor: '#F2EDE4' }}
          />
          <p className="text-xs mt-1" style={{ color: '#A09890' }}>
            Se não souber agora, o bot vai pedir na próxima compra.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: '#2D6A4F' }}
          >
            Adicionar
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(false)
              setNome('')
              setCategoria('outros')
              setUrl('')
            }}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200"
            style={{ color: '#7A7267', border: '1px solid #E5DDD0', backgroundColor: 'transparent' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste — confirmar que passa**

```bash
npm test -- src/components/__tests__/AdicionarItemNovo.test.jsx
```

Esperado: 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdicionarItemNovo.jsx src/components/__tests__/AdicionarItemNovo.test.jsx
git commit -m "feat: AdicionarItemNovo — campo URL Hortisabor opcional"
```

---

## Task 5: Frontend — PausaModal.jsx

**Files:**
- Create: `src/components/PausaModal.jsx`
- Create: `src/components/__tests__/PausaModal.test.jsx`

- [ ] **Step 1: Escrever o teste**

Criar `src/components/__tests__/PausaModal.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PausaModal from '../PausaModal'

const estadoPausa = {
  estado: 'aguardando_url',
  item_atual: 'banana prata',
  item_id: 'bananas-prata',
  progresso: { feitos: 2, total: 10 },
}

describe('PausaModal', () => {
  it('exibe nome do produto pausado', () => {
    render(<PausaModal estado={estadoPausa} onFornecer={() => {}} onPular={() => {}} />)
    expect(screen.getByText('banana prata')).toBeInTheDocument()
  })

  it('exibe progresso corretamente', () => {
    render(<PausaModal estado={estadoPausa} onFornecer={() => {}} onPular={() => {}} />)
    expect(screen.getByText(/2 adicionados/)).toBeInTheDocument()
    expect(screen.getByText(/8 na fila/)).toBeInTheDocument()
  })

  it('botão Salvar chama onFornecer com item_id e url', () => {
    const onFornecer = vi.fn()
    render(<PausaModal estado={estadoPausa} onFornecer={onFornecer} onPular={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/hortisabor/i), {
      target: { value: 'https://hortisabor.com.br/banana' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar e continuar/i }))
    expect(onFornecer).toHaveBeenCalledWith('bananas-prata', 'https://hortisabor.com.br/banana')
  })

  it('botão Pular chama onPular', () => {
    const onPular = vi.fn()
    render(<PausaModal estado={estadoPausa} onFornecer={() => {}} onPular={onPular} />)
    fireEvent.click(screen.getByRole('button', { name: /Pular item/i }))
    expect(onPular).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar o teste — confirmar que falha**

```bash
npm test -- src/components/__tests__/PausaModal.test.jsx
```

Esperado: FAIL — `PausaModal` não existe.

- [ ] **Step 3: Implementar PausaModal.jsx**

Criar `src/components/PausaModal.jsx`:

```jsx
import { useState } from 'react'

export default function PausaModal({ estado, onFornecer, onPular }) {
  const [urlInput, setUrlInput] = useState('')

  const { item_atual, item_id, progresso } = estado
  const naFila = (progresso?.total ?? 0) - (progresso?.feitos ?? 0) - 1

  function handleSalvar() {
    onFornecer(item_id, urlInput.trim())
    setUrlInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSalvar()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(26,24,20,0.45)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 shadow-2xl"
        style={{ backgroundColor: 'white', border: '1px solid #E0D9CE' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: '1.1rem' }}>⏸</span>
          <span className="text-sm font-bold" style={{ color: '#1A1814' }}>Produto sem URL</span>
        </div>
        <p className="text-xs mb-3" style={{ color: '#7A7267', lineHeight: 1.4 }}>
          O bot não sabe onde encontrar este produto no Hortisabor:
        </p>

        <div className="rounded-lg px-3 py-2.5 mb-3" style={{ backgroundColor: '#FFF8F0', border: '1.5px solid #F5A623' }}>
          <div className="text-base font-bold" style={{ color: '#1A1814' }}>{item_atual}</div>
        </div>

        <p className="text-xs mb-2" style={{ color: '#7A7267' }}>
          Abra o Hortisabor em outra aba, ache o produto e cole a URL aqui:
        </p>

        <div className="flex gap-2 mb-3">
          <input
            autoFocus
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://delivery.hortisabor.com.br/..."
            className="flex-1 text-xs rounded-lg px-3 py-2 focus:outline-none"
            style={{ border: '1.5px solid #C5BAB0', color: '#1A1814', backgroundColor: '#FAFAF8' }}
          />
          <button
            onClick={handleSalvar}
            className="text-xs font-semibold rounded-lg px-3 py-2 text-white whitespace-nowrap"
            style={{ backgroundColor: '#2D6A4F', border: 'none', cursor: 'pointer' }}
          >
            Salvar e continuar
          </button>
        </div>

        <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid #E8E0D4' }}>
          <span className="text-xs" style={{ color: '#A09890' }}>
            {progresso?.feitos ?? 0} adicionados · {Math.max(0, naFila)} na fila
          </span>
          <button
            onClick={onPular}
            className="text-xs"
            style={{ background: 'none', border: 'none', color: '#C5BAB0', cursor: 'pointer', padding: 0 }}
          >
            Pular item
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste — confirmar que passa**

```bash
npm test -- src/components/__tests__/PausaModal.test.jsx
```

Esperado: 4 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/components/PausaModal.jsx src/components/__tests__/PausaModal.test.jsx
git commit -m "feat: PausaModal — modal de pausa durante compra no Hortisabor"
```

---

## Task 6: Frontend — Integração em App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Adicionar import dos novos componentes**

No topo de `src/App.jsx`, acrescentar às importações existentes:

```jsx
import Catalogo from './components/Catalogo'
import PausaModal from './components/PausaModal'
import { useRef } from 'react'
```

E modificar a linha de import do useState para incluir `useRef`:
```jsx
import { useState, useEffect, useRef } from 'react'
```

- [ ] **Step 2: Adicionar ref de polling e atualizar handleAdicionarNovo**

Dentro de `export default function App()`, logo após a declaração de estados existentes, adicionar:

```jsx
const pollingRef = useRef(null)
```

Localizar a função `handleAdicionarNovo(nome, categoria)` (linha ~111) e modificar a assinatura e o corpo para aceitar `urlHortisabor`:

```jsx
function handleAdicionarNovo(nome, categoria, urlHortisabor = '') {
    const slugBase = slugifyNomeItem(nome)
    if (!slugBase) {
      alert('Digite um nome de item valido.')
      return false
    }

    const itemExistente = dados.catalogo.find(
      (item) => item.id === slugBase || slugifyNomeItem(item.nome) === slugBase
    )

    if (itemExistente) {
      if (listaAtual.some((l) => l.id === itemExistente.id)) {
        alert(`"${itemExistente.nome}" ja esta na lista.`)
        return false
      }
      handleAdicionarDoCatalogo(itemExistente.id)
      return true
    }

    const id = criarIdItem(nome, dados.catalogo)
    const novoItem = {
      id,
      nome,
      categoria,
      quantidadePadrao: '1',
      unidade: '',
      detalhes: '',
      marca: '',
      score: 0,
      urlHortisabor: urlHortisabor || '',
    }
    setDados((prev) => ({
      ...prev,
      catalogo: [...prev.catalogo, novoItem],
    }))
    setListaAtual((prev) => [
      ...prev,
      { ...novoItem, quantidade: '1', checked: true },
    ])
    return true
  }
```

- [ ] **Step 3: Substituir handlePedirHortisabor pelo novo fluxo com polling**

Localizar e substituir a função `handlePedirHortisabor` inteira:

```jsx
async function handlePedirHortisabor() {
    const checkedItens = getItensSelecionadosValidos()
    if (!checkedItens) return

    setPedidoStatus('loading')

    try {
      const res = await fetch('http://localhost:7430/iniciar-montagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: checkedItens.map((i) => ({
            id: i.id,
            nome: i.nome,
            quantidade: i.quantidade,
            marca: i.marca || '',
            detalhes: i.detalhes || '',
            url_hortisabor: i.urlHortisabor || '',
          })),
          ai_provider: getAiProvider(),
          ai_api_key: getAiApiKey(),
          ai_url: getAiUrl(),
        }),
      })

      const data = await res.json()

      if (data.status === 'reauth_needed') {
        setPedidoStatus('reauth')
        return
      }

      // Iniciar polling
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch('http://localhost:7430/status')
          const statusData = await statusRes.json()
          const montagem = statusData.montagem

          if (montagem.estado === 'concluido') {
            clearInterval(pollingRef.current)
            setPedidoStatus({
              url: 'https://www.delivery.hortisabor.com.br/carrinho/',
              encontrados: montagem.encontrados,
              nao_encontrados: montagem.nao_encontrados,
            })
          } else if (montagem.estado === 'aguardando_url') {
            setPedidoStatus(montagem)
          } else if (montagem.estado === 'erro') {
            clearInterval(pollingRef.current)
            setPedidoStatus('error')
          }
        } catch {
          clearInterval(pollingRef.current)
          setPedidoStatus('error')
        }
      }, 1000)

    } catch {
      setPedidoStatus('error')
    }
  }
```

- [ ] **Step 4: Adicionar handleFornecerUrl e handlePularItem**

Adicionar após `handlePedirHortisabor`:

```jsx
async function handleFornecerUrl(itemId, url) {
    // Salva no GitHub via mecanismo existente
    await handleUrlHortisaborChange(itemId, url)
    // Envia ao bot para retomar
    await fetch('http://localhost:7430/fornecer-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, url }),
    })
    setPedidoStatus('loading')
  }

  async function handlePularItem() {
    // item_id não é necessário: o bot já sabe qual item está aguardando
    await fetch('http://localhost:7430/fornecer-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: '', url: '' }),
    })
    setPedidoStatus('loading')
  }
```

- [ ] **Step 5: Adicionar aba Catálogo na navegação e renderização**

Localizar o header (linha ~383) onde está o botão de alternância de views:

```jsx
<button
  onClick={() => setView(view === 'lista' ? 'historico' : 'lista')}
  ...
>
  {view === 'lista' ? 'Histórico' : 'Voltar'}
</button>
```

Substituir por:

```jsx
<div className="flex gap-1">
  <button
    onClick={() => setView('lista')}
    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-200"
    style={{
      border: '1px solid #E0D9CE',
      color: view === 'lista' ? '#2D6A4F' : '#5A5449',
      backgroundColor: view === 'lista' ? '#E0EDE7' : 'transparent',
    }}
  >
    Lista
  </button>
  <button
    onClick={() => setView('catalogo')}
    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-200"
    style={{
      border: '1px solid #E0D9CE',
      color: view === 'catalogo' ? '#2D6A4F' : '#5A5449',
      backgroundColor: view === 'catalogo' ? '#E0EDE7' : 'transparent',
    }}
  >
    Catálogo
  </button>
  <button
    onClick={() => setView('historico')}
    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-200"
    style={{
      border: '1px solid #E0D9CE',
      color: view === 'historico' ? '#2D6A4F' : '#5A5449',
      backgroundColor: view === 'historico' ? '#E0EDE7' : 'transparent',
    }}
  >
    Histórico
  </button>
</div>
```

- [ ] **Step 6: Adicionar renderização da view catálogo**

Localizar no `main` content (linha ~479):

```jsx
{view === 'lista' ? (
  <>
    ...
  </>
) : (
  <Historico historico={dados.historico} catalogo={dados.catalogo} />
)}
```

Substituir por:

```jsx
{view === 'lista' && (
  <>
    <div className="md:hidden">
      <WelcomeHeader />
    </div>
    <SmartInput onAddItems={handleSmartInputItems} />
    {CATEGORIAS.map((cat) => {
      const catItens = listaAtual.filter((i) => i.categoria === cat.id)
      const catalogoExtras = dados.catalogo.filter(
        (c) => c.categoria === cat.id && !listaAtual.some((l) => l.id === c.id)
      )
      if (catItens.length === 0 && catalogoExtras.length === 0) return null
      return (
        <CategoriaCard
          key={cat.id}
          categoria={cat}
          itens={catItens}
          catalogoExtras={catalogoExtras}
          onToggle={handleToggle}
          onQuantidadeChange={handleQuantidadeChange}
          onAdicionarItem={handleAdicionarDoCatalogo}
          onUrlChange={handleUrlHortisaborChange}
        />
      )
    })}
    <AdicionarItemNovo onAdicionar={handleAdicionarNovo} />
  </>
)}
{view === 'catalogo' && dados && (
  <Catalogo catalogo={dados.catalogo} onUrlChange={handleUrlHortisaborChange} />
)}
{view === 'historico' && (
  <Historico historico={dados.historico} catalogo={dados.catalogo} />
)}
```

- [ ] **Step 7: Renderizar PausaModal e ajustar bloco de pedidoStatus**

O `PausaModal` tem overlay próprio (`fixed inset-0 z-40`), então deve ser renderizado **independentemente** do painel inferior. Fazer dois ajustes:

**7a — Adicionar PausaModal logo antes do painel inferior (`{pedidoStatus && (`):**

```jsx
{typeof pedidoStatus === 'object' && pedidoStatus !== null && pedidoStatus.estado === 'aguardando_url' && (
  <PausaModal
    estado={pedidoStatus}
    onFornecer={handleFornecerUrl}
    onPular={handlePularItem}
  />
)}
```

**7b — Suprimir o painel inferior quando `aguardando_url`** (para não mostrar painel vazio atrás do modal). Localizar a linha `{pedidoStatus && (` e adicionar a guarda:

```jsx
{pedidoStatus && !(typeof pedidoStatus === 'object' && pedidoStatus !== null && pedidoStatus.estado === 'aguardando_url') && (
```

**7c — Ajustar a condição do bloco de resultado** dentro do painel (que antes usava `typeof pedidoStatus === 'object'`) para não conflitar com o estado de pausa. Localizar:

```jsx
{pedidoStatus !== null && typeof pedidoStatus === 'object' && (
```

Substituir por:

```jsx
{pedidoStatus !== null && typeof pedidoStatus === 'object' && pedidoStatus.url && (
```

- [ ] **Step 8: Rodar todos os testes frontend**

```bash
npm test
```

Esperado: todos os testes passando.

- [ ] **Step 9: Iniciar dev server e verificar manualmente**

```bash
npm run dev
```

Verificar:
- Aba "Catálogo" aparece no header
- Catálogo mostra duas colunas com os 61 itens
- Clicar num item sem URL abre campo de edição inline
- Formulário "Adicionar item" tem campo URL com texto auxiliar
- View "Lista" e "Histórico" continuam funcionando normalmente

- [ ] **Step 10: Commit**

```bash
git add src/App.jsx
git commit -m "feat: App.jsx — aba catálogo, polling de montagem, PausaModal"
```

---

## Notas de implementação

- O `PausaModal` é renderizado **fora** do `{pedidoStatus && (...)}` wrapper existente (que usa `position: fixed; inset-0`) para ter seu próprio z-index e overlay. Ajustar o wrapper existente conforme necessário para não conflitar.
- O intervalo de polling (`pollingRef.current`) deve ser limpo no `useEffect` de cleanup se o componente desmontar enquanto uma montagem estiver em curso. Adicionar `return () => clearInterval(pollingRef.current)` no cleanup do useEffect de montagem se aplicável.
- O bot em `hortisabor-bot/bot.py` deve ser reiniciado após as mudanças do Task 1 e 2 para que os novos endpoints estejam disponíveis.
