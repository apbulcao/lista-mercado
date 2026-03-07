import { CATEGORIAS } from '../lib/data'

export default function Historico({ historico, catalogo }) {
  const sorted = [...historico].sort((a, b) => b.data.localeCompare(a.data))

  const getItem = (catalogoId) => catalogo.find(c => c.id === catalogoId)

  const formatDate = (dataISO) => {
    const [y, m, d] = dataISO.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="space-y-6">
      {sorted.map(lista => (
        <div key={lista.data} className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ backgroundColor: '#f0fdf4' }}>
            <h3 className="font-semibold" style={{ color: '#2D6A4F' }}>
              📅 {formatDate(lista.data)}
            </h3>
          </div>
          <div className="px-4 py-3">
            {CATEGORIAS.map(cat => {
              const catItens = lista.itens
                .map(i => ({ ...getItem(i.catalogoId), quantidade: i.quantidade }))
                .filter(i => i && i.categoria === cat.id)

              if (catItens.length === 0) return null

              return (
                <div key={cat.id} className="mb-3 last:mb-0">
                  <p className="text-xs font-semibold tracking-wider mb-1" style={{ color: '#2D6A4F' }}>
                    {cat.emoji} {cat.nome.toUpperCase()}
                  </p>
                  <ul className="space-y-0.5">
                    {catItens.map((item, idx) => (
                      <li key={idx} className="text-sm" style={{ color: '#1A1A1A' }}>
                        {item.quantidade} {item.nome}
                        {item.marca && <span className="text-gray-400"> {item.marca}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
