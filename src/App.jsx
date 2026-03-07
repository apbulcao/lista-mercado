import { useState, useEffect } from 'react'
import { carregarDados, CATEGORIAS, SCORE_THRESHOLD } from './lib/data'
import { recalcularScores } from './lib/score'
import { formatarParaWhatsApp } from './lib/formatWhatsApp'
import CategoriaCard from './components/CategoriaCard'
import BarraAcoes from './components/BarraAcoes'
import AdicionarItemNovo from './components/AdicionarItemNovo'
import Historico from './components/Historico'

export default function App() {
  const [dados, setDados] = useState(null)
  const [listaAtual, setListaAtual] = useState([])
  const [view, setView] = useState('lista')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarDados().then((d) => {
      const catalogoComScores = recalcularScores(d.catalogo, d.historico)
      const sugeridos = catalogoComScores
        .filter((item) => item.score >= SCORE_THRESHOLD)
        .map((item) => ({
          ...item,
          quantidade: item.quantidadePadrao,
          checked: true,
        }))
      setDados({ catalogo: catalogoComScores, historico: d.historico })
      setListaAtual(sugeridos)
      setLoading(false)
    })
  }, [])

  function handleToggle(id) {
    setListaAtual((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    )
  }

  function handleQuantidadeChange(id, novaQtd) {
    setListaAtual((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantidade: novaQtd } : item
      )
    )
  }

  function handleAdicionarDoCatalogo(catalogoId) {
    const itemCatalogo = dados.catalogo.find((c) => c.id === catalogoId)
    if (!itemCatalogo) return
    if (listaAtual.some((l) => l.id === catalogoId)) return
    setListaAtual((prev) => [
      ...prev,
      { ...itemCatalogo, quantidade: itemCatalogo.quantidadePadrao, checked: true },
    ])
  }

  function handleAdicionarNovo(nome, categoria) {
    const id = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    const novoItem = {
      id,
      nome,
      categoria,
      quantidadePadrao: '1',
      unidade: '',
      detalhes: '',
      marca: '',
      score: 0,
    }
    setDados((prev) => ({
      ...prev,
      catalogo: [...prev.catalogo, novoItem],
    }))
    setListaAtual((prev) => [
      ...prev,
      { ...novoItem, quantidade: '1', checked: true },
    ])
  }

  async function handleCopiar() {
    const checkedItens = listaAtual.filter((i) => i.checked)
    const hoje = new Date().toISOString().split('T')[0]
    const texto = formatarParaWhatsApp(checkedItens, hoje)
    await navigator.clipboard.writeText(texto)
  }

  function handleConfirmar() {
    const checkedItens = listaAtual.filter((i) => i.checked)
    const hoje = new Date().toISOString().split('T')[0]
    const novaLista = {
      data: hoje,
      itens: checkedItens.map((i) => ({
        catalogoId: i.id,
        quantidade: i.quantidade,
      })),
    }
    const novoHistorico = [...dados.historico, novaLista]
    const catalogoAtualizado = recalcularScores(dados.catalogo, novoHistorico)
    setDados({ catalogo: catalogoAtualizado, historico: novoHistorico })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAFAF8' }}>
        <span className="text-gray-400">Carregando...</span>
      </div>
    )
  }

  const hoje = new Date()
  const diaFormatado = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
        <h1 className="text-lg font-bold" style={{ color: '#1A1A1A' }}>
          Lista Mercado
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{diaFormatado}</span>
          <button
            onClick={() => setView(view === 'lista' ? 'historico' : 'lista')}
            className="text-sm font-medium px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            {view === 'lista' ? 'Historico' : 'Voltar'}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4 pb-28 space-y-4">
        {view === 'lista' ? (
          <>
            {CATEGORIAS.map((cat) => {
              const catItens = listaAtual.filter((i) => i.categoria === cat.id)
              const catalogoExtras = dados.catalogo.filter(
                (c) => c.categoria === cat.id && !listaAtual.some((l) => l.id === c.id)
              )

              if (catItens.length === 0 && catalogoExtras.length === 0) return null

              return (
                <CategoriaCard
                  key={cat.id}
                  categoria={cat}
                  itens={catItens}
                  catalogoExtras={catalogoExtras}
                  onToggle={handleToggle}
                  onQuantidadeChange={handleQuantidadeChange}
                  onAdicionarItem={handleAdicionarDoCatalogo}
                />
              )
            })}
            <AdicionarItemNovo onAdicionar={handleAdicionarNovo} />
          </>
        ) : (
          <Historico historico={dados.historico} catalogo={dados.catalogo} />
        )}
      </main>

      {/* Footer actions - only on lista view */}
      {view === 'lista' && (
        <BarraAcoes onCopiar={handleCopiar} onConfirmar={handleConfirmar} />
      )}
    </div>
  )
}
