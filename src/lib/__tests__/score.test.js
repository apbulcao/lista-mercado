import { describe, it, expect } from 'vitest'
import { recalcularScores } from '../score'

describe('recalcularScores', () => {
  it('item em todas as listas tem score 1.0', () => {
    const catalogo = [{ id: '1', nome: 'banana', score: 0 }]
    const historico = [
      { data: '2026-03-01', itens: [{ catalogoId: '1', quantidade: '6' }] },
      { data: '2026-03-08', itens: [{ catalogoId: '1', quantidade: '6' }] },
    ]
    const result = recalcularScores(catalogo, historico)
    expect(result[0].score).toBe(1.0)
  })

  it('item em metade das listas tem score ~0.5', () => {
    const catalogo = [{ id: '1', nome: 'tilapia', score: 0 }]
    const historico = [
      { data: '2026-03-01', itens: [{ catalogoId: '1', quantidade: '1' }] },
      { data: '2026-03-08', itens: [] },
    ]
    const result = recalcularScores(catalogo, historico)
    expect(result[0].score).toBeCloseTo(0.5, 1)
  })

  it('listas recentes pesam mais que antigas', () => {
    const catalogo = [{ id: '1', nome: 'kiwi', score: 0 }]
    const historico = [
      { data: '2026-02-01', itens: [{ catalogoId: '1', quantidade: '2' }] },
      { data: '2026-02-08', itens: [] },
      { data: '2026-02-15', itens: [] },
      { data: '2026-02-22', itens: [] },
      { data: '2026-03-01', itens: [] },
    ]
    const result = recalcularScores(catalogo, historico)
    expect(result[0].score).toBeLessThan(0.3)
  })

  it('item novo sem histórico tem score 0', () => {
    const catalogo = [{ id: '1', nome: 'novo', score: 0 }]
    const historico = [
      { data: '2026-03-01', itens: [] },
    ]
    const result = recalcularScores(catalogo, historico)
    expect(result[0].score).toBe(0)
  })
})
