import { useState } from 'react'
import { salvarFeedback } from '../lib/feedbackService'
import { getToken, getRepo } from './ConfigToken'

export default function FeedbackModal() {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, success, error
  const [erro, setErro] = useState('')

  const handleEnviar = async () => {
    if (!texto.trim()) return

    setStatus('loading')
    setErro('')
    
    try {
      const token = getToken()
      const repo = getRepo()
      await salvarFeedback(texto, token, repo)
      setStatus('success')
      setTexto('')
      setTimeout(() => {
        setAberto(false)
        setStatus('idle')
      }, 2000)
    } catch (err) {
      console.error(err)
      setStatus('error')
      setErro(err.message || 'Falha ao enviar feedback')
    }
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setAberto(true)}
          className="bg-white text-gray-700 shadow-md border border-gray-100 hover:bg-gray-50 rounded-full px-4 py-3 flex items-center gap-2 font-medium text-sm transition-transform hover:scale-105"
        >
          <span>📝</span>
          Feedback
        </button>
      </div>

      {aberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 my-8">
            <h3 className="font-semibold text-lg mb-2" style={{ color: '#1A1A1A' }}>O que você achou?</h3>
            <p className="text-sm text-gray-500 mb-4">Sua opinião ajuda a melhorar o aplicativo.</p>

            <textarea
              className="w-full h-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] resize-none"
              placeholder="Ex: O app travou ao adicionar leite, ou seria legal se..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={status === 'loading' || status === 'success'}
            />

            {status === 'error' && (
              <p className="text-sm text-red-500 mt-2">{erro}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleEnviar}
                disabled={status === 'loading' || status === 'success' || !texto.trim()}
                className="flex-1 py-2.5 rounded-lg text-white font-medium text-sm transition-colors flex justify-center items-center disabled:opacity-50"
                style={{ backgroundColor: status === 'success' ? '#22c55e' : '#2D6A4F' }}
              >
                {status === 'loading' ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : status === 'success' ? (
                  '✓ Enviado!'
                ) : (
                  'Enviar Feedback'
                )}
              </button>
              <button
                onClick={() => setAberto(false)}
                disabled={status === 'loading'}
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
