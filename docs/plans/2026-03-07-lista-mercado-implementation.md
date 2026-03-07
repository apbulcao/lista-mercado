# Lista Mercado — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Web app que sugere lista de compras semanal com base no histórico, permite ajustes, e exporta texto formatado para WhatsApp.

**Architecture:** SPA React com dados em JSON no repositório GitHub. Leitura via fetch estático, escrita via GitHub API. Algoritmo de score por frequência ponderada para sugestões. Catálogo inicial extraído do histórico .docx.

**Tech Stack:** React 18, Vite, Tailwind CSS 3, Vitest, GitHub Pages, GitHub REST API

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/index.css`

**Step 1: Inicializar projeto Vite com React**

```bash
cd C:/Users/apbul/onedrive/claude/programas/lista-mercado
npm create vite@latest . -- --template react
```

Se o diretório não estiver vazio, mover `listas-mercado.docx` e `docs/` para um lado, criar, depois mover de volta.

**Step 2: Instalar dependências**

```bash
npm install
npm install -D tailwindcss @tailwindcss/vite
```

**Step 3: Configurar Tailwind**

Em `vite.config.js`:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/lista-mercado/',
})
```

Em `src/index.css`:
```css
@import "tailwindcss";
```

**Step 4: Limpar boilerplate e verificar**

Limpar `App.jsx` para um componente mínimo. Remover `App.css`.

```bash
npm run dev
```

Expected: App rodando em localhost com Tailwind funcionando.

**Step 5: Configurar Vitest**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Adicionar ao `vite.config.js`:
```javascript
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test-setup.js',
}
```

Criar `src/test-setup.js`:
```javascript
import '@testing-library/jest-dom'
```

Adicionar script em `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 6: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold projeto React + Vite + Tailwind + Vitest"
```

---

### Task 2: Extrair dados do histórico e criar `data.json`

**Files:**
- Create: `scripts/parse-historico.js`, `public/data.json`
- Read: `listas-mercado.docx`

**Step 1: Criar script de parsing**

Script Node.js que lê o texto extraído do .docx (pode ser hardcoded do texto já extraído) e gera o `data.json` com:
- Catálogo de itens únicos com IDs, categorias, quantidades padrão, detalhes, marcas
- Histórico das 6 listas com datas e referências ao catálogo
- Scores iniciais calculados (aparições / total de listas)

O texto das 6 listas já foi extraído (ver design doc). O script deve:
1. Parsear cada lista identificando categoria e itens
2. Normalizar nomes (lowercase, trim)
3. Agrupar itens iguais entre listas
4. Calcular score = n_aparicoes / n_listas (sem peso por enquanto, dados insuficientes)
5. Gerar `public/data.json`

**Step 2: Rodar script e validar output**

```bash
node scripts/parse-historico.js
```

Expected: `public/data.json` com ~40-50 itens no catálogo e 6 listas no histórico.

Validar manualmente: checar se "bananas prata" tem score ~1.0 (aparece em todas), "filé tilápia" tem score baixo (aparece em 1).

**Step 3: Commit**

```bash
git add scripts/parse-historico.js public/data.json
git commit -m "feat: parse histórico e gerar catálogo inicial com scores"
```

---

### Task 3: Modelo de dados e lógica de score

**Files:**
- Create: `src/lib/data.js`, `src/lib/score.js`
- Test: `src/lib/__tests__/score.test.js`

**Step 1: Escrever testes para o algoritmo de score**

