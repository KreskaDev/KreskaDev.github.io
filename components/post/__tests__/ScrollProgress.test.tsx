import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScrollProgress } from '../ScrollProgress'

describe('ScrollProgress', () => {
  it('renders progressbar z aria-valuenow odpowiadającym prop percent', () => {
    render(<ScrollProgress percent={42} />)
    const bar = screen.getByRole('progressbar', { name: 'Reading progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '42')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('inner fill div ma width style = `${percent}%`', () => {
    const { container } = render(<ScrollProgress percent={73} />)
    // Inner fill — `bg-burgundy` jest unique selector w tym komponencie.
    const fill = container.querySelector('.bg-burgundy') as HTMLElement | null
    expect(fill).not.toBeNull()
    expect(fill!.style.width).toBe('73%')
  })
})
