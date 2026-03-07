const DATA_PATH = 'data.json'

export async function carregarDados() {
  const res = await fetch(`${import.meta.env.BASE_URL}${DATA_PATH}`)
  return res.json()
}

export const CATEGORIAS = [
  { id: 'legumes', nome: 'Legumes e Salada', emoji: '🥬' },
  { id: 'frutas', nome: 'Frutas', emoji: '🍎' },
  { id: 'carnes', nome: 'Carnes', emoji: '🥩' },
  { id: 'laticinios', nome: 'Laticínios', emoji: '🧀' },
  { id: 'outros', nome: 'Outros', emoji: '📦' },
]

export const SCORE_THRESHOLD = 0.5
