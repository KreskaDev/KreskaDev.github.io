'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type MermaidType from '@/components/post/Mermaid'

// Patrz ADR-043 + ADR-050. Mermaid wymaga ssr:false (DOMParser, document, SVG injection
// — wszystko browser-only). Per-diagram-kind placeholder eliminuje CLS bump przy
// hydration — sequenceDiagram + C4Context są wyraźnie wyższe niż state/flowchart.
const MermaidInner = dynamic(() => import('@/components/post/Mermaid'), {
  ssr: false,
  loading: () => null,
})

const KIND_MIN_H: Record<
  NonNullable<ComponentProps<typeof MermaidType>['diagramKind']>,
  string
> = {
  sequence: 'min-h-[450px]',
  class: 'min-h-[350px]',
  state: 'min-h-[300px]',
  er: 'min-h-[350px]',
  c4: 'min-h-[450px]',
  flow: 'min-h-[300px]',
}

export default function LazyMermaid(props: ComponentProps<typeof MermaidType>) {
  const minH = props.diagramKind ? KIND_MIN_H[props.diagramKind] : 'min-h-[400px]'
  return (
    <div className={minH}>
      <MermaidInner {...props} />
    </div>
  )
}
