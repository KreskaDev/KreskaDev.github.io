// Curated chord shape library — pure data module.
// Zero music-theory.ts dependency (kuratorskie voicings ≠ algorithmic generation).
// Keyed jako "<root>-<type>" matching ChordSpec encoding (`${spec.root}-${spec.type}`).
// Future expansion: dodaj entries bez ADR (data updates ≠ architectural change per
// CLAUDE.md ADR culture). Patrz plan v5-13 §3.2 + Decyzja #1.

import type { ChordShape } from './types'

export const CHORD_SHAPES: Record<string, ChordShape> = {
  // === Open majors (5) ===
  // C-maj — "x32010" — root na A string fret 3 (= C3)
  'C-maj':  { frets: [null, 3, 2, 0, 1, 0], rootStringIndex: 1 },
  // G-maj — "320003" — root na low E fret 3 (= G2)
  'G-maj':  { frets: [3, 2, 0, 0, 0, 3], rootStringIndex: 0 },
  // D-maj — "xx0232" — root na D string open (= D3)
  'D-maj':  { frets: [null, null, 0, 2, 3, 2], rootStringIndex: 2 },
  // E-maj — "022100" — root na low E open (= E2)
  'E-maj':  { frets: [0, 2, 2, 1, 0, 0], rootStringIndex: 0 },
  // A-maj — "x02220" — root na A string open (= A2)
  'A-maj':  { frets: [null, 0, 2, 2, 2, 0], rootStringIndex: 1 },

  // === Open minors (3) ===
  // A-min — "x02210" — root na A string open
  'A-min':  { frets: [null, 0, 2, 2, 1, 0], rootStringIndex: 1 },
  // E-min — "022000" — root na low E open
  'E-min':  { frets: [0, 2, 2, 0, 0, 0], rootStringIndex: 0 },
  // D-min — "xx0231" — root na D string open
  'D-min':  { frets: [null, null, 0, 2, 3, 1], rootStringIndex: 2 },

  // === Barre (1) ===
  // F-maj barre — "133211" — root na low E fret 1 (= F2)
  'F-maj':  { frets: [1, 3, 3, 2, 1, 1], rootStringIndex: 0 },

  // === Extended sevenths (4) ===
  // C-7 dominant — "x32310" — root na A string fret 3
  'C-7':    { frets: [null, 3, 2, 3, 1, 0], rootStringIndex: 1 },
  // D-min7 — "xx0211" — root na D string open
  'D-min7': { frets: [null, null, 0, 2, 1, 1], rootStringIndex: 2 },
  // G-7 dominant — "320001" — root na low E fret 3
  'G-7':    { frets: [3, 2, 0, 0, 0, 1], rootStringIndex: 0 },
  // A-min7 — "x02010" — root na A string open
  'A-min7': { frets: [null, 0, 2, 0, 1, 0], rootStringIndex: 1 },
}
