import { useState } from 'react'

export default function PausaModal({ estado, onFornecer, onPular }) {
  const [urlInput, setUrlInput] = useState('')

  const { item_atual, item_id, progresso } = estado
  const naFila = (progresso?.total ?? 0) - (progresso?.feitos ?? 0)

  function handleSalvar() {
    onFornecer(item_id, urlInput.trim())
    setUrlInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSalvar()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(26,24,20,0.45)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 shadow-2xl"
        style={{ backgroundColor: 'white', border: '1px solid #E0D9CE' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: '1.1rem' }}>⏸</span>
          <span className="text-sm font-bold" style={{ color: '#1A1814' }}>Produto sem URL</span>
        </div>
        <p className="text-xs mb-3" style={{ color: '#7A7267', lineHeight: 1.4 }}>
          O bot não sabe onde encontrar este produto no Hortisabor:
        </p>

        <div className="rounded-lg px-3 py-2.5 mb-3" style={{ backgroundColor: '#FFF8F0', border: '1.5px solid #F5A623' }}>
          <div className="text-base font-bold" style={{ color: '#1A1814' }}>{item_atual}</div>
        </div>

        <p className="text-xs mb-2" style={{ color: '#7A7267' }}>
          Abra o Hortisabor em outra aba, ache o produto e cole a URL aqui:
        </p>

        <div className="flex gap-2 mb-3">
          <input
            autoFocus
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://delivery.hortisabor.com.br/..."
            className="flex-1 text-xs rounded-lg px-3 py-2 focus:outline-none"
            style={{ border: '1.5px solid #C5BAB0', color: '#1A1814', backgroundColor: '#FAFAF8' }}
          />
          <button
            onClick={handleSalvar}
            className="text-xs font-semibold rounded-lg px-3 py-2 text-white whitespace-nowrap"
            style={{ backgroundColor: '#2D6A4F', border: 'none', cursor: 'pointer' }}
          >
            Salvar e continuar
          </button>
        </div>

        <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid #E8E0D4' }}>
          <span className="text-xs" style={{ color: '#A09890' }}>
            {progresso?.feitos ?? 0} adicionados · {Math.max(0, naFila)} na fila
          </span>
          <button
            onClick={onPular}
            className="text-xs"
            style={{ background: 'none', border: 'none', color: '#C5BAB0', cursor: 'pointer', padding: 0 }}
          >
            Pular item
          </button>
        </div>
      </div>
    </div>
  )
}
