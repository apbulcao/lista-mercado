const DATA_PATH = 'data.json'
const STORAGE_KEY_PENDING_DATA = 'lista-mercado-dados-pendentes'

function parseJsonSafe(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function carregarSnapshotPendente() {
  const raw = localStorage.getItem(STORAGE_KEY_PENDING_DATA)
  if (!raw) return null

  const snapshot = parseJsonSafe(raw)
  if (
    !snapshot?.dados ||
    !Array.isArray(snapshot.dados.catalogo) ||
    !Array.isArray(snapshot.dados.historico)
  ) {
    return null
  }

  return snapshot
}

export async function carregarDados() {
  const snapshotPendente = carregarSnapshotPendente()

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${DATA_PATH}`)
    if (!res.ok) {
      throw new Error('Nao foi possivel carregar os dados do projeto')
    }

    const dadosRemotos = await res.json()
    if (
      snapshotPendente &&
      snapshotPendente.dados.historico.length > dadosRemotos.historico.length
    ) {
      return snapshotPendente.dados
    }

    return dadosRemotos
  } catch (error) {
    if (snapshotPendente) {
      return snapshotPendente.dados
    }

    throw error
  }
}

export const CATEGORIAS = [
  { id: 'legumes', nome: 'Legumes e Salada', emoji: '🥬' },
  { id: 'frutas', nome: 'Frutas', emoji: '🍎' },
  { id: 'carnes', nome: 'Carnes', emoji: '🥩' },
  { id: 'laticinios', nome: 'Laticínios', emoji: '🧀' },
  { id: 'outros', nome: 'Outros', emoji: '📦' },
]

export const SCORE_THRESHOLD = 0.5

export function salvarDadosPendentes(dados) {
  localStorage.setItem(
    STORAGE_KEY_PENDING_DATA,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      dados,
    })
  )
}

export function limparDadosPendentes() {
  localStorage.removeItem(STORAGE_KEY_PENDING_DATA)
}

async function parseErrorResponse(response) {
  const payload = await response.text()
  const json = parseJsonSafe(payload)
  return json?.message || payload || null
}

export async function salvarDados(dados, token, repo) {
  const path = 'public/data.json'

  // Get current file SHA
  const metaResponse = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!metaResponse.ok) {
    const message = await parseErrorResponse(metaResponse)
    throw new Error(message || 'Erro ao buscar a versao atual do arquivo no GitHub')
  }

  const meta = await metaResponse.json()
  if (!meta.sha) {
    throw new Error('Nao foi possivel identificar a versao atual do arquivo no GitHub')
  }

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
    const message = await parseErrorResponse(response)
    throw new Error(message || 'Erro ao salvar')
  }
}
