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
    render(<WelcomeHeader />)
    expect(screen.getByRole('heading', { name: /Bom dia/i })).toBeInTheDocument()
  })

  it('renders "Boa tarde" in the afternoon', () => {
    const afternoon = new Date(2026, 2, 20, 15, 0, 0)
    vi.setSystemTime(afternoon)
    render(<WelcomeHeader />)
    expect(screen.getByRole('heading', { name: /Boa tarde/i })).toBeInTheDocument()
  })

  it('renders "Boa noite" at night', () => {
    const night = new Date(2026, 2, 20, 20, 0, 0)
    vi.setSystemTime(night)
    render(<WelcomeHeader />)
    expect(screen.getByRole('heading', { name: /Boa noite/i })).toBeInTheDocument()
  })
})
