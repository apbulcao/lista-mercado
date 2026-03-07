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

export async function salvarDados(dados, token, repo) {
  const path = 'public/data.json'

  // Get current file SHA
  const meta = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json())

  // Update via GitHub API
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
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

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.message || 'Erro ao salvar')
  }
}
