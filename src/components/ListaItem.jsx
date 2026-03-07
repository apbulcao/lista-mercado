export default function ListaItem({ item, onToggle, onQuantidadeChange }) {
  const { id, nome, quantidade, unidade, detalhes, marca, checked } = item

  function handleQuantidadeChange(delta) {
    const current = parseInt(quantidade, 10) || 0
    const next = Math.max(0, current + delta)
    onQuantidadeChange(id, String(next))
  }

  function handleInputChange(e) {
    onQuantidadeChange(id, e.target.value)
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg transition-opacity duration-200 ${
        checked ? '' : 'opacity-50'
      }`}
    >
      {/* Checkbox */}
      <label className="relative flex items-center cursor-pointer min-w-[44px] min-h-[44px] justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(id)}
          className="sr-only peer"
        />
        <span
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${
            checked
              ? 'bg-[#2D6A4F] border-[#2D6A4F]'
              : 'border-gray-400 bg-white'
          }`}
        >
          {checked && (
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </span>
      </label>

      {/* Quantity control */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleQuantidadeChange(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-bold leading-none transition-colors duration-200 hover:bg-gray-200 active:bg-gray-300"
          aria-label="diminuir quantidade"
        >
          -
        </button>
        <input
          type="text"
          value={quantidade}
          onChange={handleInputChange}
          className="w-[3ch] text-center text-sm font-medium border border-gray-300 rounded px-0.5"
        />
        <button
          type="button"
          onClick={() => handleQuantidadeChange(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-bold leading-none transition-colors duration-200 hover:bg-gray-200 active:bg-gray-300"
          aria-label="aumentar quantidade"
        >
          +
        </button>
        {unidade && (
          <span className="text-xs text-gray-500 ml-0.5">{unidade}</span>
        )}
      </div>

      {/* Name + details */}
      <div className="flex flex-col min-w-0">
        <span className={`font-semibold text-sm ${checked ? '' : 'line-through'}`} style={{ color: '#1A1A1A' }}>
          {nome}
        </span>
        {(detalhes || marca) && (
          <span className="text-xs text-[#6B7280] truncate">
            {[detalhes, marca].filter(Boolean).join(' \u00b7 ')}
          </span>
        )}
      </div>
    </div>
  )
}
