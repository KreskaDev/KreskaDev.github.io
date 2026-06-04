'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type TablatureType from '@/content/posts/guitar-test/components/Tablature'

const TablatureInner = dynamic(
  () => import('@/content/posts/guitar-test/components/Tablature'),
  { ssr: false, loading: () => null },
)

// Tablature widget renders ~160px TabStave (VexFlow Factory height) + tuning indicator
// (~20px gdy non-STANDARD) + ~80px BPM controls row = ~200px baseline. Per ADR-043 CLS
// calibration mirror LazyNotation + LazyScaleOnFretboard pattern. Linked mode (Pattern C
// passive) ukrywa BPM controls → ~160px aktualnie; placeholder zachowuje 200px conservative.
export default function LazyTablature(props: ComponentProps<typeof TablatureType>) {
  return (
    <div className="min-h-[200px]">
      <TablatureInner {...props} />
    </div>
  )
}

// displayName fallback dla NotationLink children walking (ADR-061 §6.1).
LazyTablature.displayName = 'Tablature'
