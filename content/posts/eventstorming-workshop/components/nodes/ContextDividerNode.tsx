'use client'

// Wertykalna kreskowana linia oddzielająca dwa bounded contexty. Nie wchodzi w flow
// (zero handles), nie selectable. Pokazuje że timeline events przechodzi z jednego
// contextu do następnego mid-stream — to jest sens "saga crosses context boundary".
export function ContextDividerNode({ data }: { data: { height: number } }) {
  const d = data as unknown as { height: number }
  return (
    <div
      style={{
        width: 2,
        height: d.height,
        borderLeft: '2px dashed rgb(120, 113, 108)',
        pointerEvents: 'none',
      }}
    />
  )
}
