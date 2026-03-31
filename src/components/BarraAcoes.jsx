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
      className="fixed z-20"
      style={{
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      <div
        className="flex gap-2 items-center"
        style={{
          background: 'rgba(249,246,241,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid #E0D9CE',
          borderRadius: '100px',
          padding: '7px 10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <button
          onClick={handleCopiar}
          className="flex items-center gap-2 font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
          style={{
            backgroundColor: copiado ? '#52B788' : '#2D6A4F',
            color: '#fff',
            border: 'none',
            borderRadius: '100px',
            padding: '9px 20px',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {copiado ? '✓ Copiado!' : '📋 Copiar para WhatsApp'}
        </button>
        <button
          onClick={onConfirmar}
          className="font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
          style={{
            backgroundColor: 'transparent',
            color: '#1A1814',
            border: '1.5px solid #E0D9CE',
            borderRadius: '100px',
            padding: '9px 20px',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E0D9CE'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          Confirmar
        </button>
      </div>
    </div>
  )
}
