import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopNav } from '@/components/layout/TopNav'

// usePathname wymaga router context — stub dla isolated unit.
vi.mock('next/navigation', () => ({
  usePathname: () => '/blog/',
}))

// TopNav renderuje SearchModal + MobileMenu jako siblingi — polyfill <dialog>
// żeby useEffect.showModal() nie crashed.
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
    // Linki renderują się w desktop ul + mobile drawer (closed default) — oba w DOM.
    expect(screen.getAllByText('Home').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Blog').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('About').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText('Open search')).toBeInTheDocument()
  })

  it('oznacza active link na podstawie pathname', () => {
    render(<TopNav />)
    // Desktop ul + mobile drawer obie zawierają linki — scope do desktop <ul>.
    const blogLinks = screen.getAllByRole('link', { name: 'Blog' })
    expect(blogLinks.some(a => a.getAttribute('aria-current') === 'page')).toBe(true)
    const homeLinks = screen.getAllByRole('link', { name: 'Home' })
    expect(homeLinks.every(a => a.getAttribute('aria-current') !== 'page')).toBe(true)
  })

  it('renderuje hamburger button (md:hidden klasa, aria-label="Menu")', () => {
    render(<TopNav />)
    const hamburger = screen.getByRole('button', { name: 'Menu' })
    expect(hamburger).toBeInTheDocument()
    // Class string assertion (jsdom matchMedia: false → visibility nie sprawdzamy;
    // class string serializowana w DOM, plan §3.1 + Notes).
    expect(hamburger.className).toContain('md:hidden')
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')
    expect(hamburger).toHaveAttribute('aria-controls', 'mobile-menu-dialog')
  })

  it('klik hamburger otwiera MobileMenu drawer (aria-expanded → true)', async () => {
    const user = userEvent.setup()
    render(<TopNav />)
    const hamburger = screen.getByRole('button', { name: 'Menu' })
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')
    await user.click(hamburger)
    expect(hamburger).toHaveAttribute('aria-expanded', 'true')
    // Dialog z aria-label="Main menu" pojawia się w DOM (showModal polyfill ustawia open).
    expect(screen.getByRole('dialog', { name: 'Main menu' })).toBeInTheDocument()
  })
})
