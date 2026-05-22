'use client'
import { Laptop, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

// Cycle nad `theme` (user choice), NIE `resolvedTheme` (pochodna 'dark'|'light').
// `system` musi się pojawić w cyklu — per ADR-012 (3-state dark → light → system).
const CYCLE = ['dark', 'light', 'system'] as const
type ThemeChoice = (typeof CYCLE)[number]

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  // Canonical next-themes mount-safe pattern — `mounted` flip synchronizuje React state
  // z faktem hydratacji (zewn. system = browser/localStorage). Bez tego SSR/CSR mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // Placeholder DOKŁADNIE same wymiary jak final (w-9 h-9) — bez tego CLS przy hydration.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Loading theme"
        className="w-9 h-9 inline-flex items-center justify-center rounded text-text-secondary"
      />
    )
  }

  const current: ThemeChoice = CYCLE.includes(theme as ThemeChoice) ? (theme as ThemeChoice) : 'dark'
  const nextIdx = (CYCLE.indexOf(current) + 1) % CYCLE.length
  const next = CYCLE[nextIdx] ?? 'dark'

  const Icon = current === 'dark' ? Moon : current === 'light' ? Sun : Laptop

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Current theme: ${current}. Click to switch to ${next}.`}
      className="w-9 h-9 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition"
    >
      <Icon size={18} aria-hidden />
    </button>
  )
}
