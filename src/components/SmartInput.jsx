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

      onAddItems(items)
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
          placeholder="Ex: 2 leites, pão e 500g de carne..."
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
            'Add'
          )}
        </button>
      </form>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  )
}
