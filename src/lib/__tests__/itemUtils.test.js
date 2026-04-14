import { describe, it, expect } from 'vitest'
import {
  slugifyNomeItem,
  criarIdItem,
  normalizarQuantidade,
  quantidadeValida,
  extrairNomeDaUrl,
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

  it('trata peso com unidade colada como 1 unidade', () => {
    expect(normalizarQuantidade('100g')).toBe('1')
    expect(normalizarQuantidade('500gr')).toBe('1')
    expect(normalizarQuantidade('200ml')).toBe('1')
    expect(normalizarQuantidade('1kg')).toBe('1')
    expect(normalizarQuantidade('750ml')).toBe('1')
  })

  it('preserva contagem quando unidade vem separada por espaço', () => {
    expect(normalizarQuantidade('2 litros')).toBe('2')
    expect(normalizarQuantidade('1 bandeja')).toBe('1')
    expect(normalizarQuantidade('3 pacotes')).toBe('3')
  })

  it('extrai primeiro numero valido de strings mistas', () => {
    expect(normalizarQuantidade('1 bandeja 20')).toBe('1')
    expect(normalizarQuantidade('6')).toBe('6')
    expect(normalizarQuantidade('10')).toBe('10')
  })

  it('aceita apenas quantidades inteiras maiores que zero', () => {
    expect(quantidadeValida('1')).toBe(true)
    expect(quantidadeValida('12')).toBe(true)
    expect(quantidadeValida('0')).toBe(false)
    expect(quantidadeValida('')).toBe(false)
    expect(quantidadeValida('1.5')).toBe(false)
  })

  it('extrai nome do produto a partir da URL do Hortisabor', () => {
    expect(extrairNomeDaUrl('https://www.delivery.hortisabor.com.br/produto/35347/peito-peru-perdigao-defumado-100gr'))
      .toBe('Peito Peru Perdigao Defumado 100gr')
  })

  it('extrai nome mesmo com barra no final da URL', () => {
    expect(extrairNomeDaUrl('https://www.delivery.hortisabor.com.br/produto/10849/banana-prata-200g-aproximadamente-1-unid/'))
      .toBe('Banana Prata 200g Aproximadamente 1 Unid')
  })

  it('retorna string vazia para URL inválida ou sem slug', () => {
    expect(extrairNomeDaUrl('')).toBe('')
    expect(extrairNomeDaUrl('https://google.com')).toBe('')
    expect(extrairNomeDaUrl('texto qualquer')).toBe('')
  })
})
