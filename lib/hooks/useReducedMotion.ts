'use client'

import { useSyncExternalStore } from 'react'

// `'use client'` REQUIRED — hook używa `window.matchMedia` (client-only API).
// Per Next 15+ App Router, 'use client' jest per-file module boundary, nie
// inheritance. Bez tej directive: jeśli ktoś kiedyś zaimportuje hook z RSC,
// runtime/build error.

const mediaQuery =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

function subscribe(callback: () => void): () => void {
  if (!mediaQuery) return () => {}
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  return mediaQuery?.matches ?? false
}

// SSR default — deterministycznie false. `useSyncExternalStore` używa
// tej wartości na serwerze + initial client render → brak hydration mismatch.
function getServerSnapshot(): boolean {
  return false
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
