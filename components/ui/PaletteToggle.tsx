'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

// Composite theme format: '<mode>-<palette>' (e.g. 'dark-cool', 'light-warm')
// per ADR-041 dual-palette theme system + plan v5-10 D8 LOCKED (hyphenated single class).
const THEME_RE = /^(light|dark)-(warm|cool)$/

interface PaletteToggleProps {
  className?: string
}

// Runtime palette toggle (warm ↔ cool) zachowując mode segment (dark/light).
// Mounted w TopNav (desktop) + MobileMenu drawer entry (mobile) per Krok 14-15.
// `className` prop pozwala consumer composition (`hidden md:inline-flex` w TopNav).
export function PaletteToggle({ className = '' }: PaletteToggleProps) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  // Canonical next-themes mount-safe pattern (per ThemeToggle precedens).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // Placeholder dokładnie same wymiary (w-11 h-11 = 44px WCAG AAA tap target, ADR-035).
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Loading palette"
        className={`w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary ${className}`}
      />
    )
  }

  // Parse composite theme (e.g. 'dark-cool' → mode='dark', palette='cool').
  // Fallback: dark-cool (matches defaultTheme z app/layout.tsx).
  const match = (theme ?? 'dark-cool').match(THEME_RE)
  const mode = (match?.[1] ?? 'dark') as 'light' | 'dark'
  const palette = (match?.[2] ?? 'cool') as 'warm' | 'cool'
  const nextPalette = palette === 'cool' ? 'warm' : 'cool'
  const nextTheme = `${mode}-${nextPalette}`

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextPalette} color palette`}
      // aria-pressed = warm anchor convention (per plan D11 + Note #22 LOCKED).
      // Toggle conceptualnie = "warm mode on/off"; alternative `palette === 'cool'`
      // semantycznie równoważne. Documented w ADR-041.
      aria-pressed={palette === 'warm'}
      className={`w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition ${className}`}
    >
      {/* 2-dot palette legend: lewa = warm (burgundy), prawa = cool (steel blue).
          Active palette dot = fill, inactive = stroke. Hex hardcoded — icon jest
          abstract palette legend, NIE reactive na bieżący theme (zawsze ten sam
          wygląd w obu paletach per plan D10 LOCKED). */}
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden focusable="false">
        {palette === 'warm' ? (
          <>
            <circle cx="6" cy="10" r="3" fill="#C97E87" />
            <circle cx="14" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </>
        ) : (
          <>
            <circle cx="6" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="14" cy="10" r="3" fill="#5290BD" />
          </>
        )}
      </svg>
    </button>
  )
}
