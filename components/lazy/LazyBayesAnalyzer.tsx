'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type BayesAnalyzerType from '@/content/posts/pozytywny-wynik/components/BayesAnalyzer'

// next/dynamic z ssr:false wymaga Client Component contexta — Server Component
// (page.tsx jest async RSC przez compileMDX) NIE może użyć ssr:false bezpośrednio.
// Patrz ADR-043. Inner placeholder na poziomie wrappera, NIE w loading.
const BayesAnalyzerInner = dynamic(
  () => import('@/content/posts/pozytywny-wynik/components/BayesAnalyzer'),
  { ssr: false, loading: () => null },
)

// Per-view placeholder min-height eliminuje CLS przed hydratacją.
// First-pass values bazują na rzeczywistej strukturze widgetu:
//   single — sliders + posteriori display (no trajectory chart)
//   sequential — sliders + chart (h-60 sm:h-80 = 240/320px) + clinic table
//   playground — sliders + advanced toggle + chart + clinic editor
// min-h (NIE h) → rendered widget może być wyższy bez clip; nie niższy → no shift up.
const PLACEHOLDER_CLASS: Record<
  NonNullable<ComponentProps<typeof BayesAnalyzerType>['view']>,
  string
> = {
  single: 'min-h-[300px] sm:min-h-[350px]',
  sequential: 'min-h-[550px] sm:min-h-[650px]',
  playground: 'min-h-[700px] sm:min-h-[800px]',
}

export default function LazyBayesAnalyzer(
  props: ComponentProps<typeof BayesAnalyzerType>,
) {
  const view = props.view ?? 'single'
  return (
    <div className={PLACEHOLDER_CLASS[view]}>
      <BayesAnalyzerInner {...props} />
    </div>
  )
}
