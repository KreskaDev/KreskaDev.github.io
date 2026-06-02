// tab-generator.ts — CSP solver: Note[] z pitch info → Note[] z dodanym position field.
// Pure function, deterministic, side-effect-free. Pierwszy konsument forward-compat
// `tuning?: Tuning | TuningName` z ADR-058/ADR-062. Per ADR-063: heurystyczna funkcja
// kosztu (unary + binary) na pełnym Viterbi DP (NIE artificial sliding window — K małe,
// pełny lookahead trivial). Anchor sequence = monophonic non-rest notes; chord notes,
// rest notes i malformed (brak pitch) pass-through verbatim — Tablature contract
// (ADR-060) zakazuje explicit position dla chord-Note, więc chord auto-derive pozostaje
// per-pitch first-match w runtime widgetu.
//
// Hard rule #2: pure math — testy używają realnych imports (ZERO mocks).

import type { FretPosition, Note, NotePitch, Tuning } from './types'
import { getPositions } from './note-positions'
import { resolveTuning, type TuningName } from './tunings'

export type TabGeneratorOptions = {
  tuning?: Tuning | TuningName
  maxFret?: number             // default 12; granica getPositions lookup
  handStretch?: number          // default 4; raw fret diff threshold dla soft penalty
  preferredPositions?: number[] // default [0, 5, 7]; pull do tych frets w unary
}

const DEFAULT_MAX_FRET = 12
const DEFAULT_HAND_STRETCH = 4
const DEFAULT_PREFERRED_POSITIONS: readonly number[] = [0, 5, 7] as const

// Heurystyki — wagi per ADR-063 (kalibrowane empirycznie na C-dur + A-pentatonic minor;
// dokumentacja kompromisów w sekcji "Consequences" ADR).
const OPEN_STRING_BONUS = -0.5
const HIGH_FRET_PENALTY_THRESHOLD = 12
const HIGH_FRET_PENALTY = 0.3
const PREFERRED_DIST_WEIGHT = 0.5
const FRET_DIFF_WEIGHT = 0.5
const STRING_DIFF_WEIGHT = 0.2
const OPEN_TRANSIT_DISCOUNT = 0.5
const STRETCH_PENALTY_WEIGHT = 3.0

type Anchor = {
  noteIdx: number              // index w input notes[]
  candidates: FretPosition[]   // pojedynczy element jeśli explicit; inaczej pełny getPositions
  isExplicit: boolean          // true → preserve verbatim w output (idempotency)
}

type Cell = {
  cost: number   // suma cost na ścieżce do tego stanu
  prev: number   // index w poprzednim anchor.candidates (-1 jeśli a===0)
}

