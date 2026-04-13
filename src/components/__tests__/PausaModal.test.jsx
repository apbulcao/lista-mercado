import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PausaModal from '../PausaModal'

const estadoPausa = {
  estado: 'aguardando_url',
  item_atual: 'banana prata',
  item_id: 'bananas-prata',
  progresso: { feitos: 2, total: 10 },
}

describe('PausaModal', () => {
  it('exibe nome do produto pausado', () => {
    render(<PausaModal estado={estadoPausa} onFornecer={() => {}} onPular={() => {}} />)
    expect(screen.getByText('banana prata')).toBeInTheDocument()
  })

  it('exibe progresso corretamente', () => {
    render(<PausaModal estado={estadoPausa} onFornecer={() => {}} onPular={() => {}} />)
    expect(screen.getByText(/2 adicionados/)).toBeInTheDocument()
    expect(screen.getByText(/8 na fila/)).toBeInTheDocument()
  })

  it('botão Salvar chama onFornecer com item_id e url', () => {
    const onFornecer = vi.fn()
    render(<PausaModal estado={estadoPausa} onFornecer={onFornecer} onPular={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/hortisabor/i), {
      target: { value: 'https://hortisabor.com.br/banana' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar e continuar/i }))
    expect(onFornecer).toHaveBeenCalledWith('bananas-prata', 'https://hortisabor.com.br/banana')
  })

  it('botão Pular chama onPular', () => {
    const onPular = vi.fn()
    render(<PausaModal estado={estadoPausa} onFornecer={() => {}} onPular={onPular} />)
    fireEvent.click(screen.getByRole('button', { name: /Pular item/i }))
    expect(onPular).toHaveBeenCalled()
  })
})
