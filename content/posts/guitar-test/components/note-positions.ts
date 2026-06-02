// note-positions.ts — pitch ↔ FretPosition[] lookup (v5-16 first consumer per ADR-058).
// Pure function + runtime derivation via shipped noteAtPosition (music-theory.ts) —
// single source of truth dla enharmonic logic. Memoization w module-scope Map; reset
// dla test isolation via __resetPositionsCacheForTests.
//
// Hard rule #2: pure math, testy używają real imports (ZERO mocks).

import type { FretPosition, NotePitch, Tuning } from './types'
import { noteAtPosition, STANDARD_TUNING } from './music-theory'

export type PositionLookupOptions = {
  tuning?: Tuning      // default STANDARD_TUNING
  maxFret?: number     // default 12; clamp [5..24] (MIN/MAX_FRET_COUNT)
}

const DEFAULT_MAX_FRET = 12
const MIN_FRET = 5
const MAX_FRET = 24

// Memoization Map żyje for module lifetime; pitch+tuning+maxFret combos bounded.
// Reset NIE wymagany w prod; test-only __resetPositionsCacheForTests dla isolation.
const POSITIONS_CACHE = new Map<string, FretPosition[]>()

// MIRROR z music-theory.ts:24-37 PITCH_CLASS (private const, NIE exported od music-theory).
// Source of truth: music-theory.ts; update tam najpierw, tu replikuj (drift Risk §8 #5 mitigation).
// 21 entries — matches NoteName union (B#/E#/Fb/Cb dla enharmonic spell support).
const PITCH_CLASS_LOCAL: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
}

// NotePitch → canonical { pc, octave } dla match z noteAtPosition output. Octave
// normalization edge cases: B#3 = pc 0 w octave 3 ale enharmonic z C4 (scientific
// pitch). Cb4 = pc 11 w octave 4 enharmonic z B3. Bez normalizacji 'B#3' nigdy by
// nie matchował 'C4' z noteAtPosition. Edge rzadko triggered (B#/Cb non-canonical)
// ale documented dla correctness wrt CHROMATIC_SHARPS output (pn.name = 'C' dla pc=0).
function toCanonical(p: NotePitch): { pc: number; octave: number } {
  const accSuffix = p.accidental === '#' ? '#' : p.accidental === 'b' ? 'b' : ''
  const noteName = `${p.letter}${accSuffix}`
  const pc = PITCH_CLASS_LOCAL[noteName]
  if (pc === undefined) {
    throw new Error(`note-positions.toCanonical: invalid NotePitch ${noteName}${p.octave}`)
  }
  let octave = p.octave
  if (p.letter === 'B' && p.accidental === '#') octave += 1   // B#3 → octave 4 (= C4)
  if (p.letter === 'C' && p.accidental === 'b') octave -= 1   // Cb4 → octave 3 (= B3)
  return { pc, octave }
}

function pitchKey(p: NotePitch): string {
  const acc = p.accidental ?? ''
  return `${p.letter}${acc}${p.octave}`
}

export function getPositions(
  pitch: NotePitch,
  options?: PositionLookupOptions,
): FretPosition[] {
  const tuning = options?.tuning ?? STANDARD_TUNING
  const maxFret = Math.min(MAX_FRET, Math.max(MIN_FRET, options?.maxFret ?? DEFAULT_MAX_FRET))

  const cacheKey = `${tuning.name}|${pitchKey(pitch)}|${maxFret}`
  const cached = POSITIONS_CACHE.get(cacheKey)
  if (cached) return cached

  const canon = toCanonical(pitch)
  const results: FretPosition[] = []
  for (let stringIdx = 0; stringIdx < tuning.strings.length; stringIdx++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const pn = noteAtPosition(tuning, { string: stringIdx, fret })
      // pn.name jest NoteName z CHROMATIC_SHARPS — max 2 chars: letter + optional '#'.
      // toCanonical(pn) zwraca { pc, octave } po normalizacji enharmonic. Match pc + octave
      // → enharmonic input ('Gb' input vs 'F#' output) match przez canonical pc.
      const pnLetter = pn.name[0] as NotePitch['letter']
      const pnAccidental = pn.name.length === 2 && pn.name[1] === '#' ? '#' : undefined
      const pnCanon = toCanonical({ letter: pnLetter, accidental: pnAccidental, octave: pn.octave })
      if (pnCanon.pc === canon.pc && pnCanon.octave === canon.octave) {
        results.push({ string: stringIdx, fret })
      }
    }
  }
  // Sort: ascending fret + ascending string tiebreaker (Decyzja #3, ADR-058).
  results.sort((a, b) => a.fret - b.fret || a.string - b.string)
  POSITIONS_CACHE.set(cacheKey, results)
  return results
}

// Test-only export — clears cache dla isolation. NIE używaj w prod code.
export function __resetPositionsCacheForTests(): void {
  POSITIONS_CACHE.clear()
}
