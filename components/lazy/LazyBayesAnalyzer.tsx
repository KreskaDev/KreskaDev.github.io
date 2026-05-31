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

// Per-view placeholder min-height — height reservation pre-hydration.
// Phase 4 post-impl empirical test wykazał że CLS 0.101 na Bayes post mobile pochodzi
// strukturalnie z chart mounted-guard wewnątrz BayesAnalyzer.tsx:609-613 (h-60 sm:h-80
// vs Recharts rendered diff), NIE z HOC placeholder. Bump placeholderów (testowane do
// 800/1400/1800) NIE zmniejszył CLS. Wartości tu są minimalne ale nie absurdalne (≥ form
// height) żeby uniknąć "blank space pre-hydration" UX cost. CLS = structural future iter.
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
