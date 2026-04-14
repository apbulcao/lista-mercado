import { useState, useEffect, useRef } from 'react'
import {
  carregarDados,
  salvarDados,
  salvarDadosPendentes,
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
import ConfigToken, { getToken, getRepo, getAiProvider, getAiApiKey, getAiUrl } from './components/ConfigToken'
import { botFetch } from './lib/botApi'
import WelcomeHeader from './components/WelcomeHeader'
import SmartInput from './components/SmartInput'
import FeedbackModal from './components/FeedbackModal'
import Catalogo from './components/Catalogo'
import PausaModal from './components/PausaModal'

export default function App() {
  const [dados, setDados] = useState(null)
  const [listaAtual, setListaAtual] = useState([])
  const [view, setView] = useState('lista')
  const [configAberto, setConfigAberto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState('')
  const [botOnline, setBotOnline] = useState(false)
  const [pedidoStatus, setPedidoStatus] = useState(null)
  // pedidoStatus: null | 'loading' | 'reauth' | 'error' | { url, encontrados, nao_encontrados }
  const pollingRef = useRef(null)

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
          observacoes: item.observacaoPadrao || '',
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
    // Lê params de setup do hash da URL (#setup&token=X&repo=Y&groq=Z)
    // Injetados pelo iniciar.command para configurar o app automaticamente
    const hash = window.location.hash
    if (hash.startsWith('#setup')) {
      const params = new URLSearchParams(hash.slice(1))
      const token = params.get('token')
      const repo = params.get('repo')
      const groq = params.get('groq')
      if (token) localStorage.setItem('lista-mercado-gh-token', token)
      if (repo) localStorage.setItem('lista-mercado-gh-repo', repo)
      if (groq) {
        localStorage.setItem('lista-mercado-ai-provider', 'groq')
        localStorage.setItem('lista-mercado-ai-key', groq)
      }
      // Limpa o hash para não expor tokens na URL
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    carregarApp()
  }, [])

  useEffect(() => {
    function checarBot() {
      botFetch('/status')
        .then(r => setBotOnline(r.ok))
        .catch(() => setBotOnline(false))
    }
    checarBot()
    const intervalo = setInterval(checarBot, 5000)
    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
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

  async function handleUrlHortisaborChange(itemId, url) {
    const novoCatalogo = dados.catalogo.map((c) =>
      c.id === itemId ? { ...c, urlHortisabor: url } : c
    )
    const novosDados = { catalogo: novoCatalogo, historico: dados.historico }
    setDados(novosDados)
    setListaAtual((prev) => prev.map((i) => i.id === itemId ? { ...i, urlHortisabor: url } : i))
    const token = getToken()
    const repo = getRepo()
    if (token && repo) {
      try { await salvarDados(novosDados, token, repo) } catch (_) {}
    }
  }

  function handleObservacoesChange(id, obs) {
    setListaAtual((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, observacoes: obs } : item
      )
    )
  }

  function handleAdicionarDoCatalogo(catalogoId) {
    const itemCatalogo = dados.catalogo.find((c) => c.id === catalogoId)
    if (!itemCatalogo) return
    if (listaAtual.some((l) => l.id === catalogoId)) return
    setListaAtual((prev) => [
      ...prev,
      { ...itemCatalogo, quantidade: itemCatalogo.quantidadePadrao, observacoes: itemCatalogo.observacaoPadrao || '', checked: true },
    ])
  }

  function handleAdicionarNovo(nome, categoria, urlHortisabor = '') {
    const slugBase = slugifyNomeItem(nome)
    if (!slugBase) {
      alert('Digite um nome de item valido.')
      return false
    }

    const itemExistente = dados.catalogo.find(
      (item) => item.id === slugBase || slugifyNomeItem(item.nome) === slugBase
    )

    if (itemExistente) {
      if (listaAtual.some((l) => l.id === itemExistente.id)) {
        alert(`"${itemExistente.nome}" ja esta na lista.`)
        return false
      }
      handleAdicionarDoCatalogo(itemExistente.id)
      return true
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
      urlHortisabor: urlHortisabor || '',
    }
    setDados((prev) => ({
      ...prev,
      catalogo: [...prev.catalogo, novoItem],
    }))
    setListaAtual((prev) => [
      ...prev,
      { ...novoItem, quantidade: '1', checked: true },
    ])
    return true
  }

  function handleSmartInputItems(items) {
    const itensParaAdicionar = items.filter(i => i.acao !== 'remove')
    const itensParaRemover = items.filter(i => i.acao === 'remove')

    // Remove items (partial match: "leite" matches "leite integral")
    if (itensParaRemover.length > 0) {
      const slugsRemover = itensParaRemover.map(i => slugifyNomeItem(i.nome))
      setListaAtual((prev) =>
        prev.filter((l) => {
          const slugItem = slugifyNomeItem(l.nome)
          return !slugsRemover.some(sr => slugItem === sr || slugItem.includes(sr))
        })
      )
    }

    // Add items
    if (itensParaAdicionar.length > 0) {
      const novosItensLista = []
      const novosItensCatalogo = []

      itensParaAdicionar.forEach((item) => {
        const slugBase = slugifyNomeItem(item.nome)
        if (!slugBase) return

        const itemExistente = dados.catalogo.find(
          (c) => c.id === slugBase || slugifyNomeItem(c.nome) === slugBase
        )

        if (itemExistente) {
          if (!listaAtual.some((l) => l.id === itemExistente.id)) {
            novosItensLista.push({
              ...itemExistente,
              quantidade: item.quantidadePadrao || itemExistente.quantidadePadrao,
              observacoes: itemExistente.observacaoPadrao || '',
              checked: true,
            })
          }
        } else {
          const id = criarIdItem(item.nome, [...dados.catalogo, ...novosItensCatalogo])
          const categoriasValidas = CATEGORIAS.map(c => c.id)
          const novoItem = {
            id,
            nome: item.nome,
            categoria: categoriasValidas.includes(item.categoria) ? item.categoria : 'outros',
            quantidadePadrao: item.quantidadePadrao || '1',
            unidade: item.unidade || '',
            detalhes: '',
            marca: '',
            score: 0,
          }
          novosItensCatalogo.push(novoItem)
          novosItensLista.push({ ...novoItem, quantidade: novoItem.quantidadePadrao, checked: true })
        }
      })

      if (novosItensCatalogo.length > 0) {
        setDados((prev) => ({ ...prev, catalogo: [...prev.catalogo, ...novosItensCatalogo] }))
      }
      if (novosItensLista.length > 0) {
        setListaAtual((prev) => [...prev, ...novosItensLista])
      }
    }
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

    // Add new items to catalogo and update quantidadePadrao/observacaoPadrao of existing ones
    const novosCatalogo = [...dados.catalogo]
    for (const item of checkedItens) {
      const existente = novosCatalogo.find((c) => c.id === item.id)
      if (existente) {
        existente.quantidadePadrao = item.quantidade
        existente.observacaoPadrao = (item.observacoes || '').trim() || existente.observacaoPadrao || ''
      } else {
        novosCatalogo.push({
          id: item.id,
          nome: item.nome,
          categoria: item.categoria,
          quantidadePadrao: item.quantidade,
          observacaoPadrao: (item.observacoes || '').trim(),
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

    // Salva snapshot local como buffer (protege contra refresh antes do deploy)
    salvarDadosPendentes(novosDados)

    // Try to save to GitHub
    const token = getToken()
    const repo = getRepo()
    if (token && repo) {
      try {
        await salvarDados(novosDados, token, repo)
        alert('Lista confirmada e salva!')
      } catch (err) {
        alert(`Lista confirmada e salva neste dispositivo, mas houve erro ao salvar no GitHub: ${err.message}`)
      }
    } else {
      alert('Lista confirmada e salva neste dispositivo. Configure o GitHub nas ⚙️ para sincronizar permanentemente.')
    }
  }

  async function handlePedirHortisabor() {
    const checkedItens = getItensSelecionadosValidos()
    if (!checkedItens) return

    setPedidoStatus('loading')

    try {
      const res = await botFetch('/iniciar-montagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: checkedItens.map((i) => ({
            id: i.id,
            nome: i.nome,
            quantidade: i.quantidade,
            marca: i.marca || '',
            detalhes: i.detalhes || '',
            url_hortisabor: i.urlHortisabor || '',
            observacoes: i.observacoes || '',
          })),
          ai_provider: getAiProvider(),
          ai_api_key: getAiApiKey(),
          ai_url: getAiUrl(),
        }),
      })

      const data = await res.json()

      if (data.status === 'reauth_needed') {
        setPedidoStatus('reauth')
        return
      }

      // Iniciar polling
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await botFetch('/status')
          const statusData = await statusRes.json()
          const montagem = statusData.montagem

          if (montagem.estado === 'concluido') {
            clearInterval(pollingRef.current)
            setPedidoStatus({
              url: 'https://www.delivery.hortisabor.com.br/carrinho/',
              encontrados: montagem.encontrados,
              nao_encontrados: montagem.nao_encontrados,
            })
          } else if (montagem.estado === 'aguardando_url') {
            setPedidoStatus(montagem)
          } else if (montagem.estado === 'erro') {
            clearInterval(pollingRef.current)
            setPedidoStatus('error')
          }
        } catch {
          clearInterval(pollingRef.current)
          setPedidoStatus('error')
        }
      }, 1000)

    } catch {
      setPedidoStatus('error')
    }
  }

  async function handleFornecerUrl(itemId, url) {
    try {
      await handleUrlHortisaborChange(itemId, url)
      await botFetch('/fornecer-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, url }),
      })
      setPedidoStatus('loading')
    } catch {
      setPedidoStatus('error')
    }
  }

  async function handlePularItem() {
    try {
      await botFetch('/fornecer-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: '', url: '' }),
      })
      setPedidoStatus('loading')
    } catch {
      setPedidoStatus('error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: '#F2EDE4' }}>
        <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2D6A4F] rounded-full animate-spin" />
        <span className="text-sm" style={{ color: '#7A7267' }}>Carregando...</span>
      </div>
    )
  }

  if (erroCarregamento) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#F2EDE4' }}>
        <div className="max-w-sm w-full rounded-2xl shadow-sm p-5 space-y-4 text-center" style={{ backgroundColor: '#FDFAF7', border: '1px solid #E5DDD0' }}>
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

  const totalChecked = listaAtual.filter((i) => i.checked).length
  const contsPorCategoria = Object.fromEntries(
    CATEGORIAS.map((cat) => [cat.id, listaAtual.filter((i) => i.categoria === cat.id).length])
  )

  const hora = new Date().getHours()
  const saudacao = hora >= 18 || hora < 5 ? 'Boa noite' : hora >= 12 ? 'Boa tarde' : 'Bom dia'
  const SABEDORIAS_SIDEBAR = [
    'Organização no mercado é tempo na vida.',
    'Lista feita com calma evita carrinho com drama.',
    'Quem planeja a semana, domina o carrinho.',
  ]
  const diaDoAno = Math.floor((hoje - new Date(hoje.getFullYear(), 0, 0)) / 86400000)
  const fraseSidebar = SABEDORIAS_SIDEBAR[diaDoAno % SABEDORIAS_SIDEBAR.length]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EDE8DF' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-5 flex items-center justify-between"
        style={{
          height: '52px',
          backgroundColor: 'rgba(249,246,241,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid #E0D9CE',
        }}
      >
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 500, color: '#2D6A4F' }}>
          Lista Mercado
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: '#7A7267' }}>{diaFormatado}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setView('lista')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-200"
              style={{
                border: '1px solid #E0D9CE',
                color: view === 'lista' ? '#2D6A4F' : '#5A5449',
                backgroundColor: view === 'lista' ? '#E0EDE7' : 'transparent',
              }}
            >
              Lista
            </button>
            <button
              onClick={() => setView('catalogo')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-200"
              style={{
                border: '1px solid #E0D9CE',
                color: view === 'catalogo' ? '#2D6A4F' : '#5A5449',
                backgroundColor: view === 'catalogo' ? '#E0EDE7' : 'transparent',
              }}
            >
              Catálogo
            </button>
            <button
              onClick={() => setView('historico')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-200"
              style={{
                border: '1px solid #E0D9CE',
                color: view === 'historico' ? '#2D6A4F' : '#5A5449',
                backgroundColor: view === 'historico' ? '#E0EDE7' : 'transparent',
              }}
            >
              Histórico
            </button>
          </div>
          <button
            onClick={() => setConfigAberto(true)}
            className="text-sm px-2 py-1.5 rounded-lg transition-colors duration-200"
            style={{ border: '1px solid #E0D9CE', color: '#5A5449', backgroundColor: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E0D9CE'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Layout responsivo */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 md:grid md:gap-6" style={{ gridTemplateColumns: '240px 1fr' }}>

        {/* Sidebar — desktop only */}
        <aside
          className="hidden md:block py-7 pr-2"
          style={{ position: 'sticky', top: '52px', height: 'calc(100vh - 52px)', overflowY: 'auto' }}
        >
          {/* Greeting */}
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase mb-1.5" style={{ color: '#2D6A4F', letterSpacing: '0.06em' }}>
              {hora >= 18 || hora < 5 ? '🌙' : hora >= 12 ? '☀️' : '🌤️'} {saudacao}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700, color: '#1A1814', lineHeight: 1.2, marginBottom: '8px' }}>
              Vamos montar<br />a lista de hoje?
            </h2>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.8rem', fontStyle: 'italic', color: '#7A7267', lineHeight: 1.5 }}>
              "{fraseSidebar}"
            </p>
          </div>

          {/* Divisor */}
          <div style={{ height: '1px', backgroundColor: '#E0D9CE', margin: '16px 0' }} />

          {/* Resumo */}
          <div className="text-xs font-semibold uppercase mb-2.5" style={{ color: '#7A7267', letterSpacing: '0.07em' }}>Resumo</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <div className="rounded-xl p-2.5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0D9CE' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700, color: '#2D6A4F', lineHeight: 1 }}>{totalChecked}</div>
              <div className="text-xs mt-0.5" style={{ color: '#7A7267' }}>selecionados</div>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0D9CE' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700, color: '#2D6A4F', lineHeight: 1 }}>{listaAtual.length}</div>
              <div className="text-xs mt-0.5" style={{ color: '#7A7267' }}>itens total</div>
            </div>
          </div>

          {/* Navegação por categoria */}
          <div className="text-xs font-semibold uppercase mb-2.5" style={{ color: '#7A7267', letterSpacing: '0.07em' }}>Categorias</div>
          <nav className="flex flex-col gap-1">
            {CATEGORIAS.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium"
                style={{ color: contsPorCategoria[cat.id] > 0 ? '#1A1814' : '#B0AA9F' }}
              >
                <span>{cat.emoji}</span>
                <span className="truncate flex-1">{cat.nome}</span>
                {contsPorCategoria[cat.id] > 0 && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E0EDE7', color: '#2D6A4F' }}>
                    {contsPorCategoria[cat.id]}
                  </span>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="py-5 pb-32 space-y-3 min-w-0">
          {view === 'lista' && (
            <>
              {/* Greeting mobile only */}
              <div className="md:hidden">
                <WelcomeHeader />
              </div>

              <SmartInput onAddItems={handleSmartInputItems} />

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
                    onUrlChange={handleUrlHortisaborChange}
                    onObservacoesChange={handleObservacoesChange}
                  />
                )
              })}
              <AdicionarItemNovo onAdicionar={handleAdicionarNovo} />
            </>
          )}
          {view === 'catalogo' && dados && (
            <Catalogo catalogo={dados.catalogo} onUrlChange={handleUrlHortisaborChange} />
          )}
          {view === 'historico' && (
            <Historico historico={dados.historico} catalogo={dados.catalogo} />
          )}
        </main>
      </div>

      {view === 'lista' && (
        <BarraAcoes
          onCopiar={handleCopiar}
          onConfirmar={handleConfirmar}
          botOnline={botOnline}
          onPedirHortisabor={handlePedirHortisabor}
        />
      )}

      {typeof pedidoStatus === 'object' && pedidoStatus !== null && pedidoStatus.estado === 'aguardando_url' && (
        <PausaModal
          estado={pedidoStatus}
          onFornecer={handleFornecerUrl}
          onPular={handlePularItem}
        />
      )}

      {pedidoStatus && !(typeof pedidoStatus === 'object' && pedidoStatus !== null && pedidoStatus.estado === 'aguardando_url') && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center pb-28 px-4"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-4 shadow-xl space-y-3"
            style={{
              backgroundColor: '#FDFAF7',
              border: '1px solid #E0D9CE',
              pointerEvents: 'all',
            }}
          >
            {pedidoStatus === 'loading' && (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-[#2D6A4F] rounded-full animate-spin flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium" style={{ color: '#1A1814' }}>Montando carrinho…</span>
                  <p className="text-xs mt-0.5" style={{ color: '#7A7267' }}>O bot está buscando cada item. Pode levar 1-2 min.</p>
                </div>
              </div>
            )}

            {pedidoStatus === 'reauth' && (
              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: '#1A1814' }}>Login necessário</p>
                <p className="text-xs" style={{ color: '#7A7267' }}>
                  Uma janela do Chrome abriu. Faça login no Hortisabor e clique em Pedir novamente.
                </p>
                <button
                  onClick={() => setPedidoStatus(null)}
                  className="text-xs font-medium"
                  style={{ color: '#7A7267' }}
                >
                  Fechar
                </button>
              </div>
            )}

            {pedidoStatus === 'error' && (
              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: '#B91C1C' }}>Serviço não encontrado</p>
                <p className="text-xs" style={{ color: '#7A7267' }}>Abra iniciar.command (Mac) ou iniciar.bat (Windows).</p>
                <button
                  onClick={() => setPedidoStatus(null)}
                  className="text-xs font-medium"
                  style={{ color: '#7A7267' }}
                >
                  Fechar
                </button>
              </div>
            )}

            {pedidoStatus !== null && typeof pedidoStatus === 'object' && pedidoStatus.url && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: '#1A1814' }}>Carrinho pronto!</p>
                  <button
                    onClick={() => setPedidoStatus(null)}
                    className="text-xs font-medium"
                    style={{ color: '#7A7267' }}
                  >
                    Fechar
                  </button>
                </div>
                <a
                  href={pedidoStatus.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: '#2D6A4F' }}
                >
                  🛒 Abrir carrinho no Hortisabor
                </a>
                {pedidoStatus.nao_encontrados.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#7A7267' }}>
                      Não encontrados ({pedidoStatus.nao_encontrados.length}):
                    </p>
                    <p className="text-xs" style={{ color: '#B0AA9F' }}>
                      {pedidoStatus.nao_encontrados.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <FeedbackModal />
      <ConfigToken aberto={configAberto} onFechar={() => setConfigAberto(false)} />
    </div>
  )
}
