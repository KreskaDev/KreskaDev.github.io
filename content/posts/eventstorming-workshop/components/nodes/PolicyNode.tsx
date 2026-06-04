'use client'

import type { NodeProps } from '@xyflow/react'
import type { StickyNode } from '../types'
import { StickyHandles } from './StickyHandles'

// Fioletowa karteczka — Policy (reactive rule: "When X → do Y").
// Łączy event (trigger) z command (reakcja).
export function PolicyNode({ data }: NodeProps<StickyNode>) {
  return (
    <div className="rounded-sm bg-purple-300 px-3 py-2 text-xs font-medium text-stone-900 shadow-md ring-1 ring-purple-600/40 min-w-[140px] max-w-[200px] text-center italic dark:bg-purple-400">
      <StickyHandles />
      <span>{data.label}</span>
    </div>
  )
}
