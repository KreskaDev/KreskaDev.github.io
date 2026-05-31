import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { PaletteToggle } from '@/components/ui/PaletteToggle'

// next-themes persists choice w localStorage; bez clearu poprzedni test wycieka
// state do następnego (defaultTheme jest tylko bootstrap dla pustego storage).
beforeEach(() => {
  localStorage.clear()
})

function renderWithTheme(defaultTheme = 'dark-cool') {
  return render(
    <ThemeProvider
      attribute="class"
      themes={['light-warm', 'dark-warm', 'light-cool', 'dark-cool']}
      defaultTheme={defaultTheme}
      enableSystem={false}
    >
      <PaletteToggle />
    </ThemeProvider>,
  )
}

describe('PaletteToggle (v5-10 dual-palette runtime toggle)', () => {
  it('ma spójne wymiary buttonu (CLS-safe: placeholder + final dzielą w-11 h-11 = 44px AAA)', () => {
    renderWithTheme()
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('w-11', 'h-11')
  })

  it('initial render w default dark-cool: aria-label switch to warm, aria-pressed=false', () => {
    renderWithTheme('dark-cool')
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toMatch(/switch to warm/i)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('click w default dark-cool flipuje do dark-warm: aria-label switch to cool, aria-pressed=true', async () => {
    const user = userEvent.setup()
    renderWithTheme('dark-cool')
    const btn = screen.getByRole('button')
    await user.click(btn)
    expect(btn.getAttribute('aria-label')).toMatch(/switch to cool/i)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('zachowuje mode segment przy palette flip (light-cool → light-warm)', async () => {
    const user = userEvent.setup()
    renderWithTheme('light-cool')
    const btn = screen.getByRole('button')
    // Initial: palette=cool, mode=light, aria-label switch to warm
    expect(btn.getAttribute('aria-label')).toMatch(/switch to warm/i)
    await user.click(btn)
    // Post-click: palette=warm, mode=light (zachowane), aria-label switch to cool
    expect(btn.getAttribute('aria-label')).toMatch(/switch to cool/i)
  })

  it('cykluje cool ↔ warm dwukrotnie z powrotem do oryginalnej palety', async () => {
    const user = userEvent.setup()
    renderWithTheme('dark-cool')
    const btn = screen.getByRole('button')
    await user.click(btn) // dark-warm
    await user.click(btn) // dark-cool
    expect(btn.getAttribute('aria-label')).toMatch(/switch to warm/i)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('renderuje 2 SVG circle elementy (lewa warm + prawa cool)', () => {
    renderWithTheme()
    const btn = screen.getByRole('button')
    const circles = btn.querySelectorAll('svg circle')
    expect(circles.length).toBe(2)
  })
})
