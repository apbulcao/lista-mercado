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
      {sorted.map((lista, index) => (
        <div key={lista.id || `${lista.data}-${index}`} className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FDFAF7', border: '1px solid #E5DDD0', boxShadow: '0 1px 4px rgba(44,40,34,0.06)' }}>
          <div className="px-4 py-3" style={{ backgroundColor: 'rgba(45,106,79,0.05)', borderBottom: '1px solid #E5DDD0' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#2D6A4F', fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>
              {formatDate(lista.data)}
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
                  <p className="text-xs font-semibold tracking-widest mb-1.5 uppercase" style={{ color: '#9A8F83', letterSpacing: '0.07em' }}>
                    {cat.emoji} {cat.nome}
                  </p>
                  <ul className="space-y-0.5">
                    {catItens.map((item, idx) => (
                      <li key={idx} className="text-sm" style={{ color: '#1C1A16' }}>
                        <span className="font-medium" style={{ color: '#7A7267' }}>{item.quantidade}×</span> {item.nome}
                        {item.marca && <span style={{ color: '#9A8F83' }}> {item.marca}</span>}
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
