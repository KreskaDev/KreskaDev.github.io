'use client'

import type { NodeProps } from '@xyflow/react'
import type { StickyNode } from '../types'
import { StickyHandles } from './StickyHandles'

// Mała beżowa karteczka — Actor / User (kto wywołuje command).
// Beige zamiast yellow — yellow zarezerwowany dla Aggregate per Brandolini convention.
export function ActorNode({ data }: NodeProps<StickyNode>) {
  return (
    <div className="rounded-sm bg-stone-200 px-3 py-1.5 text-xs font-medium text-stone-900 shadow-md ring-1 ring-stone-400 min-w-[110px] text-center dark:bg-stone-300">
      <StickyHandles />
      <span>👤 {data.label}</span>
    </div>
  )
}
