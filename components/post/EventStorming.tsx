// EventStorming static visualizer — React Server Component (RSC).
// Komponent jest deterministic, czytany z props, theme reactivity przez CSS vars
// w globals.css. RSC invariant: brak client-directive, zero JS payload.
// Patrz ADR-052 + plan v6-03 §3.4 + §5.1.
import type { ReactElement } from 'react'

export type StickyType =
  | 'event'
  | 'command'
  | 'aggregate'
  | 'actor'
  | 'policy'
  | 'readmodel'
  | 'external'
  | 'hotspot'

export interface StickyNote {
  id?: string
  type: StickyType
  label: string
  x?: number
  y?: number
}

export interface EventStormingProps {
  notes: StickyNote[]
  caption?: string
  layout?: 'timeline' | 'grid' | 'auto'
  className?: string
  ariaLabel?: string
}

// Exhaustive Records — TS strict zapewnia że każdy nowy StickyType musi mieć entry.
const STYLE_MAP: Record<StickyType, string> = {
  event: 'bg-[var(--es-event-bg)] text-[var(--es-event-fg)] border-[var(--es-event-border)]',
  command: 'bg-[var(--es-command-bg)] text-[var(--es-command-fg)] border-[var(--es-command-border)]',
  aggregate: 'bg-[var(--es-aggregate-bg)] text-[var(--es-aggregate-fg)] border-[var(--es-aggregate-border)]',
  actor: 'bg-[var(--es-actor-bg)] text-[var(--es-actor-fg)] border-[var(--es-actor-border)]',
  policy: 'bg-[var(--es-policy-bg)] text-[var(--es-policy-fg)] border-[var(--es-policy-border)]',
  readmodel: 'bg-[var(--es-readmodel-bg)] text-[var(--es-readmodel-fg)] border-[var(--es-readmodel-border)]',
  external: 'bg-[var(--es-external-bg)] text-[var(--es-external-fg)] border-[var(--es-external-border)]',
  hotspot: 'bg-[var(--es-hotspot-bg)] text-[var(--es-hotspot-fg)] border-[var(--es-hotspot-border)]',
}

const SHAPE_MAP: Record<StickyType, string> = {
  event: 'min-w-[140px] min-h-[68px] rotate-[0.3deg]',
  command: 'min-w-[140px] min-h-[68px] rotate-[-0.3deg]',
  aggregate: 'min-w-[160px] min-h-[100px] rotate-[0.2deg]',
  actor: 'min-w-[90px] min-h-[50px] rotate-[-0.5deg]',
  policy: 'min-w-[140px] min-h-[68px] rotate-[0.4deg]',
  readmodel: 'min-w-[140px] min-h-[68px] rotate-[-0.2deg]',
  external: 'min-w-[140px] min-h-[68px] rotate-[0.3deg]',
  hotspot: 'min-w-[120px] min-h-[68px] rotate-[2deg]',
}

const TYPE_LABEL: Record<StickyType, string> = {
  event: 'Event',
  command: 'Command',
  aggregate: 'Aggregate',
  actor: 'Actor',
  policy: 'Policy',
  readmodel: 'Read Model',
  external: 'External',
  hotspot: 'Hot Spot',
}

function synthesizeAriaLabel(notes: StickyNote[], caption?: string): string {
  if (caption) return caption
  const buckets: Record<StickyType, string[]> = {
    event: [],
    command: [],
    aggregate: [],
    actor: [],
    policy: [],
    readmodel: [],
    external: [],
    hotspot: [],
  }
  for (const n of notes) {
    buckets[n.type].push(n.label)
  }
  const parts: string[] = []
  if (buckets.event.length) parts.push(`Events: ${buckets.event.join(', ')}`)
  if (buckets.command.length) parts.push(`Commands: ${buckets.command.join(', ')}`)
  if (buckets.actor.length) parts.push(`Actors: ${buckets.actor.join(', ')}`)
  if (buckets.aggregate.length) parts.push(`Aggregates: ${buckets.aggregate.join(', ')}`)
  if (buckets.policy.length) parts.push(`Policies: ${buckets.policy.join(', ')}`)
  if (buckets.readmodel.length) parts.push(`Read models: ${buckets.readmodel.join(', ')}`)
  if (buckets.external.length) parts.push(`External systems: ${buckets.external.join(', ')}`)
  if (buckets.hotspot.length) parts.push(`Hot spots: ${buckets.hotspot.join(', ')}`)
  // Edge case: pusta tablica + brak caption → unikamy "EventStorming diagram. ." artifact.
  if (parts.length === 0) return 'EventStorming diagram (empty).'
  return `EventStorming diagram. ${parts.join('. ')}.`
}

