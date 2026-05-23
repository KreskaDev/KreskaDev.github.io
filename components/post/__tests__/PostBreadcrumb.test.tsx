import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostBreadcrumb } from '../PostBreadcrumb'

describe('PostBreadcrumb', () => {
  it('renders link with parent slug and title', () => {
    render(<PostBreadcrumb parentSlug="pozytywny-wynik" parentTitle="Pozytywny wynik" />)
    const link = screen.getByRole('link', { name: /Pozytywny wynik/i })
    // Next 16 Link strippa trailing slash w jsdom; regex tolerant na oba kształty.
    expect(link.getAttribute('href')).toMatch(/^\/posts\/pozytywny-wynik\/?$/)
  })

  it('exposes breadcrumb landmark', () => {
    render(<PostBreadcrumb parentSlug="x" parentTitle="X" />)
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
  })
})
