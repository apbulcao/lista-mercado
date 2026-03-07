import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ListaItem from '../ListaItem'

describe('ListaItem', () => {
  const item = {
    id: '1', nome: 'bananas prata', quantidade: '10',
    detalhes: 'para consumo em 2 dias', marca: '', checked: true,
  }

  it('renderiza nome e quantidade', () => {
    render(<ListaItem item={item} onToggle={() => {}} onQuantidadeChange={() => {}} />)
    expect(screen.getByText('bananas prata')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })

  it('chama onToggle ao clicar checkbox', () => {
    const onToggle = vi.fn()
    render(<ListaItem item={item} onToggle={onToggle} onQuantidadeChange={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith('1')
  })

  it('item desmarcado tem classe de opacidade', () => {
    const unchecked = { ...item, checked: false }
    const { container } = render(
      <ListaItem item={unchecked} onToggle={() => {}} onQuantidadeChange={() => {}} />
    )
    expect(container.firstChild).toHaveClass('opacity-50')
  })
})
