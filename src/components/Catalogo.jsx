import { useState } from 'react'

export default function Catalogo({ catalogo = [], onUrlChange }) {
  const [editandoId, setEditandoId] = useState(null)
  const [urlInput, setUrlInput] = useState('')

  const semUrl = catalogo.filter((i) => !i.urlHortisabor)
  const comUrl = catalogo.filter((i) => i.urlHortisabor)
  const cobertura = comUrl.length
  const total = catalogo.length
  const pct = total > 0 ? Math.round((cobertura / total) * 100) : 0

  function abrirEdicao(item) {
    setEditandoId(item.id)
    setUrlInput(item.urlHortisabor || '')
  }

  function salvar(id) {
    onUrlChange(id, urlInput.trim())
    setEditandoId(null)
    setUrlInput('')
  }

  function handleKeyDown(e, id) {
    if (e.key === 'Enter') salvar(id)
    if (e.key === 'Escape') { setEditandoId(null); setUrlInput('') }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E5DDD0', backgroundColor: '#FDFAF7' }}>

      {/* Barra de cobertura */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #E5DDD0', backgroundColor: 'white' }}>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold" style={{ color: '#1A1814' }}>Cobertura Hortisabor</span>
          <span className="text-xs font-bold" style={{ color: '#2D6A4F' }}>{cobertura} / {total}</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: '#E5DDD0' }}>
          <div style={{ height: 6, width: `${pct}%`, backgroundColor: '#2D6A4F', borderRadius: 99 }} />
        </div>
      </div>

      {/* Duas colunas */}
      <div className="flex" style={{ height: 480 }}>

        {/* Sem URL */}
        <div className="flex-1 overflow-y-auto" style={{ borderRight: '1px solid #E5DDD0' }}>
          <div className="sticky top-0 px-3 py-2 text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: '#FFF8F8', borderBottom: '1px solid #F5C6C6', color: '#C0392B' }}>
            ⚠ Sem URL — {semUrl.length}
          </div>
          <div className="p-2 flex flex-col gap-1.5">
            {semUrl.map((item) => (
              <div key={item.id}>
                <div
                  className="rounded-lg px-3 py-2 cursor-pointer"
                  style={{ backgroundColor: editandoId === item.id ? '#FFFBF0' : 'white', border: `1.5px solid ${editandoId === item.id ? '#F5A623' : '#F5C6C6'}` }}
                  onClick={() => editandoId !== item.id && abrirEdicao(item)}
                >
                  <div className="text-sm font-medium" style={{ color: '#1A1814' }}>{item.nome}</div>
                  <div className="text-xs" style={{ color: '#A09890' }}>{item.categoria}</div>
                </div>
                {editandoId === item.id && (
                  <div className="flex gap-1.5 mt-1 px-1">
                    <input
                      autoFocus
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, item.id)}
                      placeholder="Cole o link do produto no Hortisabor..."
                      className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                      style={{ border: '1px solid #C5BAB0', backgroundColor: '#FAFAF8', color: '#1A1814' }}
                    />
                    <button
                      onClick={() => salvar(item.id)}
                      className="text-xs font-semibold rounded-lg px-3 py-1.5 text-white"
                      style={{ backgroundColor: '#2D6A4F', border: 'none', cursor: 'pointer' }}
                    >
                      Salvar
                    </button>
                  </div>
                )}
              </div>
            ))}
            {semUrl.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: '#A09890' }}>Todos os itens mapeados!</p>
            )}
          </div>
        </div>

        {/* Com URL */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 px-3 py-2 text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: '#F0FAF6', borderBottom: '1px solid #B7DDD0', color: '#2D6A4F' }}>
            ✓ Com URL — {comUrl.length}
          </div>
          <div className="p-2 flex flex-col gap-1.5">
            {comUrl.map((item) => (
              <div
                key={item.id}
                className="rounded-lg px-3 py-2 flex items-center justify-between"
                style={{ backgroundColor: '#E8F4F0', border: '1px solid #B7DDD0' }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: '#1A1814' }}>{item.nome}</div>
                  <div className="text-xs" style={{ color: '#5A8A78' }}>{item.categoria}</div>
                </div>
                <a
                  href={item.urlHortisabor}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs rounded px-1.5 py-0.5 font-medium"
                  style={{ color: '#2D6A4F', backgroundColor: 'white', border: '1px solid #B7DDD0', textDecoration: 'none' }}
                >
                  ↗
                </a>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
