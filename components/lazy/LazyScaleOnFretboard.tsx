'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type ScaleOnFretboardType from '@/content/posts/guitar-test/components/ScaleOnFretboard'

const ScaleOnFretboardInner = dynamic(
  () => import('@/content/posts/guitar-test/components/ScaleOnFretboard'),
  { ssr: false, loading: () => null },
)

// Fretboard ~190px (12-fret, padding.top=28 + innerHeight=140 + padding.bottom=28) +
// BPM controls row ~80px = ~270px. Margin -mx-4 sm:mx-0 + my-6 → no net delta.
// Baseline 220px lock per ADR-043 CLS calibration; implementer Step 13 empirical bump
// jeśli largest demo D8 (E blues minor) renders >240px.
export default function LazyScaleOnFretboard(
  props: ComponentProps<typeof ScaleOnFretboardType>,
) {
  return (
    <div className="min-h-[220px]">
      <ScaleOnFretboardInner {...props} />
    </div>
  )
}
