import { useState, useEffect } from 'react'
import {
  carregarDados,
  salvarDados,
  salvarDadosPendentes,
  limparDadosPendentes,
  CATEGORIAS,
  SCORE_THRESHOLD,
} from './lib/data'
import { recalcularScores } from './lib/score'
import { formatarParaWhatsApp } from './lib/formatWhatsApp'
import { criarIdItem, quantidadeValida, slugifyNomeItem, normalizarQuantidade } from './lib/itemUtils'
import CategoriaCard from './components/CategoriaCard'
import BarraAcoes from './components/BarraAcoes'
import AdicionarItemNovo from './components/AdicionarItemNovo'
import Historico from './components/Historico'
import ConfigToken, { getToken, getRepo } from './components/ConfigToken'

export default function App() {
  const [dados, setDados] = useState(null)
  const [listaAtual, setListaAtual] = useState([])
  const [view, setView] = useState('lista')
  const [configAberto, setConfigAberto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState('')

  async function carregarApp() {
    setLoading(true)
    setErroCarregamento('')

    try {
      const d = await carregarDados()
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
    } catch (err) {
      setErroCarregamento(err.message || 'Nao foi possivel carregar os dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarApp()
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
        item.id === id ? { ...item, quantidade: normalizarQuantidade(novaQtd) } : item
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
    const slugBase = slugifyNomeItem(nome)
    if (!slugBase) {
      alert('Digite um nome de item valido.')
      return
    }

    const itemExistente = dados.catalogo.find(
      (item) => item.id === slugBase || slugifyNomeItem(item.nome) === slugBase
    )

    if (itemExistente) {
      handleAdicionarDoCatalogo(itemExistente.id)
      return
    }

    const id = criarIdItem(nome, dados.catalogo)
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

  function getItensSelecionadosValidos() {
    const checkedItens = listaAtual.filter((item) => item.checked)
    if (checkedItens.length === 0) {
      alert('Selecione pelo menos um item para continuar.')
      return null
    }

    const itemInvalido = checkedItens.find((item) => !quantidadeValida(item.quantidade))
    if (itemInvalido) {
      alert(`Quantidade invalida para "${itemInvalido.nome}". Use um numero maior que zero.`)
      return null
    }

    return checkedItens
  }

  async function handleCopiar() {
    const checkedItens = getItensSelecionadosValidos()
    if (!checkedItens) return

    const hoje = new Date().toISOString().split('T')[0]
    const texto = formatarParaWhatsApp(checkedItens, hoje)
    await navigator.clipboard.writeText(texto)
  }

  async function handleConfirmar() {
    const checkedItens = getItensSelecionadosValidos()
    if (!checkedItens) return

    const novaLista = {
      id: `lista-${Date.now()}`,
      data: new Date().toISOString().slice(0, 10),
      itens: checkedItens.map((i) => ({ catalogoId: i.id, quantidade: i.quantidade })),
    }

    // Add new items to catalogo
    const novosCatalogo = [...dados.catalogo]
    for (const item of checkedItens) {
      if (!novosCatalogo.some((c) => c.id === item.id)) {
        novosCatalogo.push({
          id: item.id,
          nome: item.nome,
          categoria: item.categoria,
          quantidadePadrao: item.quantidade,
          unidade: '',
          detalhes: item.detalhes || '',
          marca: item.marca || '',
          score: 0,
        })
      }
    }

    const novoHistorico = [...dados.historico, novaLista]
    const catalogoAtualizado = recalcularScores(novosCatalogo, novoHistorico)
    const novosDados = { catalogo: catalogoAtualizado, historico: novoHistorico }

    // Update local state
    setDados(novosDados)

    // Try to save to GitHub
    const token = getToken()
    const repo = getRepo()
    if (token && repo) {
      try {
        await salvarDados(novosDados, token, repo)
        limparDadosPendentes()
        alert('Lista confirmada e salva!')
      } catch (err) {
        salvarDadosPendentes(novosDados)
        alert(`Lista confirmada e salva neste dispositivo, mas houve erro ao salvar no GitHub: ${err.message}`)
      }
    } else {
      salvarDadosPendentes(novosDados)
      alert('Lista confirmada e salva neste dispositivo. Configure o GitHub nas ⚙️ para sincronizar permanentemente.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2D6A4F] rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Carregando...</span>
      </div>
    )
  }

  if (erroCarregamento) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-sm w-full bg-white rounded-xl shadow-sm p-5 space-y-4 text-center">
          <div className="space-y-2">
            <h1 className="text-lg font-bold" style={{ color: '#1A1A1A' }}>
              Lista Mercado
            </h1>
            <p className="text-sm text-gray-600">{erroCarregamento}</p>
          </div>
          <button
            onClick={carregarApp}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors duration-200 hover:opacity-90"
            style={{ backgroundColor: '#2D6A4F' }}
          >
            Tentar novamente
          </button>
        </div>
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
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors duration-200 active:bg-gray-100"
          >
            {view === 'lista' ? 'Historico' : 'Voltar'}
          </button>
          <button
            onClick={() => setConfigAberto(true)}
            className="text-sm px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors duration-200 active:bg-gray-100"
          >
            ⚙️
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

      <ConfigToken aberto={configAberto} onFechar={() => setConfigAberto(false)} />
    </div>
  )
}
