import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackToTop } from '../BackToTop'

// `requestAnimationFrame` w jsdom istnieje ale jest async wobec testu — używamy
// sync stub żeby setState po `onScroll()` initial sync był obserwowalny w
// pierwszym tick'u testu.
function stubRafSync() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    cb(0)
    return 0
  })
}

beforeEach(() => {
  stubRafSync()
  // `window.scrollTo` w jsdom rzuca "not implemented" — stub żeby click handler
  // wywołał spy zamiast crashować.
  vi.stubGlobal('scrollTo', vi.fn())
  // Reset scrollY przed każdym testem (jsdom domyślnie 0, ale defensive).
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BackToTop', () => {
  it('default invisible — opacity-0 + pointer-events-none przy scrollY=0', () => {
    render(<BackToTop />)
    const button = screen.getByRole('button', { name: 'Back to top' })
    expect(button.className).toContain('opacity-0')
    expect(button.className).toContain('pointer-events-none')
    expect(button.className).not.toContain('opacity-100')
  })

  it('staje się visible po scrollY > 300', () => {
    render(<BackToTop />)
    act(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 400, writable: true })
      window.dispatchEvent(new Event('scroll'))
    })
    const button = screen.getByRole('button', { name: 'Back to top' })
    expect(button.className).toContain('opacity-100')
    expect(button.className).not.toContain('opacity-0 pointer-events-none')
  })

  it('click → window.scrollTo({top:0, behavior:"smooth"})', async () => {
    const user = userEvent.setup()
    render(<BackToTop />)
    const button = screen.getByRole('button', { name: 'Back to top' })
    await user.click(button)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})
