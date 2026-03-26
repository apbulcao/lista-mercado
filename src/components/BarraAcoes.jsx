import { useState } from 'react'

export default function BarraAcoes({ onCopiar, onConfirmar }) {
  const [copiado, setCopiado] = useState(false)

  const handleCopiar = async () => {
    await onCopiar()
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(242, 237, 228, 0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(229, 221, 208, 0.8)',
      }}
    >
      <div className="max-w-lg mx-auto px-4 py-3 pb-4 flex gap-2.5">
        <button
          onClick={handleCopiar}
          className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98]"
          style={{
            backgroundColor: copiado ? '#52B788' : '#2D6A4F',
            color: '#fff',
            letterSpacing: '0.01em',
          }}
        >
          {copiado ? '✓ Copiado!' : '📋 Copiar para WhatsApp'}
        </button>
        <button
          onClick={onConfirmar}
          className="px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98]"
          style={{
            border: '1.5px solid #2D6A4F',
            color: '#2D6A4F',
            backgroundColor: 'transparent',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(45,106,79,0.06)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          Confirmar
        </button>
      </div>
    </div>
  )
}
