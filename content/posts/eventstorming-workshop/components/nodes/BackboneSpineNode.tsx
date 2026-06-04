'use client'

// Pomarańczowe pasmo "kręgosłup" pod całym event lane — wizualna dominanta
// timeline (per Brandolini "Introducing EventStorming" §3, events are the narrative spine).
export function BackboneSpineNode({ data }: { data: { width: number } }) {
  const d = data as unknown as { width: number }
  return (
    <div
      style={{
        width: d.width,
        height: 130,
        background:
          'linear-gradient(180deg, transparent 0%, rgba(251, 146, 60, 0.08) 30%, rgba(251, 146, 60, 0.12) 50%, rgba(251, 146, 60, 0.08) 70%, transparent 100%)',
        borderTop: '1px solid rgba(251, 146, 60, 0.3)',
        borderBottom: '1px solid rgba(251, 146, 60, 0.3)',
        pointerEvents: 'none',
      }}
    />
  )
}
