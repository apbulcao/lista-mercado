import fs from 'fs'
import { formatarParaWhatsApp } from './src/lib/formatWhatsApp.js'

const data = JSON.parse(fs.readFileSync('./public/data.json', 'utf8'))
const itensHistorico = data.historico[0].itens.map(hItem => {
  const catItem = data.catalogo.find(c => c.id === hItem.catalogoId)
  return { ...catItem, quantidade: hItem.quantidade }
})

const texto = formatarParaWhatsApp(itensHistorico, data.historico[0].data)
console.log("TEXTO EXPORTADO:")
console.log(texto)
