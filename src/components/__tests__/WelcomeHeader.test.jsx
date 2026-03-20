import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import WelcomeHeader from '../WelcomeHeader'

describe('WelcomeHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders "Bom dia" in the morning', () => {
    const morning = new Date(2026, 2, 20, 9, 0, 0)
    vi.setSystemTime(morning)
    render(<WelcomeHeader nome="Apo" />)
    expect(screen.getByText(/Bom dia, Apo!/i)).toBeInTheDocument()
  })

  it('renders "Boa tarde" in the afternoon', () => {
    const afternoon = new Date(2026, 2, 20, 15, 0, 0)
    vi.setSystemTime(afternoon)
    render(<WelcomeHeader nome="Apo" />)
    expect(screen.getByText(/Boa tarde, Apo!/i)).toBeInTheDocument()
  })

  it('renders "Boa noite" at night', () => {
    const night = new Date(2026, 2, 20, 20, 0, 0)
    vi.setSystemTime(night)
    render(<WelcomeHeader nome="Apo" />)
    expect(screen.getByText(/Boa noite, Apo!/i)).toBeInTheDocument()
  })
})
