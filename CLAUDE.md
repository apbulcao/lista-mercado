# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Web app para elaborar listas de compras de supermercado. Sugere itens com base no histórico de compras, permite ajustes, e exporta texto formatado para WhatsApp.

## Commands

```bash
npm run dev          # Dev server (Vite)
npm run build        # Production build → dist/
npm test             # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

Run a single test file:
```bash
npm test -- src/lib/__tests__/score.test.js
```

## Architecture

**Stack:** React 18 + Vite + Tailwind CSS v4 (via @tailwindcss/vite plugin) + Vitest

**Data flow:** `public/data.json` → fetch on load → React state → GitHub API on save

- `public/data.json` — single source of truth: catálogo de itens (com scores) + histórico de listas
- Scores são recalculados a cada lista confirmada (média ponderada com decay exponencial, peso maior para listas recentes)
- Itens com score >= 0.5 são sugeridos automaticamente (pré-marcados)
- Persistência via GitHub Contents API com token armazenado em localStorage

**Key files:**
- `src/lib/score.js` — algoritmo de score (recalcularScores)
- `src/lib/data.js` — carregarDados, salvarDados, CATEGORIAS, SCORE_THRESHOLD
- `src/lib/formatWhatsApp.js` — formata lista no estilo WhatsApp com bold (*...*) por categoria
- `src/App.jsx` — orquestrador principal (state, handlers, layout)
- `scripts/parse-historico.js` — script one-off que gerou data.json a partir do .docx original

**Categorias (ordem fixa):** legumes, frutas, carnes, laticinios, outros

## Deploy

GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`). Push to `main` triggers deploy.

URL: `https://apbulcao.github.io/lista-mercado/`

`vite.config.js` tem `base: '/lista-mercado/'` para funcionar no subpath do GitHub Pages.
