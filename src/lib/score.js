const DECAY = 0.9

export function recalcularScores(catalogo, historico) {
  if (historico.length === 0) return catalogo

  const sorted = [...historico].sort((a, b) => b.data.localeCompare(a.data))
  const n = sorted.length
  const pesosRaw = sorted.map((_, i) => Math.pow(DECAY, i))
  const somaPesos = pesosRaw.reduce((a, b) => a + b, 0)
  const pesos = pesosRaw.map(p => p / somaPesos)

  return catalogo.map(item => {
    let score = 0
    sorted.forEach((lista, i) => {
      const presente = lista.itens.some(it => it.catalogoId === item.id)
      if (presente) score += pesos[i]
    })
    return { ...item, score: Math.round(score * 100) / 100 }
  })
}
