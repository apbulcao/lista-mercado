const CATEGORIA_LABELS = {
  legumes: 'LEGUMES E SALADA',
  frutas: 'FRUTAS',
  carnes: 'CARNES',
  laticinios: 'LATICÍNIOS',
  outros: 'OUTROS',
}

const CATEGORIA_ORDEM = ['legumes', 'frutas', 'carnes', 'laticinios', 'outros']

export function formatarParaWhatsApp(itens, dataISO) {
  const [, mes, dia] = dataISO.split('-')
  let texto = `*Lista ${dia}/${mes}*:\n`

  for (const catId of CATEGORIA_ORDEM) {
    const catItens = itens.filter(i => i.categoria === catId)
    if (catItens.length === 0) continue

    texto += `\n*${CATEGORIA_LABELS[catId]}*:\n`
    for (const item of catItens) {
      let linha = `- ${item.quantidade} ${item.nome}`
      if (item.detalhes) linha += ` ${item.detalhes}`
      if (item.marca) linha += ` ${item.marca}`
      texto += `${linha}\n`
    }
  }

  return texto.trim()
}
