import { useState } from 'react'
import { parseGroceryText } from '../lib/aiService'
import { getAiProvider, getAiUrl, getAiApiKey } from './ConfigToken'

export default function SmartInput({ onAddItems }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return

    const provider = getAiProvider()
    const apiKey = getAiApiKey()
    const url = getAiUrl()

    if (provider !== 'custom' && !apiKey) {
      setError('ℹ️ Configure a Chave de API da IA nas configurações (⚙️) primeiro.')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const items = await parseGroceryText(text, provider, apiKey, url)
      
      if (!Array.isArray(items)) {
        throw new Error('Formato retornado inválido')
      }

      const validItems = items.filter(i => i.nome && typeof i.nome === 'string')
      if (validItems.length === 0) {
        throw new Error('Nenhum item reconhecido')
      }

      onAddItems(validItems)
      setText('')
    } catch (err) {
      console.error(err)
      setError('⚠️ Falha ao entender o texto. Tente novamente ou verifique a API Key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-4 mb-2"
      style={{
        backgroundColor: '#FDFAF7',
        border: '1px solid #E5DDD0',
        boxShadow: '0 1px 4px rgba(44,40,34,0.06)',
      }}
    >
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: 2 leites, pão... ou: tira o leite"
          className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors duration-200"
          style={{
            backgroundColor: '#F2EDE4',
            border: '1px solid #E5DDD0',
            color: '#1C1A16',
          }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="px-4 py-2.5 rounded-xl font-medium text-sm text-white transition-all duration-200 disabled:opacity-40 flex items-center justify-center"
          style={{ backgroundColor: '#2D6A4F', minWidth: '3.5rem' }}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </button>
      </form>
      {error && <p className="text-xs mt-2" style={{ color: '#C96442' }}>{error}</p>}
    </div>
  )
}
