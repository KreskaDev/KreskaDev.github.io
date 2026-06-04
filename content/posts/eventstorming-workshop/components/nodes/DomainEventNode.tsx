'use client'

import type { NodeProps } from '@xyflow/react'
import type { StickyNode } from '../types'
import { StickyHandles } from './StickyHandles'

// Pomarańczowa karteczka — Domain Event (past tense: OrderPlaced, PaymentCaptured).
// Brandolini convention §3 "Introducing EventStorming".
export function DomainEventNode({ data }: NodeProps<StickyNode>) {
  return (
    <div className="rounded-sm bg-orange-400 px-3 py-2 text-xs font-medium text-stone-900 shadow-md ring-1 ring-orange-600/40 min-w-[120px] text-center dark:bg-orange-500">
      <StickyHandles />
      <span>{data.label}</span>
    </div>
  )
}
