'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type FretboardType from '@/content/posts/guitar-test/components/Fretboard'

const FretboardInner = dynamic(
  () => import('@/content/posts/guitar-test/components/Fretboard'),
  { ssr: false, loading: () => null },
)

// Fretboard.tsx ma WŁASNY outer wrapper `my-6 -mx-4 sm:mx-0 overflow-x-auto`
// (v5-09 commit) — HOC NIE duplikuje. min-h-[200px] = reserve space pre-hydration.
// Default fretCount=12 desktop SVG ~182px + 18px buffer. Patrz ADR-043.
export default function LazyFretboard(
  props: ComponentProps<typeof FretboardType>,
) {
  return (
    <div className="min-h-[200px]">
      <FretboardInner {...props} />
    </div>
  )
}
