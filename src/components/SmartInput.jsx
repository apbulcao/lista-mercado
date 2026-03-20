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
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 mb-4">
      <form onSubmit={handleSubmit} className="flex gap-2 relative">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: 2 leites, pão... ou: tira o leite"
          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="px-5 py-3 bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center min-w-[4rem]"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </button>
      </form>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  )
}
