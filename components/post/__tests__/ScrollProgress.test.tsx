import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScrollProgress } from '../ScrollProgress'

describe('ScrollProgress', () => {
  it('renders progressbar z aria-valuenow odpowiadającym prop percent', () => {
    render(<ScrollProgress percent={42} reducedMotion={false} />)
    const bar = screen.getByRole('progressbar', { name: 'Reading progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '42')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('inner fill div ma width style = `${percent}%`', () => {
    const { container } = render(<ScrollProgress percent={73} reducedMotion={false} />)
    // Inner fill — `bg-accent` jest unique selector w tym komponencie (v5-10 swap).
    const fill = container.querySelector('.bg-accent') as HTMLElement | null
    expect(fill).not.toBeNull()
    expect(fill!.style.width).toBe('73%')
    expect(fill!.className).toContain('transition-[width]')
  })

  it('reducedMotion=true — pomija transition-[width] na fill', () => {
    const { container } = render(<ScrollProgress percent={50} reducedMotion={true} />)
    const fill = container.querySelector('.bg-accent') as HTMLElement | null
    expect(fill).not.toBeNull()
    expect(fill!.className).not.toContain('transition-[width]')
  })
})
