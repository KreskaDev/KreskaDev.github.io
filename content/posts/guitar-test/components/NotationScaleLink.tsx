'use client'

// NotationScaleLink — Pattern C cross-widget cursor wrapper (v5-16.2 per ADR-059).
// Composes shipped <Notation/> (master z Play+BPM) + <ScaleOnFretboard/> (passive
// listener) via React Context coordinator. Notation fires onNoteStart → context
// dispatch → ScaleOnFretboard reads currentNoteIdx → HighlightOverlay ring follows
// playback synchronously.
//
// Wrapper-level chord-on-staff validation (Kolizja #2 per Pre-confirmed #13): walk
// notes[] przed render, throw na pitch=NotePitch[]. ScaleOnFretboard own throw =
// defense in depth (wrapper-first per ADR-059).
//
// Multi-instance guarantee: każdy wrapper Provider scope = osobny context state
// (D9 + D10 osobne cursors, no leakage). Test case 6 verifies.

import { useState, useMemo, useCallback } from 'react'
import type { Note, NoteName, Tuning, TimeSignature, KeySignature } from './types'
import {
  NotationScaleLinkCursorContext,
  NotationScaleLinkNotesContext,
  type NotationScaleLinkCursorValue,
  type NotationScaleLinkNotesValue,
} from './NotationScaleLinkContext'
import LazyNotation from '@/components/lazy/LazyNotation'
import LazyScaleOnFretboard from '@/components/lazy/LazyScaleOnFretboard'

export type NotationScaleLinkProps = {
  id: string
  notes: Note[]
  // Notation-specific:
  timeSignature?: TimeSignature
  keySignature?: KeySignature
  // ScaleOnFretboard-specific:
  rootNote?: NoteName
  tuning?: Tuning
  fretCount?: number
  showArrows?: boolean
  showDegrees?: boolean
  // Shared:
  defaultBpm?: number
  enableAudio?: boolean
}

export default function NotationScaleLink(props: NotationScaleLinkProps) {
  const {
    id,
    notes,
    timeSignature,
    keySignature,
    rootNote,
    tuning,
    fretCount,
    showArrows,
    showDegrees,
    defaultBpm,
    enableAudio,
  } = props

  // Wrapper-level chord-on-staff validation (Kolizja #2 mitigation per ADR-059).
  // Wrapper throws first; ScaleOnFretboard standalone throw = defense in depth.
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!
    if (n.pitch && Array.isArray(n.pitch)) {
      throw new Error(
        `NotationScaleLink "${id}": chord-on-staff Note at index ${i} rejected (pitch is array). ` +
        `Linked mode supports monophonic scales only. Use standalone <Notation/> for chord demos, ` +
        `or split chord into separate Note entries.`,
      )
    }
  }

  // Internal cursor state — owned by wrapper Provider scope (per-instance).
  const [currentNoteIdx, setCurrentNoteIdx] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Context split (per ADR-059 + plan §3.5 LOCK): cursor mutable (per-note updates) vs
  // notes stable (per wrapper mount). Step 20 React DevTools Profiler verifies że
  // Fretboard NIE re-renderuje per cursor change (notes consumer stable reference).
  const cursorValue = useMemo<NotationScaleLinkCursorValue>(
    () => ({ currentNoteIdx, isPlaying, setCurrentNoteIdx, setIsPlaying }),
    [currentNoteIdx, isPlaying],
  )

  const notesValue = useMemo<NotationScaleLinkNotesValue>(
    () => ({ notes }),
    [notes],
  )

  // Notation external onNoteStart wiring — receives entry.origIdx (per ADR-059
  // semantic contract), dispatch do cursor context. Stable identity via useCallback
  // dla Notation memoization (NIE re-renderuje per parent re-render).
  const handleNotationNoteStart = useCallback((idx: number, scheduledMs: number) => {
    void scheduledMs
    setCurrentNoteIdx(idx)
  }, [])

  return (
    <div className="flex flex-col gap-4" data-notation-scale-link-id={id}>
      <NotationScaleLinkNotesContext.Provider value={notesValue}>
        <NotationScaleLinkCursorContext.Provider value={cursorValue}>
          <LazyNotation
            id={`${id}-notation`}
            notes={notes}
            timeSignature={timeSignature}
            keySignature={keySignature}
            defaultBpm={defaultBpm}
            enableAudio={enableAudio}
            onNoteStart={handleNotationNoteStart}
          />
          <LazyScaleOnFretboard
            id={`${id}-fretboard`}
            notes={notes}
            rootNote={rootNote}
            tuning={tuning}
            fretCount={fretCount}
            showArrows={showArrows}
            showDegrees={showDegrees}
            showBpmControl={false}
            enableAudio={false}
          />
        </NotationScaleLinkCursorContext.Provider>
      </NotationScaleLinkNotesContext.Provider>
    </div>
  )
}
