const STORAGE_KEY_BOT_URL = 'lista-mercado-bot-url'
const STORAGE_KEY_BOT_API_KEY = 'lista-mercado-bot-api-key'

export function getBotUrl() {
  return localStorage.getItem(STORAGE_KEY_BOT_URL) || 'http://localhost:7430'
}

export function getBotApiKey() {
  return localStorage.getItem(STORAGE_KEY_BOT_API_KEY) || ''
}

export function setBotUrl(url) {
  localStorage.setItem(STORAGE_KEY_BOT_URL, url)
}

export function setBotApiKey(key) {
  localStorage.setItem(STORAGE_KEY_BOT_API_KEY, key)
}

/**
 * Fetch wrapper that prepends bot URL and adds auth header.
 * Usage: botFetch('/status') or botFetch('/iniciar-montagem', { method: 'POST', ... })
 */
export function botFetch(path, options = {}) {
  const url = getBotUrl() + path
  const apiKey = getBotApiKey()
  if (apiKey) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${apiKey}`,
    }
  }
  return fetch(url, options)
}
