export default function ListaItem({ item, onToggle, onQuantidadeChange }) {
  const { id, nome, quantidade, unidade, detalhes, marca, checked } = item

  function handleQuantidadeChange(delta) {
    const current = parseInt(quantidade, 10)
    const base = Number.isNaN(current) || current < 1 ? 1 : current
    const next = Math.max(1, base + delta)
    onQuantidadeChange(id, String(next))
  }

  function handleInputChange(e) {
    onQuantidadeChange(id, e.target.value)
  }

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-xl transition-colors duration-150">
      {/* Checkbox */}
      <label className="relative flex items-center cursor-pointer shrink-0" style={{ minWidth: 40, minHeight: 40, justifyContent: 'center' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(id)}
          className="sr-only"
        />
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200"
          style={{
            backgroundColor: checked ? '#2D6A4F' : 'transparent',
            border: checked ? '2px solid #2D6A4F' : '2px solid #C5BAB0',
          }}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </span>
      </label>

      {/* Quantity stepper */}
      <div
        className="flex items-center shrink-0 rounded-lg overflow-hidden"
        style={{ backgroundColor: '#F2EDE4' }}
      >
        <button
          type="button"
          onClick={() => handleQuantidadeChange(-1)}
          className="flex items-center justify-center transition-colors duration-150"
          style={{ width: 26, height: 26, color: '#7A7267', background: 'transparent', border: 'none' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8E0D4'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="diminuir quantidade"
        >
          <svg width="8" height="2" viewBox="0 0 8 2" fill="currentColor">
            <rect width="8" height="2" rx="1"/>
          </svg>
        </button>
        <input
          type="text"
          value={quantidade}
          onChange={handleInputChange}
          className="text-center text-sm font-semibold focus:outline-none"
          style={{
            width: '2.2rem',
            color: '#1A1814',
            backgroundColor: 'transparent',
            height: 26,
            border: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => handleQuantidadeChange(1)}
          className="flex items-center justify-center transition-colors duration-150"
          style={{ width: 26, height: 26, color: '#7A7267', background: 'transparent', border: 'none' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8E0D4'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="aumentar quantidade"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <rect x="3" width="2" height="8" rx="1"/>
            <rect y="3" width="8" height="2" rx="1"/>
          </svg>
        </button>
      </div>

      {/* Name + details */}
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className="text-sm font-semibold"
          style={{
            color: checked ? '#1A1814' : '#A09890',
            textDecoration: checked ? 'none' : 'line-through',
            textDecorationColor: '#C5BAB0',
          }}
        >
          {nome}
          {unidade && (
            <span className="font-normal ml-1" style={{ color: '#A09890', fontSize: '0.72rem' }}>{unidade}</span>
          )}
        </span>
        {(detalhes || marca) && (
          <span className="truncate" style={{ fontSize: '0.7rem', color: '#A09890' }}>
            {[detalhes, marca].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}