export function generateTabPositions(
  notes: Note[],
  options: TabGeneratorOptions = {},
): Note[] {
  const tuning = resolveTuning(options.tuning)
  const maxFret = options.maxFret ?? DEFAULT_MAX_FRET
  const handStretch = options.handStretch ?? DEFAULT_HAND_STRETCH
  const preferredPositions = options.preferredPositions ?? DEFAULT_PREFERRED_POSITIONS

  // Etap 1: zbuduj anchor sequence. Chord notes (pitch[]), rest, malformed = skip
  // (pass-through w output unchanged). Tablature kontrakt: chord + position = throw,
  // więc generator NIE dotyka chord notes; runtime widget per-pitch first-match.
  const anchors: Anchor[] = []
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!
    if (n.rest) continue
    if (!n.pitch) continue
    if (Array.isArray(n.pitch)) continue
    if (n.position) {
      anchors.push({ noteIdx: i, candidates: [n.position], isExplicit: true })
      continue
    }
    const pitch = n.pitch as NotePitch
    const candidates = getPositions(pitch, { tuning, maxFret })
    if (candidates.length === 0) {
      const acc = pitch.accidental === 'natural' ? '' : (pitch.accidental ?? '')
      throw new Error(
        `generateTabPositions: pitch ${pitch.letter}${acc}${pitch.octave} ` +
          `unreachable in tuning "${tuning.name}" within maxFret=${maxFret} ` +
          `(note index ${i}). Adjust maxFret or use different tuning.`,
      )
    }
    anchors.push({ noteIdx: i, candidates, isExplicit: false })
  }

  // Etap 2: Viterbi DP. O(N * K²) — N≤30, K≤6 → trivial w sub-ms range.
  const dp: Cell[][] = []
  for (let a = 0; a < anchors.length; a++) {
    const cur = anchors[a]!
    const row: Cell[] = []
    for (let k = 0; k < cur.candidates.length; k++) {
      const pos = cur.candidates[k]!
      const u = unaryCost(pos, preferredPositions)
      if (a === 0) {
        row.push({ cost: u, prev: -1 })
        continue
      }
      const prevRow = dp[a - 1]!
      const prevCands = anchors[a - 1]!.candidates
      let bestCost = Infinity
      let bestPrev = 0
      for (let j = 0; j < prevRow.length; j++) {
        const b = binaryCost(prevCands[j]!, pos, handStretch)
        const total = prevRow[j]!.cost + b + u
        if (total < bestCost) {
          bestCost = total
          bestPrev = j
        }
      }
      row.push({ cost: bestCost, prev: bestPrev })
    }
    dp.push(row)
  }

  // Etap 3: backtrace — znajdź najtańszy terminal, walkuj prev pointers.
  const chosenIdx: number[] = new Array(anchors.length)
  if (anchors.length > 0) {
    const last = dp[dp.length - 1]!
    let bestK = 0
    let bestCost = Infinity
    for (let k = 0; k < last.length; k++) {
      if (last[k]!.cost < bestCost) {
        bestCost = last[k]!.cost
        bestK = k
      }
    }
    chosenIdx[anchors.length - 1] = bestK
    for (let a = anchors.length - 1; a > 0; a--) {
      chosenIdx[a - 1] = dp[a]![chosenIdx[a]!]!.prev
    }
  }

  // Etap 4: zbuduj output. Nigdy NIE mutujemy input — slice + spread per note.
  // Explicit anchors: zachowaj verbatim (idempotency: re-run zwraca ten sam Note[]).
  // Non-anchor notes (rest, chord, malformed): pass-through unchanged.
  const out = notes.slice()
  for (let a = 0; a < anchors.length; a++) {
    const anchor = anchors[a]!
    if (anchor.isExplicit) continue
    const chosen = anchor.candidates[chosenIdx[a]!]!
    const original = out[anchor.noteIdx]!
    out[anchor.noteIdx] = { ...original, position: chosen }
  }
  return out
}

// Unary cost: preferencja open string + close-to-preferred-positions + kara high fret.
function unaryCost(pos: FretPosition, preferred: readonly number[]): number {
  let cost = 0
  if (pos.fret === 0) {
    cost += OPEN_STRING_BONUS
  } else if (pos.fret > HIGH_FRET_PENALTY_THRESHOLD) {
    cost += HIGH_FRET_PENALTY
  }
  if (preferred.length > 0) {
    let minDist = Infinity
    for (const p of preferred) {
      const d = Math.abs(pos.fret - p)
      if (d < minDist) minDist = d
    }
    cost += minDist * PREFERRED_DIST_WEIGHT
  }
  return cost
}

// Binary cost: ruch ręki (fret diff dominujący + string diff minor) + soft stretch
// penalty gdy raw fret diff > handStretch i żadna ze stron NIE jest open (open string
// nie wymaga przesunięcia ręki). Open transit dodatkowo dyskontuje fret diff.
function binaryCost(
  prev: FretPosition,
  cur: FretPosition,
  handStretch: number,
): number {
  const prevOpen = prev.fret === 0
  const curOpen = cur.fret === 0
  const rawFretDiff = Math.abs(prev.fret - cur.fret)
  const stringDiff = Math.abs(prev.string - cur.string)

  let fretDiff = rawFretDiff
  if (prevOpen || curOpen) {
    fretDiff *= OPEN_TRANSIT_DISCOUNT
  }
  let cost = fretDiff * FRET_DIFF_WEIGHT + stringDiff * STRING_DIFF_WEIGHT
  if (!prevOpen && !curOpen && rawFretDiff > handStretch) {
    cost += (rawFretDiff - handStretch) * STRETCH_PENALTY_WEIGHT
  }
  return cost
}
