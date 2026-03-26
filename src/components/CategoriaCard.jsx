import { useState, useRef, useEffect } from 'react'
import ListaItem from './ListaItem'

const CATEGORIA_CORES = {
  legumes: '#52B788',
  frutas: '#F4895F',
  carnes: '#C96442',
  laticinios: '#C9A84C',
  outros: '#9AA5B4',
}

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
  const cor = CATEGORIA_CORES[categoria.id] || '#9AA5B4'

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
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        backgroundColor: '#FDFAF7',
        border: '1px solid #E5DDD0',
        boxShadow: '0 1px 4px rgba(44,40,34,0.06)',
      }}
    >
      {/* Barra colorida lateral */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: cor, borderRadius: '4px 0 0 4px' }}
      />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2 pl-5">
        <span className="text-base">{categoria.emoji}</span>
        <span
          className="text-xs font-semibold"
          style={{ color: cor, letterSpacing: '0.08em' }}
        >
          {categoria.nome.toUpperCase()}
        </span>
      </div>

      {/* Items */}
      <div className="px-2 pb-1 pl-3">
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
        <div className="relative px-4 pb-4 pl-5" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownAberto(!dropdownAberto)}
            className="text-xs font-medium transition-colors duration-200"
            style={{ color: cor, opacity: 0.8 }}
          >
            + Adicionar
          </button>

          {dropdownAberto && (
            <div
              className="absolute left-4 right-4 mt-1 rounded-xl z-10 max-h-80 overflow-auto"
              style={{
                backgroundColor: '#FDFAF7',
                border: '1px solid #E5DDD0',
                boxShadow: '0 8px 24px rgba(44,40,34,0.12)',
              }}
            >
              <div className="p-2 sticky top-0" style={{ backgroundColor: '#FDFAF7', borderBottom: '1px solid #F0E8DB' }}>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="w-full text-sm rounded-lg px-2.5 py-1.5 focus:outline-none transition-colors duration-200"
                  style={{ border: '1px solid #E5DDD0', backgroundColor: '#F7F2EB', color: '#1C1A16' }}
                  autoFocus
                />
              </div>
              {extrasFiltrados.length === 0 ? (
                <div className="px-3 py-2 text-sm" style={{ color: '#9A8F83' }}>
                  Nenhum item encontrado
                </div>
              ) : (
                extrasFiltrados.map((extra) => (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => handleAdicionarClick(extra.id)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors duration-150 cursor-pointer"
                    style={{ color: '#1C1A16' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = `${cor}10`}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>{extra.nome}</span>
                    {extra.quantidadePadrao && extra.quantidadePadrao !== '1' && (
                      <span className="text-xs ml-2 shrink-0" style={{ color: '#9A8F83' }}>
                        {extra.quantidadePadrao}
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
