'use client'

// `'use client'` — komponent jest child wewnątrz client-side ContentNavigator;
// dyrektywa per-file boundary (Next 15+) gwarantuje że nie ulatuje do RSC import path.
// Stateless — całość rAF + ResizeObserver żyje w parencie (jeden shared scroll
// listener per page, task.md §Performance + plan §"ScrollProgress deep-dive").

interface ScrollProgressProps {
  percent: number
  // Required — parent przekazuje stan hooka żeby uniknąć duplicate
  // useReducedMotion subscription. Type-required żeby zapomniany plumbing
  // wybuchł na compile-time, nie cicho jako always-animated.
  reducedMotion: boolean
}

export function ScrollProgress({ percent, reducedMotion }: ScrollProgressProps) {
  return (
    <div className="mt-4 pt-3 border-t border-border">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
        className="relative h-1 bg-border rounded overflow-hidden"
      >
        <div
          className={[
            'absolute inset-y-0 left-0 bg-burgundy',
            reducedMotion ? '' : 'transition-[width] duration-100 ease-out',
          ].join(' ')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-text-tertiary text-right tabular-nums">
        {percent}%
      </div>
    </div>
  )
}
