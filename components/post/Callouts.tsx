import type { ReactNode } from 'react'

type CalloutsVariant = 'positive' | 'negative' | 'neutral'

interface CalloutsProps {
  variant?: CalloutsVariant
  children: ReactNode
}

// Cienki wrapper nad CSS `.callout-list` (globals.css) — eliminuje boilerplate
// `<div className="callout-list not-prose" data-variant="...">` w MDX.
// Styling i 3 warianty żyją w globals.css; ten komponent tylko emituje wrapper.
export default function Callouts({ variant = 'neutral', children }: CalloutsProps) {
  return (
    <div className="callout-list not-prose" data-variant={variant}>
      {children}
    </div>
  )
}
