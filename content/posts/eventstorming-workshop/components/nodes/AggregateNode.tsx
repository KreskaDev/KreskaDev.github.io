'use client'

import type { NodeProps } from '@xyflow/react'
import type { StickyNode } from '../types'
import { StickyHandles } from './StickyHandles'

// Duża żółto-bursztynowa karta — Aggregate root.
// Per Brandolini "Introducing EventStorming" §5: "the noun the system is about".
// Commands wpadają, events wychodzą; aggregate enforce'uje invariants (rules obok).
export function AggregateNode({ data }: NodeProps<StickyNode>) {
  return (
    <div className="rounded-sm bg-amber-300 px-4 py-3 text-sm font-bold uppercase tracking-wide text-stone-900 shadow-md ring-2 ring-amber-600/50 min-w-[130px] text-center dark:bg-amber-400">
      <StickyHandles />
      <span>{data.label}</span>
    </div>
  )
}
