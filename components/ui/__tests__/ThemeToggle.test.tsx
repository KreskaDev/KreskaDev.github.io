import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

function renderWithTheme() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

describe('ThemeToggle', () => {
  it('ma spójne wymiary buttonu (CLS-safe: placeholder + final dzielą w-9 h-9)', () => {
    // RTL render fires useEffect synchronously w jsdom, więc nie zobaczymy placeholdera w snapshot.
    // Verification placeholder dimensions = code review (lines `if (!mounted) return <button className="w-9 h-9" ...>`).
    renderWithTheme()
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('w-9', 'h-9')
  })

  it('cykluje theme dark → light → system → dark', async () => {
    const user = userEvent.setup()
    renderWithTheme()
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toMatch(/dark.+light/i)
    await user.click(btn)
    expect(btn.getAttribute('aria-label')).toMatch(/light.+system/i)
    await user.click(btn)
    expect(btn.getAttribute('aria-label')).toMatch(/system.+dark/i)
    await user.click(btn)
    expect(btn.getAttribute('aria-label')).toMatch(/dark.+light/i)
  })
})
