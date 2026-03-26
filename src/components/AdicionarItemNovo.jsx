import { useState } from 'react'
import { CATEGORIAS } from '../lib/data'

export default function AdicionarItemNovo({ onAdicionar }) {
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('outros')
  const [aberto, setAberto] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) return
    onAdicionar(nomeTrimmed, categoria)
    setNome('')
    setCategoria('outros')
    setAberto(false)
  }

  if (!aberto) {
    return (
      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="text-xs font-medium cursor-pointer py-3 transition-colors duration-200"
          style={{ color: '#9A8F83' }}
        >
          + item não listado acima
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-2xl p-4" style={{ backgroundColor: '#FDFAF7', border: '1px solid #E5DDD0' }}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Nome do item"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors duration-200"
          style={{ color: '#1C1A16', border: '1px solid #E5DDD0', backgroundColor: '#F2EDE4' }}
          autoFocus
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors duration-200"
          style={{ color: '#1C1A16', border: '1px solid #E5DDD0', backgroundColor: '#F2EDE4' }}
        >
          {CATEGORIAS.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.emoji} {cat.nome}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: '#2D6A4F' }}
          >
            Adicionar
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(false)
              setNome('')
              setCategoria('outros')
            }}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200"
            style={{ color: '#7A7267', border: '1px solid #E5DDD0', backgroundColor: 'transparent' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
