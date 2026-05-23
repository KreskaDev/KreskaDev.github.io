import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// RTL auto-cleanup wymaga vitest `globals: true` — my mamy `globals: false` (explicit imports).
// Bez tego DOM nie jest sprzątany między testami → multiple-element queries fail.
afterEach(() => {
  cleanup()
})

// jsdom nie implementuje matchMedia — wymagane przez next-themes (system theme detection).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ResizeObserver mock z FIXED size — Recharts ResponsiveContainer mierzy parent przez
// ResizeObserver i przy zerowym rozmiarze (jsdom default) NIE renderuje chart elements.
// Mock reportuje fixed 600x320 żeby chart faktycznie zarysował <path>, <line>, <circle>
// do DOM dla testowych assertions (v5-05 WC5).
class ResizeObserverMock {
  private callback: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb
  }
  observe(target: Element) {
    queueMicrotask(() => {
      this.callback(
        [
          {
            target,
            contentRect: {
              width: 600,
              height: 320,
              top: 0,
              left: 0,
              bottom: 320,
              right: 600,
              x: 0,
              y: 0,
              toJSON: () => ({}),
            },
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      )
    })
  }
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// jsdom nie implementuje getBoundingClientRect z sensownymi wartościami — Recharts czasem
// fall-back do offsetWidth/Height; stubbing zapewnia non-zero layout w testach.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 600 })
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 320 })
