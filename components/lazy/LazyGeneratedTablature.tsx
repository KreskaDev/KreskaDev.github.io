'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type GeneratedTablatureType from '@/content/posts/guitar-test/components/GeneratedTablature'

const GeneratedTablatureInner = dynamic(
  () => import('@/content/posts/guitar-test/components/GeneratedTablature'),
  { ssr: false, loading: () => null },
)

// Same placeholder budget as LazyTablature — wrapper delegate'uje, brak extra footprint.
export default function LazyGeneratedTablature(
  props: ComponentProps<typeof GeneratedTablatureType>,
) {
  return (
    <div className="min-h-[200px]">
      <GeneratedTablatureInner {...props} />
    </div>
  )
}

LazyGeneratedTablature.displayName = 'GeneratedTablature'
