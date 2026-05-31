'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type FretboardVisualizerType from '@/content/posts/guitar-test/components/FretboardVisualizer'

const FretboardVisualizerInner = dynamic(
  () => import('@/content/posts/guitar-test/components/FretboardVisualizer'),
  { ssr: false, loading: () => null },
)

// FretboardVisualizer ma WŁASNY outer wrapper `relative my-6 -mx-4 sm:-mx-6 md:-mx-8
// overflow-x-auto` (v5-11 commit 84624b1 margin-collapse fix) — HOC NIE duplikuje.
// min-h-[220px] = Fretboard base 200 + ~20px overlay margins. Patrz ADR-043.
export default function LazyFretboardVisualizer(
  props: ComponentProps<typeof FretboardVisualizerType>,
) {
  return (
    <div className="min-h-[220px]">
      <FretboardVisualizerInner {...props} />
    </div>
  )
}
