const SYSTEM_PROMPT = `
You are a grocery shopping assistant. The user will provide a sentence.
Extract the ingredients and quantities. Convert them into a valid JSON array of objects.
EACH object MUST have exactly these properties:
- "nome": string (the name of the item, capitalized first letter)
- "quantidadePadrao": string (only numbers, e.g. "1", "2")
- "unidade": string (e.g. "unidade", "kg", "g", "l", "ml")
- "categoria": string (one of: "legumes", "frutas", "carnes", "laticinios", "outros")

If the user does not specify a quantity, default to "1" and "unidade".
Do NOT return anything except the JSON array. Do not use markdown blocks, just the raw JSON.
Example user input: "Vou querer 1 leite e carne"
Output: [{"nome": "Leite", "quantidadePadrao": "1", "unidade": "unidade", "categoria": "laticinios"}, {"nome": "Carne", "quantidadePadrao": "1", "unidade": "unidade", "categoria": "carnes"}]
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
    model = 'llama3-8b-8192'
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
    
    // Strip potential markdown JSON formatting blocks
    respText = respText.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(respText)
  } catch (err) {
    console.error('Failed to parse AI response', err, data)
    throw new Error('AI returned invalid format')
  }
}
