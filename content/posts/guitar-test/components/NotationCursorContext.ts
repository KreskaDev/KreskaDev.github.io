// NotationCursorContext — generic cross-widget cursor coordinator (v5-17 per ADR-061).
// Supersedes ADR-059 (NotationScaleLinkContext scoped na single ScaleOnFretboard passive).
// Multi-passive multi-consumer pattern: any future widget consuming Note[] z cursor sync
// imports z tego pliku. Backward compat aliases dla v5-16.2 demos D9-D10 zero-break.
//
// Performance split (carry-over z ADR-059): cursor (mutable per-note) vs notes (stable per
// wrapper mount). Two contexts → Tablature/ScaleOnFretboard/etc. subscribe do mutable cursor
// only; notes consumer subscribes do stable notes only (Fretboard base zero rerender per
// cursor change).

import { createContext, useContext } from 'react'
import type { Note } from './types'

export type NotationCursorContextValue = {
  currentNoteIdx: number | null
  isPlaying: boolean
  setCurrentNoteIdx: (idx: number | null) => void
  setIsPlaying: (playing: boolean) => void
} | null

export type NotationNotesContextValue = {
  notes: Note[]
} | null

export const NotationCursorContext = createContext<NotationCursorContextValue>(null)
export const NotationNotesContext = createContext<NotationNotesContextValue>(null)

export const useNotationCursor = () => useContext(NotationCursorContext)
export const useNotationNotes = () => useContext(NotationNotesContext)

// === Backward compat aliases (ADR-061 supersedes ADR-059; zero-break v5-16.2 demos) ===

/** @deprecated since v5-17 (ADR-061). Use NotationCursorContext. */
export const NotationScaleLinkCursorContext = NotationCursorContext
/** @deprecated since v5-17 (ADR-061). Use NotationNotesContext. */
export const NotationScaleLinkNotesContext = NotationNotesContext

/** @deprecated since v5-17 (ADR-061). Use NotationCursorContextValue. */
export type NotationScaleLinkCursorValue = NotationCursorContextValue
/** @deprecated since v5-17 (ADR-061). Use NotationNotesContextValue. */
export type NotationScaleLinkNotesValue = NotationNotesContextValue
