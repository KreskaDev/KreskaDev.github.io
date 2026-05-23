import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hero } from '@/components/home/Hero'

describe('Hero', () => {
  it('renders display title', () => {
    render(<Hero />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'What is the truth?' }),
    ).toBeInTheDocument()
  })

  it('renders tagline (default copy)', () => {
    render(<Hero />)
    expect(screen.getByText(/probability, reasoning/i)).toBeInTheDocument()
  })

  it('renders SVG with a11y label', () => {
    render(<Hero />)
    // role="img" + aria-label — sprawdza że SVG nie jest decoracyjny tylko semantyczny
    expect(screen.getByRole('img', { name: /probability rings/i })).toBeInTheDocument()
  })
})
