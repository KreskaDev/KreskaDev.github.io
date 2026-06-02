// NotationScaleLinkContext — Pattern C cross-widget cursor coordinator (per ADR-059).
// Osobny plik (NIE in-component createContext) dla circular-import prevention między
// ScaleOnFretboard.tsx (v5-16.1 consumer) i NotationScaleLink.tsx (v5-16.2 Provider).
// Skeleton wprowadzony w v5-16.1 Step 5 z full state shape declared; Provider w v5-16.2.
//
// Performance split (per ADR-059 + plan §3.5): cursor (mutable per-note) vs notes (stable
// per wrapper mount). Two contexts → ScaleOnFretboard subscribes do mutable cursor only;
// notes consumer (jeśli future iter dodaje) subscribes do stable notes only.

import { createContext } from 'react'
import type { Note } from './types'

export type NotationScaleLinkCursorValue = {
  currentNoteIdx: number | null
  isPlaying: boolean
  setCurrentNoteIdx: (idx: number | null) => void
  setIsPlaying: (playing: boolean) => void
} | null

export type NotationScaleLinkNotesValue = {
  notes: Note[]
} | null

export const NotationScaleLinkCursorContext = createContext<NotationScaleLinkCursorValue>(null)
export const NotationScaleLinkNotesContext = createContext<NotationScaleLinkNotesValue>(null)
