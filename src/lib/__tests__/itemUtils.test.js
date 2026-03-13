import { describe, it, expect } from 'vitest'
import {
  slugifyNomeItem,
  criarIdItem,
  normalizarQuantidade,
  quantidadeValida,
} from '../itemUtils'

describe('itemUtils', () => {
  it('gera slug consistente para nomes com acento e espacos', () => {
    expect(slugifyNomeItem('  Maçã Fuji  ')).toBe('maca-fuji')
  })

  it('cria id unico quando o slug base ja existe', () => {
    const itensExistentes = [
      { id: 'maca-fuji' },
      { id: 'maca-fuji-2' },
    ]

    expect(criarIdItem('Maçã Fuji', itensExistentes)).toBe('maca-fuji-3')
  })

  it('remove caracteres nao numericos da quantidade', () => {
    expect(normalizarQuantidade('0a12')).toBe('12')
    expect(normalizarQuantidade('abc')).toBe('')
  })

  it('aceita apenas quantidades inteiras maiores que zero', () => {
    expect(quantidadeValida('1')).toBe(true)
    expect(quantidadeValida('12')).toBe(true)
    expect(quantidadeValida('0')).toBe(false)
    expect(quantidadeValida('')).toBe(false)
    expect(quantidadeValida('1.5')).toBe(false)
  })
})
