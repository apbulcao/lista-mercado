import { describe, it, expect } from 'vitest'
import { formatarParaWhatsApp } from '../formatWhatsApp'

describe('formatarParaWhatsApp', () => {
  it('formata lista no estilo do histórico', () => {
    const itens = [
      { nome: 'cebolas', quantidade: '4', categoria: 'legumes', detalhes: '', marca: '' },
      { nome: 'bananas prata', quantidade: '10', categoria: 'frutas', detalhes: 'para consumo em 2 dias', marca: '' },
      { nome: 'filé de peito', quantidade: '1', unidade: 'kg', categoria: 'carnes', detalhes: '', marca: 'Korin' },
    ]
    const result = formatarParaWhatsApp(itens, '2026-03-07')
    expect(result).toContain('*Lista 07/03*')
    expect(result).toContain('*LEGUMES E SALADA*')
    expect(result).toContain('- 4 cebolas')
    expect(result).toContain('*FRUTAS*')
    expect(result).toContain('- 10 bananas prata para consumo em 2 dias')
    expect(result).toContain('*CARNES*')
    expect(result).toContain('- 1 kg filé de peito Korin')
  })

  it('não adiciona espaço extra quando item não tem unidade', () => {
    const itens = [
      { nome: 'cebolas', quantidade: '4', unidade: '', categoria: 'legumes', detalhes: '', marca: '' },
    ]
    const result = formatarParaWhatsApp(itens, '2026-03-07')
    expect(result).toContain('- 4 cebolas')
    expect(result).not.toContain('- 4  cebolas')
  })

  it('omite categorias sem itens', () => {
    const itens = [
      { nome: 'cebolas', quantidade: '4', categoria: 'legumes', detalhes: '', marca: '' },
    ]
    const result = formatarParaWhatsApp(itens, '2026-03-07')
    expect(result).not.toContain('*FRUTAS*')
    expect(result).not.toContain('*CARNES*')
  })
})
