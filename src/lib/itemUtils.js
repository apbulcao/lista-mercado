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
  const apenasDigitos = String(valor ?? '').replace(/\D/g, '')
  if (!apenasDigitos) return ''
  return apenasDigitos.replace(/^0+(?=\d)/, '')
}

export function quantidadeValida(valor) {
  return /^[1-9]\d*$/.test(String(valor ?? '').trim())
}
