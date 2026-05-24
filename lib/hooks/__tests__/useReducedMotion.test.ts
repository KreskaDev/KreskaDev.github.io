import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stateful per-test mock — globalny mock w `vitest.setup.ts` ma
// `addEventListener: vi.fn()` (spy bez storage). Tu potrzebny prawdziwy
// registry listenerów żeby symulować change-event. Override per `beforeEach`,
// żeby NIE perturbować v5-05 baseline setup.
let currentMatches = false
const listeners = new Set<() => void>()

beforeEach(() => {
  vi.resetModules()
  currentMatches = false
  listeners.clear()
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() {
      return currentMatches
    },
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_event: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_event: string, cb: () => void) => listeners.delete(cb),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

describe('useReducedMotion', () => {
  it('returns false initially (matches SSR snapshot)', async () => {
    const { useReducedMotion } = await import('../useReducedMotion')
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('re-renders when matchMedia change-event fires', async () => {
    const { useReducedMotion } = await import('../useReducedMotion')
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)

    act(() => {
      currentMatches = true
      listeners.forEach(cb => cb())
    })

    expect(result.current).toBe(true)
  })

  it('removes listener on unmount without crash', async () => {
    const { useReducedMotion } = await import('../useReducedMotion')
    const { unmount } = renderHook(() => useReducedMotion())
    expect(listeners.size).toBe(1)
    expect(() => unmount()).not.toThrow()
    expect(listeners.size).toBe(0)
  })
})