```javascript
// src/lib/__tests__/score.test.js
import { describe, it, expect } from 'vitest'
import { recalcularScores } from '../score'

describe('recalcularScores', () => {
  it('item em todas as listas tem score 1.0', () => {
    const catalogo = [{ id: '1', nome: 'banana', score: 0 }]
    const historico = [
      { data: '2026-03-01', itens: [{ catalogoId: '1', quantidade: '6' }] },
      { data: '2026-03-08', itens: [{ catalogoId: '1', quantidade: '6' }] },
    ]
    const result = recalcularScores(catalogo, historico)
    expect(result[0].score).toBe(1.0)
  })

  it('item em metade das listas tem score ~0.5', () => {
    const catalogo = [{ id: '1', nome: 'tilapia', score: 0 }]
    const historico = [
      { data: '2026-03-01', itens: [{ catalogoId: '1', quantidade: '1' }] },
      { data: '2026-03-08', itens: [] },
    ]
    const result = recalcularScores(catalogo, historico)
    expect(result[0].score).toBeCloseTo(0.5, 1)
  })

  it('listas recentes pesam mais que antigas', () => {
    const catalogo = [{ id: '1', nome: 'kiwi', score: 0 }]
    const historico = [
      { data: '2026-02-01', itens: [{ catalogoId: '1', quantidade: '2' }] },
      { data: '2026-02-08', itens: [] },
      { data: '2026-02-15', itens: [] },
      { data: '2026-02-22', itens: [] },
      { data: '2026-03-01', itens: [] },
    ]
    const result = recalcularScores(catalogo, historico)
    // Apareceu só na mais antiga — score deve ser baixo
    expect(result[0].score).toBeLessThan(0.3)
  })

  it('item novo sem histórico tem score 0', () => {
    const catalogo = [{ id: '1', nome: 'novo', score: 0 }]
    const historico = [
      { data: '2026-03-01', itens: [] },
    ]
    const result = recalcularScores(catalogo, historico)
    expect(result[0].score).toBe(0)
  })
})
```

**Step 2: Rodar testes — devem falhar**

```bash
npm test -- src/lib/__tests__/score.test.js
```

Expected: FAIL — módulo não existe.

**Step 3: Implementar `score.js`**

```javascript
// src/lib/score.js
export function recalcularScores(catalogo, historico) {
  if (historico.length === 0) return catalogo

  // Ordenar por data (mais recente primeiro)
  const sorted = [...historico].sort((a, b) => b.data.localeCompare(a.data))
  const n = sorted.length

  // Pesos: lista mais recente tem peso maior
  // Peso = (n - i) / soma_dos_pesos
  const somaPesos = (n * (n + 1)) / 2
  const pesos = sorted.map((_, i) => (n - i) / somaPesos)

  return catalogo.map(item => {
    let score = 0
    sorted.forEach((lista, i) => {
      const presente = lista.itens.some(it => it.catalogoId === item.id)
      if (presente) score += pesos[i]
    })
    return { ...item, score: Math.round(score * 100) / 100 }
  })
}
```

**Step 4: Rodar testes — devem passar**

```bash
npm test -- src/lib/__tests__/score.test.js
```

Expected: 4 tests PASS.

**Step 5: Implementar `data.js`**

```javascript
// src/lib/data.js
const GITHUB_REPO = 'OWNER/lista-mercado' // substituir
const DATA_PATH = 'public/data.json'

export async function carregarDados() {
  const res = await fetch(`${import.meta.env.BASE_URL}data.json`)
  return res.json()
}

export async function salvarDados(dados, token) {
  // Ler SHA atual do arquivo
  const meta = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_PATH}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json())

  // Atualizar via GitHub API
  await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `lista: ${new Date().toISOString().slice(0, 10)}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(dados, null, 2)))),
        sha: meta.sha,
      }),
    }
  )
}

export const CATEGORIAS = [
  { id: 'legumes', nome: 'Legumes e Salada', emoji: '🥬' },
  { id: 'frutas', nome: 'Frutas', emoji: '🍎' },
  { id: 'carnes', nome: 'Carnes', emoji: '🥩' },
  { id: 'laticinios', nome: 'Laticínios', emoji: '🧀' },
  { id: 'outros', nome: 'Outros', emoji: '📦' },
]
```

**Step 6: Commit**

```bash
git add src/lib/
git commit -m "feat: modelo de dados, algoritmo de score com TDD"
```

---

### Task 4: Componente ListaItem

**Files:**
- Create: `src/components/ListaItem.jsx`
- Test: `src/components/__tests__/ListaItem.test.jsx`

**Step 1: Escrever teste**

```javascript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ListaItem from '../ListaItem'

