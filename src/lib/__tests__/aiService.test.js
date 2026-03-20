import { describe, it, expect } from 'vitest'
import { buildAiPayload } from '../aiService'

describe('aiService', () => {
  describe('buildAiPayload', () => {
    const text = '2 leites e pão'
    
    it('builds correct payload for gemini', () => {
      const payload = buildAiPayload('gemini', text, '', '')
      expect(payload.url).toContain('generativelanguage.googleapis.com')
      expect(payload.body.contents[0].parts[0].text).toContain(text)
    })

    it('builds correct payload for openai-compatible providers (groq)', () => {
      const payload = buildAiPayload('groq', text, 'fake-key', '')
      expect(payload.url).toBe('https://api.groq.com/openai/v1/chat/completions')
      expect(payload.headers.Authorization).toBe('Bearer fake-key')
      expect(payload.body.messages[1].content).toBe(text)
      expect(payload.body.model).toBe('llama3-8b-8192')
    })
    
    it('builds correct payload for openrouter', () => {
      const payload = buildAiPayload('openrouter', text, 'fake-key', '')
      expect(payload.url).toBe('https://openrouter.ai/api/v1/chat/completions')
      expect(payload.body.model).toBe('deepseek/deepseek-chat:free')
    })
  })
})
