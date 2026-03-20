const SYSTEM_PROMPT = `
You are a grocery list parser. Reply ONLY with a JSON array — no explanation, no markdown.

Each object: {"nome": "Item", "quantidadePadrao": "1", "unidade": "unidade", "categoria": "outros", "acao": "add"}

Rules:
- nome: capitalize first letter, in Portuguese
- quantidadePadrao: string with digits only ("1", "2", "500")
- unidade: one of "unidade", "kg", "g", "l", "ml"
- categoria: MUST be exactly one of: "legumes", "frutas", "carnes", "laticinios", "outros"
- acao: "add" to add items, "remove" to remove items
- Default quantity: "1", default unidade: "unidade", default acao: "add"
- Detect removal intent from words like: "tira", "remove", "sem", "não quero", "retira", "cancela"
- Dairy items (leite, queijo, iogurte, manteiga) → "laticinios"
- Meat items (carne, frango, peixe, linguica) → "carnes"
- Vegetables/greens (alface, tomate, cebola, batata) → "legumes"
- Fruits (banana, maca, laranja, uva) → "frutas"
- Everything else → "outros"

Input: "1 leite e carne"
Output: [{"nome":"Leite","quantidadePadrao":"1","unidade":"unidade","categoria":"laticinios","acao":"add"},{"nome":"Carne","quantidadePadrao":"1","unidade":"unidade","categoria":"carnes","acao":"add"}]

Input: "tira o leite e remove a cebola"
Output: [{"nome":"Leite","quantidadePadrao":"1","unidade":"unidade","categoria":"laticinios","acao":"remove"},{"nome":"Cebola","quantidadePadrao":"1","unidade":"unidade","categoria":"legumes","acao":"remove"}]
`.trim()

export function buildAiPayload(provider, text, apiKey, customUrl) {
  if (provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\nUser input: ${text}` }]
          }
        ],
        generationConfig: {
          response_mime_type: "application/json"
        }
      }
    }
  }

  // openai-compatible payload
  let url = customUrl || 'https://api.openai.com/v1/chat/completions'
  let model = 'gpt-3.5-turbo'

  if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions'
    model = 'llama-3.1-8b-instant'
  } else if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions'
    model = 'deepseek/deepseek-chat:free'
  }

  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ]
    }
  }
}

export async function parseGroceryText(text, provider, apiKey, customUrl) {
  const { url, headers, body } = buildAiPayload(provider, text, apiKey, customUrl)

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    throw new Error(`AI API error: ${res.status} - ${res.statusText}`)
  }

  const data = await res.json()
  
  try {
    let respText = ''
    if (provider === 'gemini') {
      respText = data.candidates[0].content.parts[0].text
    } else {
      respText = data.choices[0].message.content
    }
    
    // Extract first JSON array from response (handles markdown blocks and extra text)
    const match = respText.match(/\[[\s\S]*?\](?=\s*(?:```|$|\n\n))/);
    if (!match) throw new Error('No JSON array found in response')
    return JSON.parse(match[0])
  } catch (err) {
    console.error('Failed to parse AI response', err, data)
    throw new Error('AI returned invalid format')
  }
}