function StickyRender({
  type,
  label,
  x,
  y,
  layout,
}: StickyNote & { layout: 'timeline' | 'grid' }): ReactElement {
  const gridStyle =
    layout === 'grid' && x !== undefined && y !== undefined
      ? { gridColumnStart: x + 1, gridRowStart: y + 1 }
      : undefined
  return (
    <div
      style={gridStyle}
      className={`${STYLE_MAP[type]} ${SHAPE_MAP[type]} border-2 rounded-sm px-3 py-2 text-xs sm:text-sm font-medium shadow-md flex items-center justify-center text-center select-text`}
      role="img"
      aria-label={`${TYPE_LABEL[type]}: ${label}`}
    >
      {label}
    </div>
  )
}

function TimelineRender({ notes }: { notes: StickyNote[] }): ReactElement {
  // Brandolini Big Picture row convention: Actors / Commands / Events (orange line, border-y)
  // / Policies / Reads / Externals / Aggregates. Hot spots renderowane razem z events
  // (overlap z orange timeline jako problem markers).
  const actors = notes.filter((n) => n.type === 'actor')
  const commands = notes.filter((n) => n.type === 'command')
  const events = notes.filter((n) => n.type === 'event' || n.type === 'hotspot')
  const policies = notes.filter((n) => n.type === 'policy')
  const reads = notes.filter((n) => n.type === 'readmodel')
  const externals = notes.filter((n) => n.type === 'external')
  const aggregates = notes.filter((n) => n.type === 'aggregate')

  const Row = (label: string, items: StickyNote[], rowClass: string): ReactElement | null => {
    if (items.length === 0) return null
    return (
      <div className={`flex flex-row items-center gap-3 ${rowClass}`}>
        <span className="text-xs text-text-tertiary uppercase tracking-wider min-w-[80px] shrink-0">
          {label}
        </span>
        <div className="flex flex-row gap-3 items-center">
          {items.map((n, i) => (
            <StickyRender key={n.id ?? `${n.type}-${i}`} {...n} layout="timeline" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {Row('Actors', actors, 'es-row-actors')}
      {Row('Commands', commands, 'es-row-commands')}
      {Row(
        'Events',
        events,
        'es-row-events border-y-2 border-[var(--es-event-border)] py-3 my-1',
      )}
      {Row('Policies', policies, 'es-row-policies')}
      {Row('Reads', reads, 'es-row-reads')}
      {Row('Externals', externals, 'es-row-externals')}
      {Row('Aggregates', aggregates, 'es-row-aggregates')}
    </div>
  )
}

function GridRender({ notes }: { notes: StickyNote[] }): ReactElement {
  // Tailwind 4 JIT NIE generuje dynamic col-start-N z runtime values — używamy inline style
  // dla gridColumnStart / gridRowStart / gridTemplateColumns / gridTemplateRows.
  // Patrz plan v6-03 §5.6 + §10.1 Risk #1.
  const xs = notes.map((n) => n.x ?? 0)
  const ys = notes.map((n) => n.y ?? 0)
  const maxX = xs.length > 0 ? Math.max(...xs) : 0
  const maxY = ys.length > 0 ? Math.max(...ys) : 0
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${maxX + 1}, 160px)`,
        gridTemplateRows: `repeat(${maxY + 1}, 100px)`,
      }}
    >
      {notes.map((n, i) => (
        <div
          key={n.id ?? `${n.type}-${i}`}
          style={{ gridColumnStart: (n.x ?? 0) + 1, gridRowStart: (n.y ?? 0) + 1 }}
          className="flex items-center justify-center"
        >
          <StickyRender {...n} layout="grid" />
        </div>
      ))}
    </div>
  )
}

export default function EventStorming({
  notes,
  caption,
  layout = 'timeline',
  className,
  ariaLabel,
}: EventStormingProps): ReactElement {
  const resolvedLayout: 'timeline' | 'grid' = layout === 'grid' ? 'grid' : 'timeline'
  const label = ariaLabel ?? synthesizeAriaLabel(notes, caption)
  return (
    <figure
      className={`my-8 -mx-4 sm:mx-0 overflow-x-auto overflow-y-visible md:relative md:left-1/2 md:-translate-x-1/2 md:w-fit md:max-w-[min(80rem,calc(100vw-2rem))] md:overflow-x-auto md:overflow-y-visible md:flex md:flex-col md:items-center md:bg-bg-secondary md:rounded-lg md:border md:border-border md:p-6 ${className ?? ''}`}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <div className="es-canvas inline-block min-w-full p-4 md:min-w-0 md:w-fit md:flex-none md:p-0">
        {resolvedLayout === 'grid' ? (
          <GridRender notes={notes} />
        ) : (
          <TimelineRender notes={notes} />
        )}
      </div>
      {caption && (
        <figcaption className="text-sm text-text-tertiary text-center mt-3 md:max-w-3xl md:px-4">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
