'use client'

// Label kontekstu nad timeline. Centered nad event range tego kontekstu.
export function ContextLabelNode({ data }: { data: { label: string } }) {
  const d = data as unknown as { label: string }
  return (
    <div
      className="text-[11px] font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400 text-center"
      style={{ width: 140, pointerEvents: 'none' }}
    >
      {d.label}
    </div>
  )
}
