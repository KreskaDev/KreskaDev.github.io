'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type NotationScaleLinkType from '@/content/posts/guitar-test/components/NotationScaleLink'

const NotationScaleLinkInner = dynamic(
  () => import('@/content/posts/guitar-test/components/NotationScaleLink'),
  { ssr: false, loading: () => null },
)

// Notation (~260px) + ScaleOnFretboard (~220px) + flex gap-4 (16px) ≈ 496px.
// Baseline `min-h-[480px]` lock per ADR-043 CLS calibration. Implementer Step 22
// empirical bump jeśli largest linked demo (D9 + D10 + arrows + cursor highlight)
// renders >500px.
export default function LazyNotationScaleLink(
  props: ComponentProps<typeof NotationScaleLinkType>,
) {
  return (
    <div className="min-h-[480px]">
      <NotationScaleLinkInner {...props} />
    </div>
  )
}
