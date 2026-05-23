import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '@/components/ui/EmptyState'

describe('EmptyState', () => {
  it('renders message without CTA', () => {
    render(<EmptyState message="Nothing here." />)
    expect(screen.getByText('Nothing here.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders message + CTA link', () => {
    render(<EmptyState message="Empty filter." cta={{ label: 'Clear', href: '/blog/' }} />)
    expect(screen.getByText('Empty filter.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Clear' })
    // Next 16 Link normalizuje trailing slash w jsdom — match obie formy (carry-over v5-03).
    expect(link.getAttribute('href')).toMatch(/^\/blog\/?$/)
  })
})
