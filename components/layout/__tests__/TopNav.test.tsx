import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopNav } from '@/components/layout/TopNav'

// usePathname wymaga router context — stub dla isolated unit.
vi.mock('next/navigation', () => ({
  usePathname: () => '/blog/',
}))

// TopNav renderuje SearchModal jako sibling — polyfill <dialog> żeby useEffect nie crashed.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})

describe('TopNav', () => {
  it('renderuje trzy sekcje', () => {
    render(<TopNav />)
    expect(screen.getByText('What is the truth?')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Blog')).toBeInTheDocument()
    expect(screen.getByText('About')).toBeInTheDocument()
    expect(screen.getByLabelText('Open search')).toBeInTheDocument()
  })

  it('oznacza active link na podstawie pathname', () => {
    render(<TopNav />)
    const blogLink = screen.getByText('Blog').closest('a')
    expect(blogLink).toHaveAttribute('aria-current', 'page')
    const homeLink = screen.getByText('Home').closest('a')
    expect(homeLink).not.toHaveAttribute('aria-current')
  })
})
