'use client'

import type { NodeProps } from '@xyflow/react'
import type { StickyNode } from '../types'
import { StickyHandles } from './StickyHandles'

// Mała pale-yellow karteczka — Business Rule / Invariant.
// Visualnie pomniejszony (chip-style) per reviewer: rules są secondary detail,
// nie powinny competeować z events o uwagę.
export function RuleNode({ data }: NodeProps<StickyNode>) {
  return (
    <div className="rounded-full bg-yellow-100 px-2.5 py-1 text-[10px] italic text-stone-800 shadow-sm ring-1 ring-yellow-500/30 max-w-[170px] text-center leading-tight dark:bg-yellow-200">
      <StickyHandles />
      <span>§ {data.label}</span>
    </div>
  )
}
