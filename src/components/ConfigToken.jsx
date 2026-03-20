import { useState } from 'react'

const STORAGE_KEY_TOKEN = 'lista-mercado-gh-token'
const STORAGE_KEY_REPO = 'lista-mercado-gh-repo'
const STORAGE_KEY_AI_PROVIDER = 'lista-mercado-ai-provider'
const STORAGE_KEY_AI_URL = 'lista-mercado-ai-url'
const STORAGE_KEY_AI_KEY = 'lista-mercado-ai-key'

export function getToken() { return localStorage.getItem(STORAGE_KEY_TOKEN) }
export function getRepo() { return localStorage.getItem(STORAGE_KEY_REPO) }
export function getAiProvider() { return localStorage.getItem(STORAGE_KEY_AI_PROVIDER) || 'gemini' }
export function getAiUrl() { return localStorage.getItem(STORAGE_KEY_AI_URL) || '' }
export function getAiApiKey() { return localStorage.getItem(STORAGE_KEY_AI_KEY) || '' }

export default function ConfigToken({ aberto, onFechar }) {
  const [token, setToken] = useState(() => getToken() || '')
  const [repo, setRepo] = useState(() => getRepo() || '')
  const [aiProvider, setAiProvider] = useState(() => getAiProvider())
  const [aiUrl, setAiUrl] = useState(() => getAiUrl())
  const [aiKey, setAiKey] = useState(() => getAiApiKey())
  const [salvo, setSalvo] = useState(false)

  if (!aberto) return null

  const handleSalvar = () => {
    localStorage.setItem(STORAGE_KEY_TOKEN, token.trim())
    localStorage.setItem(STORAGE_KEY_REPO, repo.trim())
    localStorage.setItem(STORAGE_KEY_AI_PROVIDER, aiProvider)
    localStorage.setItem(STORAGE_KEY_AI_URL, aiUrl.trim())
    localStorage.setItem(STORAGE_KEY_AI_KEY, aiKey.trim())
    
    setSalvo(true)
    setTimeout(() => { setSalvo(false); onFechar() }, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 my-8">
        <h3 className="font-semibold text-lg mb-4" style={{ color: '#1A1A1A' }}>Configurações</h3>

        <div className="space-y-4">
          <div className="pb-3 border-b border-gray-100">
            <h4 className="text-sm font-bold text-[#2D6A4F] mb-3">Persistência (GitHub)</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Repositório GitHub</label>
                <input type="text" value={repo} onChange={e => setRepo(e.target.value)} placeholder="usuario/lista-mercado" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Token GitHub</label>
                <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]" />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[#2D6A4F] mb-3">Smart Input (IA)</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Provedor de IA</label>
                <select value={aiProvider} onChange={e => setAiProvider(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]">
                  <option value="gemini">Google Gemini (Grátis)</option>
                  <option value="groq">Groq / Llama 3 (Grátis)</option>
                  <option value="openrouter">OpenRouter (Múltiplos)</option>
                  <option value="custom">Customizado (OpenAI-compatível)</option>
                </select>
              </div>
              {aiProvider === 'custom' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">URL da API</label>
                  <input type="text" value={aiUrl} onChange={e => setAiUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">API Key da IA</label>
                <input type="password" value={aiKey} onChange={e => setAiKey(e.target.value)} placeholder="Sua chave de API" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={handleSalvar} className="flex-1 py-2.5 rounded-lg text-white font-medium text-sm transition-colors" style={{ backgroundColor: salvo ? '#22c55e' : '#2D6A4F' }}>
            {salvo ? '✓ Salvo!' : 'Salvar'}
          </button>
          <button onClick={onFechar} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm transition-colors hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
