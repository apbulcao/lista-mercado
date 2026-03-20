export async function salvarFeedback(texto, token, repo) {
  if (!token || !repo) {
    throw new Error('Configure o token e repositório nas configurações (⚙️) primeiro.')
  }

  const dataLocal = new Date().toISOString()
  const novoFeedback = {
    data: dataLocal,
    mensagem: texto,
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/public/feedback_log.json`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  }

  let sha = ''
  let content = []

  // Get existing file
  const respGet = await fetch(apiUrl, { headers })
  if (respGet.ok) {
    const fileData = await respGet.json()
    sha = fileData.sha
    try {
      const decodedContent = atob(fileData.content)
      content = JSON.parse(decodeURIComponent(escape(decodedContent)))
    } catch (e) {
      console.error('Erro ao decodificar feedback anterior, iniciando novo array')
      content = []
    }
  } else if (respGet.status !== 404) {
    throw new Error(`Erro ao verificar feedback_log.json: ${respGet.status}`)
  }

  content.push(novoFeedback)

  // Save via GitHub
  const utf8Bytes = unescape(encodeURIComponent(JSON.stringify(content, null, 2)))
  const base64Content = btoa(utf8Bytes)

  const body = {
    message: 'docs: adicina novo feedback de usuario',
    content: base64Content,
  }
  if (sha) body.sha = sha

  const respPut = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })

  if (!respPut.ok) {
    throw new Error(`Erro ao salvar no GitHub: ${respPut.status}`)
  }
}
