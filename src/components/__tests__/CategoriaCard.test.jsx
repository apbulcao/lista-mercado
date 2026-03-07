import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CategoriaCard from '../CategoriaCard'

describe('CategoriaCard', () => {
  const categoria = { id: 'frutas', nome: 'Frutas', emoji: '🍎' }
  const itens = [
    { id: '1', nome: 'bananas prata', quantidade: '10', detalhes: 'para consumo em 2 dias', marca: '', checked: true },
    { id: '2', nome: 'morango', quantidade: '2', detalhes: '', marca: '', checked: true },
  ]
  const catalogoExtras = [
    { id: '3', nome: 'kiwi', quantidadePadrao: '2', detalhes: '', marca: '' },
  ]

  it('renderiza emoji e nome da categoria', () => {
    render(<CategoriaCard categoria={categoria} itens={itens} catalogoExtras={catalogoExtras} onToggle={() => {}} onQuantidadeChange={() => {}} onAdicionarItem={() => {}} />)
    expect(screen.getByText('🍎')).toBeInTheDocument()
    expect(screen.getByText('FRUTAS')).toBeInTheDocument()
  })

  it('renderiza todos os itens da categoria', () => {
    render(<CategoriaCard categoria={categoria} itens={itens} catalogoExtras={catalogoExtras} onToggle={() => {}} onQuantidadeChange={() => {}} onAdicionarItem={() => {}} />)
    expect(screen.getByText('bananas prata')).toBeInTheDocument()
    expect(screen.getByText('morango')).toBeInTheDocument()
  })

  it('botão adicionar mostra itens extras ao clicar', () => {
    render(<CategoriaCard categoria={categoria} itens={itens} catalogoExtras={catalogoExtras} onToggle={() => {}} onQuantidadeChange={() => {}} onAdicionarItem={() => {}} />)
    fireEvent.click(screen.getByText('+ Adicionar'))
    expect(screen.getByText('kiwi')).toBeInTheDocument()
  })
})
