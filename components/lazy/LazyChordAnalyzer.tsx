'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type ChordAnalyzerType from '@/content/posts/guitar-test/components/ChordAnalyzer'

const ChordAnalyzerInner = dynamic(
  () => import('@/content/posts/guitar-test/components/ChordAnalyzer'),
  { ssr: false, loading: () => null },
)

// ChordAnalyzer ma WŁASNY outer wrapper `relative my-6 -mx-4 sm:-mx-6 md:-mx-8
// overflow-x-auto` (precedent FretboardVisualizer v5-11 margin-collapse fix) — HOC NIE
// duplikuje. min-h-[260px] = Fretboard base ~200 + chord name display ~40 + degrees
// breakdown ~40 (większe vs LazyFretboardVisualizer 220 bo ChordAnalyzer renderuje
// dodatkowo chord name above + degrees list below). Eliminuje CLS per ADR-043.
export default function LazyChordAnalyzer(
  props: ComponentProps<typeof ChordAnalyzerType>,
) {
  return (
    <div className="min-h-[260px]">
      <ChordAnalyzerInner {...props} />
    </div>
  )
}
