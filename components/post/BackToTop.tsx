'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

// Próg w pikselach scrollY powyżej którego button jest visible. Wartość z task.md
// + plan §"BackToTop deep-dive" — 300px = ~1 viewport na typowych laptopach.
const SCROLL_THRESHOLD = 300

export function BackToTop() {
  const [visible, setVisible] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    // Isolated rAF-throttled scroll listener — boundary clarity, NIE shared
    // z ContentNavigator (plan §"BackToTop deep-dive": różne pytania —
    // absolute pixel threshold vs relative percentage, plus BackToTop żyje
    // wszędzie ≥768px nawet gdy ContentNavigator hidden 768-1099px).
    let scheduled = false
    const onScroll = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        setVisible(window.scrollY > SCROLL_THRESHOLD)
        scheduled = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // initial sync — deep-link może wylądować poniżej threshold
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleClick = () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Back to top"
      className={[
        // Mobile-enabled od v5-08 (ADR-035 supersedes ADR-014). Safe-area insets
        // protect przed iOS home indicator + Android navigation bar overlap.
        'flex',
        'fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-40',
        'w-12 h-12 items-center justify-center',
        'rounded-full bg-bg-primary border border-border-strong',
        'shadow-lg dark:shadow-2xl',
        'hover:bg-bg-secondary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy',
        reducedMotion ? '' : 'transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      <ArrowUp className="w-5 h-5 text-text-primary" aria-hidden />
    </button>
  )
}
