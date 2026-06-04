'use client'

// Tinted poziome pasmo pod backbone events, spinające zakres jednej saga.
// Wizualnie pokazuje że ta sekwencja events jest JEDNYM long-running procesem.
// Alpha podniesiony (15%) + left-edge label sticker żeby ribbon był widoczny anchorowany.
export function SagaRibbonNode({ data }: { data: { label: string; width: number; hueClass: string } }) {
  const d = data as unknown as { label: string; width: number; hueClass: string }
  return (
    <div
      className="rounded-md flex items-center bg-purple-500/15 border border-purple-500/40 dark:bg-purple-400/20 dark:border-purple-400/50"
      style={{
        width: d.width,
        height: 28,
        pointerEvents: 'none',
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-200 px-3 whitespace-nowrap bg-purple-100/80 dark:bg-purple-900/60 rounded-l-md h-full flex items-center border-r border-purple-500/40">
        {d.label}
      </span>
    </div>
  )
}
