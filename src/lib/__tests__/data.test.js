import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  carregarDados,
  salvarDadosPendentes,
  limparDadosPendentes,
} from '../data'

describe('data', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('retorna dados remotos quando o fetch funciona', async () => {
    const dadosRemotos = { catalogo: [{ id: '1' }], historico: [] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => dadosRemotos,
    }))

    await expect(carregarDados()).resolves.toEqual(dadosRemotos)
  })

  it('usa snapshot pendente quando ele e mais novo que o remoto', async () => {
    const dadosPendentes = {
      catalogo: [{ id: '1' }],
      historico: [{ id: 'lista-1', data: '2026-03-13', itens: [] }],
    }
    const dadosRemotos = { catalogo: [{ id: '1' }], historico: [] }

    salvarDadosPendentes(dadosPendentes)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => dadosRemotos,
    }))

    await expect(carregarDados()).resolves.toEqual(dadosPendentes)
  })

  it('usa snapshot pendente se o fetch falhar', async () => {
    const dadosPendentes = {
      catalogo: [{ id: '1' }],
      historico: [{ id: 'lista-1', data: '2026-03-13', itens: [] }],
    }

    salvarDadosPendentes(dadosPendentes)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('falhou')))

    await expect(carregarDados()).resolves.toEqual(dadosPendentes)
  })

  it('remove snapshot pendente ao limpar dados locais', () => {
    salvarDadosPendentes({ catalogo: [], historico: [] })
    limparDadosPendentes()

    expect(localStorage.getItem('lista-mercado-dados-pendentes')).toBeNull()
  })
})
