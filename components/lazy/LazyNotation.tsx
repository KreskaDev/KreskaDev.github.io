'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type NotationType from '@/content/posts/guitar-test/components/Notation'

const NotationInner = dynamic(
  () => import('@/content/posts/guitar-test/components/Notation'),
  { ssr: false, loading: () => null },
)

// Notation widget renders ~180px stave (VexFlow Factory height) + ~80px BPM controls
// row = ~260px total height baseline. Per ADR-043 CLS empirical calibration. D8 multi-
// voice case taller — implementer Step 8 spike measures + bumps if highest >280px.
// Plan §3.2 lock: 260px baseline.
export default function LazyNotation(props: ComponentProps<typeof NotationType>) {
  return (
    <div className="min-h-[260px]">
      <NotationInner {...props} />
    </div>
  )
}

// displayName fallback dla NotationLink children walking (ADR-061 §6.1). Reference
// equality primary; displayName fires gdy author bypass'uje LazyNotation HOC.
LazyNotation.displayName = 'Notation'
