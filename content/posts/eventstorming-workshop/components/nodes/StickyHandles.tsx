'use client'

import { Handle, Position } from '@xyflow/react'

// 4-side bidirectional handles. ConnectionMode.Loose w parent ReactFlow pozwala
// łączyć dowolny handle z dowolnym — eliminuje problem source/target mismatch
// gdy lane layout wymusza edges w różnych kierunkach (actor↓command, event↔event,
// policy↑command itp.).
export function StickyHandles() {
  return (
    <>
      <Handle id="t" type="source" position={Position.Top} className="!h-2 !w-2 !bg-stone-700" />
      <Handle id="r" type="source" position={Position.Right} className="!h-2 !w-2 !bg-stone-700" />
      <Handle id="b" type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-stone-700" />
      <Handle id="l" type="source" position={Position.Left} className="!h-2 !w-2 !bg-stone-700" />
    </>
  )
}
