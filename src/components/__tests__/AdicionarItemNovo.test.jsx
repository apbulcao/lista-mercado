import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AdicionarItemNovo from '../AdicionarItemNovo'

describe('AdicionarItemNovo', () => {
  it('mostra botão para abrir o formulário', () => {
    render(<AdicionarItemNovo onAdicionar={() => {}} />)
    expect(screen.getByText(/item não listado/i)).toBeInTheDocument()
  })

  it('abre formulário ao clicar no botão', () => {
    render(<AdicionarItemNovo onAdicionar={() => {}} />)
    fireEvent.click(screen.getByText(/item não listado/i))
    expect(screen.getByPlaceholderText('Nome do item')).toBeInTheDocument()
  })

  it('campo URL é exibido quando formulário está aberto', () => {
    render(<AdicionarItemNovo onAdicionar={() => {}} />)
    fireEvent.click(screen.getByText(/item não listado/i))
    expect(screen.getByPlaceholderText(/Cole o link do produto/i)).toBeInTheDocument()
  })

  it('chama onAdicionar com nome, categoria e url ao submeter', () => {
    const onAdicionar = vi.fn()
    render(<AdicionarItemNovo onAdicionar={onAdicionar} />)
    fireEvent.click(screen.getByText(/item não listado/i))
    fireEvent.change(screen.getByPlaceholderText('Nome do item'), { target: { value: 'cream cheese' } })
    fireEvent.change(screen.getByPlaceholderText(/Cole o link do produto/i), {
      target: { value: 'https://hortisabor.com.br/cream-cheese' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }))
    expect(onAdicionar).toHaveBeenCalledWith('cream cheese', 'outros', 'https://hortisabor.com.br/cream-cheese')
  })

  it('chama onAdicionar com url vazia quando campo URL não preenchido', () => {
    const onAdicionar = vi.fn()
    render(<AdicionarItemNovo onAdicionar={onAdicionar} />)
    fireEvent.click(screen.getByText(/item não listado/i))
    fireEvent.change(screen.getByPlaceholderText('Nome do item'), { target: { value: 'cream cheese' } })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }))
    expect(onAdicionar).toHaveBeenCalledWith('cream cheese', 'outros', '')
  })
})
