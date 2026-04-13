import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Catalogo from '../Catalogo'

const catalogo = [
  { id: 'banana', nome: 'banana prata', categoria: 'frutas', urlHortisabor: '' },
  { id: 'cebola', nome: 'cebola nacional', categoria: 'legumes', urlHortisabor: 'https://hortisabor.com.br/cebola' },
  { id: 'cenoura', nome: 'cenoura', categoria: 'legumes', urlHortisabor: 'https://hortisabor.com.br/cenoura' },
]

describe('Catalogo', () => {
  it('exibe contagem de cobertura correta', () => {
    render(<Catalogo catalogo={catalogo} onUrlChange={() => {}} />)
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('item sem URL aparece na coluna esquerda', () => {
    render(<Catalogo catalogo={catalogo} onUrlChange={() => {}} />)
    const semUrl = screen.getByText(/Sem URL/)
    expect(semUrl).toBeInTheDocument()
    expect(screen.getAllByText('banana prata').length).toBeGreaterThan(0)
  })

  it('item com URL aparece na coluna direita', () => {
    render(<Catalogo catalogo={catalogo} onUrlChange={() => {}} />)
    const comUrl = screen.getByText(/Com URL/)
    expect(comUrl).toBeInTheDocument()
    expect(screen.getAllByText('cebola nacional').length).toBeGreaterThan(0)
  })

  it('clicar em item sem URL abre campo de edição', () => {
    render(<Catalogo catalogo={catalogo} onUrlChange={() => {}} />)
    fireEvent.click(screen.getByText('banana prata'))
    expect(screen.getByPlaceholderText(/Cole o link/i)).toBeInTheDocument()
  })

  it('salvar URL chama onUrlChange com id e url', () => {
    const onUrlChange = vi.fn()
    render(<Catalogo catalogo={catalogo} onUrlChange={onUrlChange} />)
    fireEvent.click(screen.getByText('banana prata'))
    const input = screen.getByPlaceholderText(/Cole o link/i)
    fireEvent.change(input, { target: { value: 'https://hortisabor.com.br/banana' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }))
    expect(onUrlChange).toHaveBeenCalledWith('banana', 'https://hortisabor.com.br/banana')
  })

  it('pressionar Escape fecha o campo de edição', () => {
    render(<Catalogo catalogo={catalogo} onUrlChange={() => {}} />)
    fireEvent.click(screen.getByText('banana prata'))
    fireEvent.keyDown(screen.getByPlaceholderText(/Cole o link/i), { key: 'Escape' })
    expect(screen.queryByPlaceholderText(/Cole o link/i)).not.toBeInTheDocument()
  })

  it('exibe mensagem quando todos os itens têm URL', () => {
    const catalogoCompleto = [
      { id: 'cebola', nome: 'cebola nacional', categoria: 'legumes', urlHortisabor: 'https://hortisabor.com.br/cebola' },
    ]
    render(<Catalogo catalogo={catalogoCompleto} onUrlChange={() => {}} />)
    expect(screen.getByText('Todos os itens mapeados!')).toBeInTheDocument()
  })
})