describe('ListaItem', () => {
  const item = {
    id: '1', nome: 'bananas prata', quantidade: '10',
    detalhes: 'para consumo em 2 dias', marca: '', checked: true,
  }

  it('renderiza nome e quantidade', () => {
    render(<ListaItem item={item} onToggle={() => {}} onQuantidadeChange={() => {}} />)
    expect(screen.getByText('bananas prata')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })

  it('chama onToggle ao clicar checkbox', () => {
    const onToggle = vi.fn()
    render(<ListaItem item={item} onToggle={onToggle} onQuantidadeChange={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith('1')
  })

  it('item desmarcado tem classe de opacidade', () => {
    const unchecked = { ...item, checked: false }
    const { container } = render(
      <ListaItem item={unchecked} onToggle={() => {}} onQuantidadeChange={() => {}} />
    )
    expect(container.firstChild).toHaveClass('opacity-50')
  })
})
```

**Step 2: Rodar — deve falhar**

```bash
npm test -- src/components/__tests__/ListaItem.test.jsx
```

**Step 3: Implementar componente**

Componente com: checkbox customizado verde, campo de quantidade com -/+, nome, detalhes em cinza. Quando desmarcado: opacity-50 + line-through.

**Step 4: Rodar — deve passar**

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: componente ListaItem com toggle e quantidade"
```

---

### Task 5: Componente CategoriaCard

**Files:**
- Create: `src/components/CategoriaCard.jsx`
- Test: `src/components/__tests__/CategoriaCard.test.jsx`

**Step 1: Escrever teste**

Testa: renderiza emoji + nome uppercase, lista itens da categoria, botão "+ Adicionar" abre busca de itens não sugeridos do catálogo.

**Step 2: Rodar — deve falhar**

**Step 3: Implementar**

Card branco com sombra, header com emoji + nome em uppercase tracking-wider verde. Lista de ListaItem. Botão "+ Adicionar" que mostra dropdown/modal com itens do catálogo da mesma categoria que não estão na lista atual (filtro por texto).

**Step 4: Rodar — deve passar**

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: componente CategoriaCard com adicionar do catálogo"
```

---

### Task 6: Formatação para WhatsApp e clipboard

**Files:**
- Create: `src/lib/formatWhatsApp.js`
- Test: `src/lib/__tests__/formatWhatsApp.test.js`

**Step 1: Escrever teste**

```javascript
import { describe, it, expect } from 'vitest'
import { formatarParaWhatsApp } from '../formatWhatsApp'

describe('formatarParaWhatsApp', () => {
  it('formata lista no estilo do histórico', () => {
    const itens = [
      { nome: 'cebolas', quantidade: '4', categoria: 'legumes', detalhes: '', marca: '' },
      { nome: 'bananas prata', quantidade: '10', categoria: 'frutas', detalhes: 'para consumo em 2 dias', marca: '' },
      { nome: 'filé de peito', quantidade: '1 kg', categoria: 'carnes', detalhes: '', marca: 'Korin' },
    ]
    const result = formatarParaWhatsApp(itens, '2026-03-07')
    expect(result).toContain('*Lista 07/03*')
    expect(result).toContain('*LEGUMES E SALADA*')
    expect(result).toContain('- 4 cebolas')
    expect(result).toContain('*FRUTAS*')
    expect(result).toContain('- 10 bananas prata para consumo em 2 dias')
    expect(result).toContain('*CARNES*')
    expect(result).toContain('- 1 kg filé de peito Korin')
  })

  it('omite categorias sem itens', () => {
    const itens = [
      { nome: 'cebolas', quantidade: '4', categoria: 'legumes', detalhes: '', marca: '' },
    ]
    const result = formatarParaWhatsApp(itens, '2026-03-07')
    expect(result).not.toContain('*FRUTAS*')
    expect(result).not.toContain('*CARNES*')
  })
})
```

**Step 2: Rodar — deve falhar**

**Step 3: Implementar**

Gera texto no formato exato das listas do .docx:
```
*Lista DD/MM*:

*CATEGORIA*:
- quantidade nome detalhes marca
```

**Step 4: Rodar — deve passar**

**Step 5: Commit**

```bash
git add src/lib/formatWhatsApp.js src/lib/__tests__/formatWhatsApp.test.js
git commit -m "feat: formatação de lista para WhatsApp"
```

---

### Task 7: App principal — integração

**Files:**
- Create: `src/App.jsx` (reescrever), `src/components/BarraAcoes.jsx`, `src/components/AdicionarItemNovo.jsx`

**Step 1: Implementar App.jsx**

Estado principal:
- `dados` (catálogo + histórico, carregado do data.json)
- `listaAtual` (itens marcados/desmarcados com quantidades)
- `view` ('lista' | 'historico')

Ao carregar: fetch data.json → calcular sugestão (itens com score >= 0.5) → popular listaAtual.

Layout:
- Header com título e data
- Botão "Histórico" no header
- Lista de CategoriaCards
- Campo AdicionarItemNovo no final
- BarraAcoes fixa no rodapé

**Step 2: Implementar BarraAcoes**

Dois botões:
- "Copiar para WhatsApp": chama formatarParaWhatsApp → navigator.clipboard.writeText → feedback "Copiado!"
- "Confirmar lista": salva no histórico, recalcula scores, salva via GitHub API (se token configurado) ou só no state

**Step 3: Implementar AdicionarItemNovo**

Campo de texto + select de categoria. Ao confirmar: cria item no catálogo + adiciona na lista atual.

**Step 4: Testar manualmente**

```bash
npm run dev
```

Verificar: itens sugeridos aparecem marcados, toggle funciona, quantidades editáveis, copiar gera texto correto, adicionar item novo funciona.

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: app principal com sugestão, edição e exportação WhatsApp"
```

---

### Task 8: Tela de histórico

**Files:**
- Create: `src/components/Historico.jsx`

**Step 1: Implementar**

Lista de listas passadas (data + itens), read-only, com as mesmas categorias. Botão "Voltar" retorna à tela principal. Estilo consistente com o resto.

**Step 2: Testar manualmente**

Verificar: listas aparecem em ordem cronológica reversa, itens agrupados por categoria, botão voltar funciona.

**Step 3: Commit**

```bash
git add src/components/Historico.jsx
git commit -m "feat: tela de histórico de listas"
```

---

### Task 9: Estilização visual final

**Files:**
- Modify: todos os componentes para aplicar design system

**Step 1: Aplicar design system completo**

- Fundo off-white (#FAFAF8), cards brancos com rounded-xl e shadow-sm
- Verde-mercado (#2D6A4F) nos botões, checkboxes, headers de categoria
- Tipografia: font-sans (Inter se disponível via Google Fonts)
- Checkboxes custom com accent-color ou classes Tailwind
- Botão WhatsApp: grande, verde, fixo no bottom com py-4
- Animações: transition-opacity nos itens, transition-colors nos botões
- Mobile-first: max-w-lg mx-auto, padding adequado

**Step 2: Testar responsividade**

Abrir no DevTools com viewport de celular (375px, 414px). Verificar que tudo é usável com toque.

**Step 3: Commit**

```bash
git add src/
git commit -m "style: design system completo — verde-mercado, mobile-first"
```

---

### Task 10: Persistência GitHub API e configuração de token

**Files:**
- Create: `src/components/ConfigToken.jsx`
- Modify: `src/App.jsx`, `src/lib/data.js`

**Step 1: Implementar ConfigToken**

Pequeno formulário (acessível por ícone ⚙️ no header) onde o usuário cola o GitHub Personal Access Token uma vez. Salva no localStorage do navegador. Mostra status (conectado/desconectado).

Instruções inline: "Crie um token em github.com/settings/tokens com permissão 'repo'."

**Step 2: Integrar com salvarDados**

Ao "Confirmar lista": se token existe no localStorage, salva via GitHub API. Se não, mostra aviso pedindo para configurar.

Configurar o GITHUB_REPO em `data.js` com o repo real do Antonio.

**Step 3: Testar**

Configurar token, confirmar uma lista, verificar que o `data.json` no repo foi atualizado.

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: persistência via GitHub API com token configurável"
```

---

### Task 11: Deploy no GitHub Pages

**Step 1: Criar repositório no GitHub**

```bash
gh repo create lista-mercado --public --source=. --push
```

**Step 2: Configurar GitHub Actions para deploy**

Criar `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Step 3: Push e verificar deploy**

```bash
git add .github/
git commit -m "ci: deploy automático no GitHub Pages"
git push
```

Aguardar action completar. Acessar `https://OWNER.github.io/lista-mercado/` e verificar que funciona.

**Step 4: Compartilhar URL com esposa**

Testar no celular dela. Verificar que abre, lista aparece, copiar funciona.
