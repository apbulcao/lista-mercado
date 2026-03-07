const DECAY = 0.9

function modaQuantidade(quantidades) {
  if (quantidades.length === 0) return null
  const freq = {}
  for (const q of quantidades) {
    freq[q] = (freq[q] || 0) + 1
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
}

export function recalcularScores(catalogo, historico) {
  if (historico.length === 0) return catalogo

  const sorted = [...historico].sort((a, b) => b.data.localeCompare(a.data))
  const n = sorted.length
  const pesosRaw = sorted.map((_, i) => Math.pow(DECAY, i))
  const somaPesos = pesosRaw.reduce((a, b) => a + b, 0)
  const pesos = pesosRaw.map(p => p / somaPesos)

  return catalogo.map(item => {
    let score = 0
    const quantidades = []
    sorted.forEach((lista, i) => {
      const entry = lista.itens.find(it => it.catalogoId === item.id)
      if (entry) {
        score += pesos[i]
        quantidades.push(entry.quantidade)
      }
    })
    const quantidadePadrao = modaQuantidade(quantidades) || item.quantidadePadrao
    return { ...item, score: Math.round(score * 100) / 100, quantidadePadrao }
  })
}
