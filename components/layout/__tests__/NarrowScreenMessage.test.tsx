import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NarrowScreenMessage } from '@/components/layout/NarrowScreenMessage'

describe('NarrowScreenMessage', () => {
  it('renderuje alert z EN copy', () => {
    render(<NarrowScreenMessage />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert.textContent).toContain('larger screens')
  })

  it('ma klasę md:hidden — visibility kontrolowana CSS-em', () => {
    const { container } = render(<NarrowScreenMessage />)
    expect(container.firstChild).toHaveClass('md:hidden')
  })
})
