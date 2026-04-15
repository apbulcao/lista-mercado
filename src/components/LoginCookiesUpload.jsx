import { useState } from 'react'
import { botFetch } from '../lib/botApi'

export default function LoginCookiesUpload({ onSuccess, onClose }) {
  const [cookiesText, setCookiesText] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handleEnviar() {
    if (!cookiesText.trim()) return
    setEnviando(true)
    setErro('')
    try {
      const res = await botFetch('/upload-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies_text: cookiesText }),
      })
      const data = await res.json()
      if (res.ok && data.status === 'ok') {
        setSucesso(true)
        setTimeout(() => onSuccess(), 1500)
      } else {
        setErro(data.detail || 'Erro ao enviar cookies')
      }
    } catch {
      setErro('Não foi possível conectar ao bot')
    } finally {
      setEnviando(false)
    }
  }

  if (sucesso) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: '#2D6A4F' }}>Login atualizado!</p>
        <p className="text-xs" style={{ color: '#7A7267' }}>Cookies salvos. Tente pedir novamente.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold" style={{ color: '#1A1814' }}>Login necessário</p>
      <div className="text-xs space-y-1" style={{ color: '#7A7267' }}>
        <p>1. Abra <a href="https://www.delivery.hortisabor.com.br/login/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#2D6A4F' }}>hortisabor.com.br</a> e faça login</p>
        <p>2. Use a extensão de cookies para exportar (formato Netscape)</p>
        <p>3. Cole abaixo e clique Enviar</p>
      </div>
      <textarea
        value={cookiesText}
        onChange={e => setCookiesText(e.target.value)}
        placeholder="# Netscape HTTP Cookie File&#10;.hortisabor.com.br  ..."
        rows={4}
        className="w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none resize-none"
        style={{ border: '1px solid #E5DDD0', backgroundColor: '#F2EDE4', color: '#1C1A16' }}
      />
      {erro && <p className="text-xs" style={{ color: '#B91C1C' }}>{erro}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleEnviar}
          disabled={enviando || !cookiesText.trim()}
          className="flex-1 py-2 rounded-lg text-white font-medium text-xs transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#2D6A4F' }}
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-lg text-xs"
          style={{ color: '#7A7267' }}
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
