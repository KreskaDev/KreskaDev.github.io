'use client'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

// 2-state cycle dark ↔ light w obrębie aktualnej palety (ADR-041 amends ADR-012:
// system theme deprecated w dual-palette mode). Toggle flipuje MODE segment
// composite theme (e.g. 'dark-cool' → 'light-cool'), preserving palette segment.
const THEME_RE = /^(light|dark)-(warm|cool)$/

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  // Canonical next-themes mount-safe pattern — `mounted` flip synchronizuje React state
  // z faktem hydratacji (zewn. system = browser/localStorage). Bez tego SSR/CSR mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // Placeholder DOKŁADNIE same wymiary jak final (w-11 h-11 = 44px WCAG AAA) —
  // bez tego CLS przy hydration. Bump z w-9 (36px) w v5-08 dla mobile parity.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Loading theme"
        className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary"
      />
    )
  }

  // Parse composite theme. Fallback: dark-cool (matches defaultTheme z layout.tsx).
  const match = (theme ?? 'dark-cool').match(THEME_RE)
  const mode = (match?.[1] ?? 'dark') as 'light' | 'dark'
  const palette = (match?.[2] ?? 'cool') as 'warm' | 'cool'
  const nextMode = mode === 'dark' ? 'light' : 'dark'
  const nextTheme = `${nextMode}-${palette}`

  const Icon = mode === 'dark' ? Moon : Sun

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Current theme: ${mode}. Click to switch to ${nextMode}.`}
      className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition"
    >
      <Icon size={20} aria-hidden />
    </button>
  )
}
