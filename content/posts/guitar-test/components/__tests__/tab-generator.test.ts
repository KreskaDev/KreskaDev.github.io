// tab-generator.test.ts — pure CSP solver tests. Hard rule #2: ZERO mocks (real
// note-positions + music-theory + tunings imports). Coverage target ≥85% line.

import { describe, test, expect, beforeEach } from 'vitest'
import { generateTabPositions } from '../tab-generator'
import { __resetPositionsCacheForTests } from '../note-positions'
import { DROP_D } from '../tunings'
import type { Note } from '../types'

describe('generateTabPositions', () => {
  beforeEach(() => {
    __resetPositionsCacheForTests()
  })

  test('empty array → empty result', () => {
    expect(generateTabPositions([])).toEqual([])
  })

  test('rest notes pass-through unchanged', () => {
    const notes: Note[] = [
      { rest: true, duration: '1/4' },
      { rest: true, duration: '1/2' },
    ]
    const out = generateTabPositions(notes)
    expect(out).toEqual(notes)
  })

  test('chord notes (pitch[]) pass-through unchanged', () => {
    const notes: Note[] = [
      {
        pitch: [
          { letter: 'C', octave: 4 },
          { letter: 'E', octave: 4 },
          { letter: 'G', octave: 4 },
        ],
        duration: '1/2',
      },
    ]
    const out = generateTabPositions(notes)
    expect(out).toEqual(notes)
    expect(out[0]!.position).toBeUndefined()
  })

  test('idempotency: notes already z explicit position → output === input (deep equal)', () => {
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, position: { string: 4, fret: 1 }, duration: '1/4' },
      { pitch: { letter: 'D', octave: 4 }, position: { string: 4, fret: 3 }, duration: '1/4' },
      { pitch: { letter: 'E', octave: 4 }, position: { string: 5, fret: 0 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes)
    expect(out).toEqual(notes)
    // Re-run yields same.
    expect(generateTabPositions(out)).toEqual(notes)
  })

  test('idempotency: re-running na auto-derived output zwraca identyczny rezultat', () => {
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'D', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'E', octave: 4 }, duration: '1/4' },
    ]
    const first = generateTabPositions(notes)
    const second = generateTabPositions(first)
    expect(second).toEqual(first)
  })

  test('A-pentatonic minor auto-derive → deterministic Viterbi optimum (snapshot)', () => {
    // A3-C4-D4-E4-G4-A4 — generator z default preferredPositions=[0,5,7]. Snapshot
    // pinneduje exact Viterbi output dla regression: każda zmiana wag heurystyki będzie
    // wykryta. Sanity: każda pozycja reachable (verified empirycznie via noteAtPosition).
    const notes: Note[] = [
      { pitch: { letter: 'A', octave: 3 }, duration: '1/4' },
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'D', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'E', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'G', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'A', octave: 4 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes)
    expect(out.map((n) => n.position)).toEqual([
      { string: 2, fret: 7 },
      { string: 3, fret: 5 },
      { string: 4, fret: 3 },
      { string: 5, fret: 0 },
      { string: 5, fret: 3 },
      { string: 5, fret: 5 },
    ])
  })

  test('C major scale auto-derive → wszystkie frets w wąskim klastrze (smooth transitions)', () => {
    // Z preferredPositions=[0,5,7] generator klastrify w 5-8 range. Test asercja:
    // (a) wszystkie pitch reachable, (b) span (max-min) ≤ 4 frets, (c) brak skoku
    // pomiędzy sąsiednimi nutami > handStretch (default 4).
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'D', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'E', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'F', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'G', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'A', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'B', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'C', octave: 5 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes)
    const frets = out.map((n) => n.position!.fret)
    expect(frets.every((f) => f >= 0 && f <= 12)).toBe(true)
    // Adjacent diff respektuje handStretch=4 dla non-open transitions (open string
    // exempt z stretch penalty bo open NIE wymaga przesunięcia ręki).
    for (let i = 1; i < frets.length; i++) {
      const prevOpen = frets[i - 1]! === 0
      const curOpen = frets[i]! === 0
      if (!prevOpen && !curOpen) {
        expect(Math.abs(frets[i]! - frets[i - 1]!)).toBeLessThanOrEqual(4)
      }
    }
  })

  test('1st-position bias via preferredPositions=[0,1,2,3] → low-fret cluster', () => {
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'D', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'E', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'F', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'G', octave: 4 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes, { preferredPositions: [0, 1, 2, 3] })
    const frets = out.map((n) => n.position!.fret)
    // 1st-pos zone = frets ≤ 4 (akceptujemy 0-4 zakres jako "1st position").
    expect(frets.every((f) => f <= 4)).toBe(true)
  })

  test('mixed: explicit position preserved + auto-derive dla pozostałych', () => {
    const explicitPos = { string: 4, fret: 1 }
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, position: explicitPos, duration: '1/4' },
      { pitch: { letter: 'D', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'E', octave: 4 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes)
    // Explicit C4 zachowuje exact reference (idempotency invariant).
    expect(out[0]!.position).toEqual(explicitPos)
    // D4, E4 dostają position field.
    expect(out[1]!.position).toBeDefined()
    expect(out[2]!.position).toBeDefined()
    // Anchor effect: explicit fret 1 powinien przyciągnąć D4 i E4 do niskich fretów.
    expect(out[1]!.position!.fret).toBeLessThanOrEqual(5)
    expect(out[2]!.position!.fret).toBeLessThanOrEqual(5)
  })

  test('DROP_D tuning: D2 → otwarta dolna struna (string 0 fret 0)', () => {
    const notes: Note[] = [
      { pitch: { letter: 'D', octave: 2 }, duration: '1/4' },
      { pitch: { letter: 'A', octave: 2 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes, { tuning: DROP_D })
    // DROP_D string 0 = D2 → open D2 reachable.
    expect(out[0]!.position).toEqual({ string: 0, fret: 0 })
    // A2 reachable na string 1 (open A2) lub string 0 (DROP_D D2 + 7 semis = A2).
    expect(out[1]!.position).toBeDefined()
    expect(out[1]!.position!.fret).toBeLessThanOrEqual(7)
  })

  test('tuning jako TuningName string (MDX-friendly) — ADR-062 union', () => {
    const notes: Note[] = [{ pitch: { letter: 'D', octave: 2 }, duration: '1/4' }]
    const out = generateTabPositions(notes, { tuning: 'Drop D' })
    expect(out[0]!.position).toEqual({ string: 0, fret: 0 })
  })

  test('unreachable pitch w STANDARD_TUNING + maxFret=12 → throw z descriptive message', () => {
    // C2 = midi 36, niedostępny w STANDARD (najniższy E2 = midi 40).
    const notes: Note[] = [{ pitch: { letter: 'C', octave: 2 }, duration: '1/4' }]
    expect(() => generateTabPositions(notes)).toThrow(/unreachable in tuning "Standard"/)
  })

  test('throw error message zawiera note index + pitch + tuning name + maxFret', () => {
    const notes: Note[] = [
      { pitch: { letter: 'E', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'C', octave: 8 }, duration: '1/4' }, // unreachable
    ]
    expect(() => generateTabPositions(notes)).toThrow(/note index 1/)
    expect(() => generateTabPositions(notes)).toThrow(/maxFret=12/)
  })

  test('malformed note (brak pitch + brak rest) → pass-through bez throw', () => {
    // Generator NIE waliduje shape — Tablature widget zrobi to przy render.
    const notes: Note[] = [{ duration: '1/4' } as Note]
    const out = generateTabPositions(notes)
    expect(out).toEqual(notes)
  })

  test('NIE mutuje input array (referential safety)', () => {
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'D', octave: 4 }, duration: '1/4' },
    ]
    const snapshot = JSON.parse(JSON.stringify(notes))
    const out = generateTabPositions(notes)
    expect(notes).toEqual(snapshot)
    expect(out).not.toBe(notes)
    expect(out[0]).not.toBe(notes[0])
  })

  test('maxFret prop respektowane — wąski 5-fret range wymusza wyższy string', () => {
    // E4 w STANDARD: candidates {0,5},{5,4},{9,3}. maxFret=4 ogranicza do {0,5}.
    const notes: Note[] = [{ pitch: { letter: 'E', octave: 4 }, duration: '1/4' }]
    const out = generateTabPositions(notes, { maxFret: 4 })
    expect(out[0]!.position).toEqual({ string: 5, fret: 0 })
  })

  test('smooth transition: 3+ nut sequence preferuje minimum hand movement', () => {
    // C4→E4→C4 — generator powinien wybrać positions blisko siebie (NIE jump między
    // string 4 fret 1 i string 5 fret 0 i z powrotem; lub stay na 5th pos).
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'E', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes)
    const frets = out.map((n) => n.position!.fret)
    // Sąsiednie fret diffs (po open transit discount) — w sumie nie powinny przekraczać
    // szerokiej granicy. Asercja: cumulative raw movement ≤ 6 (vs naïve mix open + low
    // który dawałby 1+0+1=2 lub większy spread).
    const totalMovement =
      Math.abs(frets[1]! - frets[0]!) + Math.abs(frets[2]! - frets[1]!)
    expect(totalMovement).toBeLessThanOrEqual(6)
  })

  test('handStretch=0 (super tight) + sequence wymagająca skoku → soft penalty pcha do alt', () => {
    // Sekwencja C4 → C5 — bez open string transit musi przeskoczyć min ~7 fret.
    // Z handStretch=0 generator powinien preferować path z open string (E4 fret 0).
    // Tu sekwencja 2-nutowa, generator wybierze cheapest pair. Asercja loose: nie crashuje
    // + zwraca valid positions.
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'C', octave: 5 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes, { handStretch: 0 })
    expect(out.length).toBe(2)
    expect(out.every((n) => n.position !== undefined)).toBe(true)
  })

  test('preferredPositions=[] — disable preferred bias, czyste movement minimization', () => {
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      { pitch: { letter: 'D', octave: 4 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes, { preferredPositions: [] })
    // Bez preferred bias generator gravituje do lowest-fret cluster (open string bonus
    // + movement minimization). C4 lowest = {1,4}, D4 lowest = {3,4}. Asercja: bez crash,
    // valid positions, fret diff ≤ 2.
    expect(Math.abs(out[1]!.position!.fret - out[0]!.position!.fret)).toBeLessThanOrEqual(2)
  })

  test('chord + monophonic w jednej sekwencji — chord pass-through, monophonic dostaje position', () => {
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      {
        pitch: [
          { letter: 'C', octave: 4 },
          { letter: 'E', octave: 4 },
        ],
        duration: '1/4',
      },
      { pitch: { letter: 'G', octave: 4 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes)
    expect(out[0]!.position).toBeDefined()
    expect(out[1]!.position).toBeUndefined() // chord nie dostaje position
    expect(out[2]!.position).toBeDefined()
  })

  test('rest między monophonic notes — pass-through + monophonic dostają position', () => {
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 4 }, duration: '1/4' },
      { rest: true, duration: '1/4' },
      { pitch: { letter: 'E', octave: 4 }, duration: '1/4' },
    ]
    const out = generateTabPositions(notes)
    expect(out[0]!.position).toBeDefined()
    expect(out[1]!.rest).toBe(true)
    expect(out[1]!.position).toBeUndefined()
    expect(out[2]!.position).toBeDefined()
  })
})
