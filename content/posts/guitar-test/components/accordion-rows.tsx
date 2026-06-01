// accordion-rows.tsx — shared display rows konsumowane w inline <details> accordion'ach
// (FretboardVisualizer + ChordAnalyzer). Per Decyzja planisty #1 = B shared file z 3 named
// exports; Decyzja #2 = B generic dumb-display (wrapper computes content; row jest pure visual).
// Future widgets (v5-15+ scale graph, notation, tab) dodadzą własne row types bez touching
// shell — content slot pattern per Pre-confirmed #14.

import type { IntervalName, NoteName } from './types'

export type NotesRowProps = {
  notes: NoteName[]
}

/**
 * Renders comma-separated note list. Empty array → renders dash "—".
 * Wzór: "C, E, G, B" dla C maj7 chord; "D, E, F, G, A, B, C" dla D dorian scale.
 */
export function NotesRow({ notes }: NotesRowProps) {
  return (
    <div data-testid="notes-row" className="text-text-secondary">
      <span className="text-text-tertiary mr-2">Notes:</span>
      {notes.length === 0 ? '—' : notes.join(', ')}
    </div>
  )
}

export type IntervalsRowProps = {
  degrees: IntervalName[]
}

/**
 * Renders comma-separated intervals breakdown (Root + interval names).
 * Wzór: "R, 3, 5" dla C maj triad; "R, 2, 3, 4, 5, 6, m7" dla D dorian scale.
 */
export function IntervalsRow({ degrees }: IntervalsRowProps) {
  return (
    <div data-testid="intervals-row" className="text-text-secondary">
      <span className="text-text-tertiary mr-2">Intervals:</span>
      {degrees.length === 0 ? '—' : degrees.join(', ')}
    </div>
  )
}

export type DetectedNameRowProps = {
  name: string | null
  secondaryName?: string
}

/**
 * Renders detected chord/scale name (primary) + optional secondary reading inline.
 * Wzór primary only: "C maj7" / "D dorian"
 * Wzór z secondary: "C add9 · Other reading: C maj"
 * Wrapper-side computation supplies both strings; row component is pure visual.
 */
export function DetectedNameRow({ name, secondaryName }: DetectedNameRowProps) {
  if (!name) return null
  return (
    <div data-testid="detected-name-row" className="text-text-secondary">
      <span className="text-text-tertiary mr-2">Name:</span>
      <span className="text-text-primary">{name}</span>
      {secondaryName && (
        <span className="ml-3 text-text-tertiary">
          · Other reading: <span className="text-text-secondary">{secondaryName}</span>
        </span>
      )}
    </div>
  )
}
