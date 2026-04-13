import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BarraAcoes from '../BarraAcoes'

describe('BarraAcoes', () => {
  it('renderiza botão Copiar para WhatsApp', () => {
    render(<BarraAcoes onCopiar={() => {}} onConfirmar={() => {}} botOnline={false} onPedirHortisabor={() => {}} />)
    expect(screen.getByText('📋 Copiar para WhatsApp')).toBeInTheDocument()
  })

  it('oculta botão Hortisabor quando botOnline=false', () => {
    render(<BarraAcoes onCopiar={() => {}} onConfirmar={() => {}} botOnline={false} onPedirHortisabor={() => {}} />)
    expect(screen.queryByText(/Pedir no Hortisabor/i)).not.toBeInTheDocument()
  })

  it('exibe botão Hortisabor quando botOnline=true', () => {
    render(<BarraAcoes onCopiar={() => {}} onConfirmar={() => {}} botOnline={true} onPedirHortisabor={() => {}} />)
    expect(screen.getByText(/Pedir no Hortisabor/i)).toBeInTheDocument()
  })

  it('chama onPedirHortisabor ao clicar no botão Hortisabor', () => {
    const handler = vi.fn()
    render(<BarraAcoes onCopiar={() => {}} onConfirmar={() => {}} botOnline={true} onPedirHortisabor={handler} />)
    fireEvent.click(screen.getByText(/Pedir no Hortisabor/i))
    expect(handler).toHaveBeenCalledOnce()
  })
})
