import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

// next-themes persists choice w localStorage; bez clearu poprzedni test wycieka
// state do następnego (defaultTheme jest tylko bootstrap dla pustego storage).
beforeEach(() => {
  localStorage.clear()
})

function renderWithTheme() {
  return render(
    <ThemeProvider
      attribute="class"
      themes={['light-warm', 'dark-warm', 'light-cool', 'dark-cool']}
      defaultTheme="dark-cool"
      enableSystem={false}
    >
      <ThemeToggle />
    </ThemeProvider>,
  )
}

describe('ThemeToggle (v5-10 2-state cycle, dual-palette aware)', () => {
  it('ma spójne wymiary buttonu (CLS-safe: placeholder + final dzielą w-11 h-11 = 44px AAA)', () => {
    // Bump z w-9 (36px) → w-11 (44px) w v5-08 dla WCAG 2.1 AAA tap target compliance (ADR-035).
    renderWithTheme()
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('w-11', 'h-11')
  })

  it('cykluje mode dark ↔ light, zachowując palette segment (per ADR-041)', async () => {
    const user = userEvent.setup()
    renderWithTheme()
    const btn = screen.getByRole('button')
    // Initial: defaultTheme="dark-cool" → mode=dark, palette=cool
    expect(btn.getAttribute('aria-label')).toMatch(/dark.+light/i)
    await user.click(btn)
    // Post-click: mode=light, palette=cool (preserved)
    expect(btn.getAttribute('aria-label')).toMatch(/light.+dark/i)
    await user.click(btn)
    // Cycle back: dark-cool
    expect(btn.getAttribute('aria-label')).toMatch(/dark.+light/i)
  })

  it('NIE oferuje system theme (per ADR-041 amends ADR-012 — deprecated w dual-palette mode)', async () => {
    const user = userEvent.setup()
    renderWithTheme()
    const btn = screen.getByRole('button')
    await user.click(btn)
    await user.click(btn)
    await user.click(btn)
    // Po 3 clickach: dark → light → dark → light. NIE pojawi się "system".
    expect(btn.getAttribute('aria-label')).not.toMatch(/system/i)
  })
})
