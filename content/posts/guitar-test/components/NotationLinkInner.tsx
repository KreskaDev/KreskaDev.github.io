'use client'

// NotationLinkInner — Client Component connecting Provider context + state + slot
// reconstruction. Imports Lazy* widgets sam (NIE odbiera function refs from SC outer
// — SC→CC boundary nie przechodzi function refs w sposób, który zachowuje identity).
//
// Odbiera serializable slot data { role, props, idx } z NotationLink SC outer. Per role:
// reconstruct JSX z proper widget reference + props merge (notes injection, onNoteStart
// wiring, passive enableAudio/showBpmControl injection). Owns state (currentNoteIdx +
// isPlaying), context Provider (split mutable cursor + stable notes per ADR-059 LOCK),
// stable callback handler (useCallback) i mixed-tuning console.warn detection (useEffect).
//
// Multi-instance per-CC-instance scope: każdy NotationLink SC mount → osobny inner
// instance → osobny useState. Zero leakage between wrappers w one tree.

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { Note } from './types'
import {
  NotationCursorContext,
  NotationNotesContext,
  type NotationCursorContextValue,
  type NotationNotesContextValue,
} from './NotationCursorContext'
import { resolveTuning, STANDARD_TUNING } from './tunings'
import LazyNotation from '@/components/lazy/LazyNotation'
import LazyTablature from '@/components/lazy/LazyTablature'
import LazyScaleOnFretboard from '@/components/lazy/LazyScaleOnFretboard'

export type ChildRole = 'notation' | 'tablature' | 'scale-on-fretboard' | 'unknown'

export type ChildSlot = {
  role: ChildRole
  // Plain props z author MDX — MUSI być serializable bo crosses SC→CC boundary.
  // MDX path passes only plain data (strings/numbers/arrays of plain objects), zero
  // functions lub elements. Verify w test/build.
  props: Record<string, unknown>
  idx: number
}

export type NotationLinkInnerProps = {
  id: string
  notes: Note[]
  slots: ChildSlot[]
  defaultBpm?: number
}

export default function NotationLinkInner(props: NotationLinkInnerProps) {
  const { id, notes, slots, defaultBpm } = props

  const [currentNoteIdx, setCurrentNoteIdx] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Context split (per ADR-059 + plan §3.5 LOCK carry-over): cursor mutable per-note vs
  // notes stable per mount. Two contexts → notes consumers nie rerender per cursor update.
  const cursorValue = useMemo<NotationCursorContextValue>(
    () => ({ currentNoteIdx, isPlaying, setCurrentNoteIdx, setIsPlaying }),
    [currentNoteIdx, isPlaying],
  )
  const notesValue = useMemo<NotationNotesContextValue>(() => ({ notes }), [notes])

  // Stable identity dla Notation memoization.
  const handleNotationNoteStart = useCallback((idx: number, scheduledMs: number) => {
    void scheduledMs
    setCurrentNoteIdx(idx)
  }, [])

  // Mixed-tuning warning (per ADR-062 + plan §4.4). Computation inline (≤8 slots).
  const nonStdNames: string[] = []
  for (const slot of slots) {
    if (slot.role !== 'tablature') continue
    const tuningProp = slot.props.tuning
    if (tuningProp === undefined) continue
    try {
      const resolved = resolveTuning(tuningProp as Parameters<typeof resolveTuning>[0])
      if (resolved.name !== STANDARD_TUNING.name) nonStdNames.push(resolved.name)
    } catch {
      // resolveTuning throw obsługowany przez Tablature pre-render; tu skip silent.
    }
  }
  const tabsWithNonStandardTuningNames = nonStdNames.join(', ')
  const hasNotationChild = slots.some((s) => s.role === 'notation')

  useEffect(() => {
    if (hasNotationChild && tabsWithNonStandardTuningNames.length > 0) {
      console.warn(
        `[NotationLink "${id}"] Notation is not tuning-aware. Tablature tuning(s) ` +
          `[${tabsWithNonStandardTuningNames}] may not match Notation visual pitch ` +
          `interpretation. Verify visual consistency manually.`,
      )
    }
  }, [id, hasNotationChild, tabsWithNonStandardTuningNames])

  // Reconstruct JSX z slots. Per role: render proper widget + merged props.
  // Author props win for visual/widget-specific (tuning, rootNote, keySignature);
  // wrapper-injected win for notes / onNoteStart / audio suppression.
  const reconstructed = slots.map((slot) => {
    const baseKey = `${id}-child-${slot.idx}`
    if (slot.role === 'notation') {
      // Spread author props first, wrapper overrides win (notes, onNoteStart, defaultBpm).
      const notationProps = {
        ...(slot.props as Record<string, unknown>),
        notes,
        defaultBpm: (slot.props.defaultBpm as number | undefined) ?? defaultBpm,
        onNoteStart: handleNotationNoteStart,
        id: (slot.props.id as string | undefined) ?? `${id}-notation`,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <LazyNotation key={`${baseKey}-notation`} {...(notationProps as any)} />
    }
    if (slot.role === 'tablature') {
      const tabProps = {
        ...(slot.props as Record<string, unknown>),
        notes,
        enableAudio: false,
        showBpmControl: false,
        id: (slot.props.id as string | undefined) ?? `${id}-tab-${slot.idx}`,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <LazyTablature key={`${baseKey}-tab`} {...(tabProps as any)} />
    }
    if (slot.role === 'scale-on-fretboard') {
      const scaleProps = {
        ...(slot.props as Record<string, unknown>),
        notes,
        enableAudio: false,
        showBpmControl: false,
        id: (slot.props.id as string | undefined) ?? `${id}-fretboard-${slot.idx}`,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <LazyScaleOnFretboard key={`${baseKey}-fretboard`} {...(scaleProps as any)} />
    }
    // Unknown role — slot props NIE rekonstruują żadnego znanego widgetu. Skip (zero render);
    // documented edge case (e.g., MDX whitespace text passed jako element — nie occurs w
    // praktyce bo SC outer filteruje przez isValidElement).
    return null
  })

  return (
    <div className="flex flex-col gap-4" data-notation-link-id={id}>
      <NotationNotesContext.Provider value={notesValue}>
        <NotationCursorContext.Provider value={cursorValue}>
          {reconstructed}
        </NotationCursorContext.Provider>
      </NotationNotesContext.Provider>
    </div>
  )
}
