export function slugifyNomeItem(nome) {
  return String(nome ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function criarIdItem(nome, itensExistentes = []) {
  const baseId = slugifyNomeItem(nome)
  if (!baseId) return ''

  const idsExistentes = new Set(itensExistentes.map((item) => item.id))
  if (!idsExistentes.has(baseId)) return baseId

  let sufixo = 2
  let candidato = `${baseId}-${sufixo}`
  while (idsExistentes.has(candidato)) {
    sufixo += 1
    candidato = `${baseId}-${sufixo}`
  }

  return candidato
}

export function normalizarQuantidade(valor) {
  const s = String(valor ?? '').trim().toLowerCase()
  // Peso com unidade colada ao número (100g, 500gr, 200ml, 1kg) = 1 unidade
  if (/^\d+\s*(g|gr|kg|ml|l)\b/.test(s)) return '1'
  const match = s.match(/[1-9]\d*/)
  return match ? match[0] : ''
}

export function quantidadeValida(valor) {
  return /^[1-9]\d*$/.test(String(valor ?? '').trim())
}
