import { useState } from 'react'

export default function BarraAcoes({ onCopiar, onConfirmar }) {
  const [copiado, setCopiado] = useState(false)

  const handleCopiar = async () => {
    await onCopiar()
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
      <div className="max-w-lg mx-auto px-4 py-3 flex gap-3">
        <button
          onClick={handleCopiar}
          className="flex-1 py-3 rounded-xl font-semibold text-white transition-colors"
          style={{ backgroundColor: copiado ? '#22c55e' : '#2D6A4F' }}
        >
          {copiado ? '\u2713 Copiado!' : '\uD83D\uDCCB Copiar para WhatsApp'}
        </button>
        <button
          onClick={onConfirmar}
          className="px-6 py-3 rounded-xl font-semibold border-2 transition-colors"
          style={{ borderColor: '#2D6A4F', color: '#2D6A4F' }}
        >
          Confirmar
        </button>
      </div>
    </div>
  )
}
