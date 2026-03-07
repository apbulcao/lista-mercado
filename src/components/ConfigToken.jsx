import { useState } from 'react'

const STORAGE_KEY_TOKEN = 'lista-mercado-gh-token'
const STORAGE_KEY_REPO = 'lista-mercado-gh-repo'

export function getToken() {
  return localStorage.getItem(STORAGE_KEY_TOKEN)
}

export function getRepo() {
  return localStorage.getItem(STORAGE_KEY_REPO)
}

export default function ConfigToken({ aberto, onFechar }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY_TOKEN) || '')
  const [repo, setRepo] = useState(() => localStorage.getItem(STORAGE_KEY_REPO) || '')
  const [salvo, setSalvo] = useState(false)

  if (!aberto) return null

  const handleSalvar = () => {
    localStorage.setItem(STORAGE_KEY_TOKEN, token.trim())
    localStorage.setItem(STORAGE_KEY_REPO, repo.trim())
    setSalvo(true)
    setTimeout(() => { setSalvo(false); onFechar() }, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
        <h3 className="font-semibold text-lg mb-4" style={{ color: '#1A1A1A' }}>Configurações</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repositório GitHub</label>
            <input
              type="text"
              value={repo}
              onChange={e => setRepo(e.target.value)}
              placeholder="usuario/lista-mercado"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Token GitHub</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F]"
            />
            <p className="text-xs text-gray-400 mt-1">
              Crie em github.com/settings/tokens com permissão &quot;repo&quot;
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSalvar}
            className="flex-1 py-2.5 rounded-lg text-white font-medium text-sm transition-colors"
            style={{ backgroundColor: salvo ? '#22c55e' : '#2D6A4F' }}
          >
            {salvo ? '✓ Salvo!' : 'Salvar'}
          </button>
          <button
            onClick={onFechar}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
