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
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="text-sm font-medium hover:underline cursor-pointer"
          style={{ color: '#2D6A4F' }}
        >
          + Adicionar item novo
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 bg-white rounded-xl shadow-sm p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Nome do item"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
          autoFocus
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
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
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
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
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 border border-gray-300"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
