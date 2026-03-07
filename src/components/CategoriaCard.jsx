import { useState, useRef, useEffect } from 'react'
import ListaItem from './ListaItem'

export default function CategoriaCard({
  categoria,
  itens,
  catalogoExtras,
  onToggle,
  onQuantidadeChange,
  onAdicionarItem,
}) {
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [filtro, setFiltro] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAberto(false)
        setFiltro('')
      }
    }
    if (dropdownAberto) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownAberto])

  const extrasFiltrados = catalogoExtras.filter((item) =>
    item.nome.toLowerCase().includes(filtro.toLowerCase())
  )

  function handleAdicionarClick(catalogoId) {
    onAdicionarItem(catalogoId)
    setDropdownAberto(false)
    setFiltro('')
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="text-lg">{categoria.emoji}</span>
        <span className="text-sm font-semibold tracking-wider text-[#2D6A4F]">
          {categoria.nome.toUpperCase()}
        </span>
      </div>

      {/* Items */}
      <div className="px-2 pb-1">
        {itens.map((item) => (
          <ListaItem
            key={item.id}
            item={item}
            onToggle={onToggle}
            onQuantidadeChange={onQuantidadeChange}
          />
        ))}
      </div>

      {/* Adicionar */}
      {catalogoExtras.length > 0 && (
        <div className="relative px-4 pb-4" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownAberto(!dropdownAberto)}
            className="text-sm text-[#2D6A4F] font-medium hover:underline cursor-pointer"
          >
            + Adicionar
          </button>

          {dropdownAberto && (
            <div className="absolute left-4 right-4 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-auto">
              {catalogoExtras.length > 3 && (
                <div className="p-2 border-b border-gray-100">
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-600"
                    autoFocus
                  />
                </div>
              )}
              {extrasFiltrados.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">
                  Nenhum item encontrado
                </div>
              ) : (
                extrasFiltrados.map((extra) => (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => handleAdicionarClick(extra.id)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    {extra.nome}
                    {extra.quantidadePadrao && (
                      <span className="text-xs text-gray-400 ml-1">
                        ({extra.quantidadePadrao})
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
