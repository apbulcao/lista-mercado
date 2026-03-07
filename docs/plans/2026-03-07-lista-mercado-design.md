# Lista Mercado — Design Document

## Problema

Elaborar lista de compras semanal de supermercado. Hoje o processo é manual (lista digitada no Word, enviada por WhatsApp para secretária ou mercado). O programa deve sugerir uma lista com base no histórico e permitir ajustes antes de enviar.

## Decisões

- **Plataforma**: Web app (SPA) — acessível por URL no celular e computador, sem instalar nada
- **Hosting**: GitHub Pages (grátis, estático)
- **Dados**: Arquivo `data.json` no repositório, lido via GitHub Pages, escrito via GitHub API com token
- **Stack**: React + Vite + Tailwind CSS
- **Exportação**: Texto formatado copiado para clipboard (colar no WhatsApp)

## Modelo de dados — `data.json`

```json
{
  "catalogo": [
    {
      "id": "uuid",
      "nome": "bananas prata",
      "categoria": "frutas",
      "quantidadePadrao": "10",
      "unidade": "unidades",
      "detalhes": "para consumo em 2 dias",
      "marca": "",
      "score": 0.83
    }
  ],
  "historico": [
    {
      "data": "2026-03-06",
      "itens": [
        { "catalogoId": "uuid", "quantidade": "10" }
      ]
    }
  ]
}
```

### Categorias fixas (ordem de exibição)

1. Legumes e Salada
2. Frutas
3. Carnes
4. Laticínios
5. Outros

### Algoritmo de sugestão

- Score = média ponderada de aparições, peso maior para listas recentes
- Itens com score >= 0.5 entram na sugestão automática (pré-marcados)
- A cada lista confirmada: recalcula scores de todos os itens do catálogo
- Catálogo inicial populado a partir das 6 listas do histórico (.docx)

## Interface

Tela única, mobile-first (max-width ~480px centralizado).

### Tela principal — Montar lista

- Título com data de hoje
- Itens sugeridos pré-marcados, agrupados por categoria
- Cada item: checkbox + quantidade editável (botões -/+) + nome + detalhes/marca em cinza
- Desmarcar = remover da lista, com opacidade reduzida e riscado
- Topo de cada categoria: botão "+ Adicionar" abre busca no catálogo (itens não sugeridos)
- Final: campo "Adicionar item novo" (entra no catálogo automaticamente)

### Ações (barra fixa no rodapé)

- **"Copiar para WhatsApp"**: gera texto formatado no estilo das listas existentes, copia para clipboard. Feedback "Copiado!" por 2s.
- **"Confirmar lista"**: salva no histórico, recalcula scores.

### Histórico

- Tela secundária (link/botão), read-only
- Lista de listas passadas para consulta

## Visual

- **Fundo**: off-white (#FAFAF8), cards brancos com border-radius e sombra leve
- **Acentos**: verde-mercado (#2D6A4F) para botões, checkboxes ativos
- **Texto**: principal #1A1A1A, detalhes/marcas #6B7280
- **Categorias**: headers com ícone emoji, nome em uppercase espaçado
- **Checkbox**: custom arredondado, verde quando marcado
- **Botão WhatsApp**: grande, verde, fixo no rodapé com ícone clipboard
- **Tipografia**: Inter ou system font
- **Animações**: toggle suave, fade-in em itens novos
