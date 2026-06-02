// note-positions.test.ts — pure data lookup tests. Hard rule #2: ZERO mocks.
// Expected positions derived live via shipped noteAtPosition (music-theory.ts)
// → fail-loud jeśli music-theory drift'uje (Risk §8 #5 mitigation w ADR-058).

import { describe, test, expect, beforeEach } from 'vitest'
import { getPositions, __resetPositionsCacheForTests } from '../note-positions'
import { noteAtPosition, STANDARD_TUNING } from '../music-theory'
import { DROP_D } from '../tunings'
import type { FretPosition, NotePitch, Tuning, NoteName } from '../types'

// Derive expected positions empirically via shipped noteAtPosition (DRY z music-theory).
// Match canonical via PITCH_CLASS — enharmonic 'Gb' input matches 'F#' output.
function deriveExpected(
  tuning: Tuning,
  maxFret: number,
  letter: NotePitch['letter'],
  accidental: NotePitch['accidental'],
  octave: number,
): FretPosition[] {
  // Local canonical PC (sync z PITCH_CLASS_LOCAL w note-positions.ts).
  const PC: Record<string, number> = {
    'C': 0, 'B#': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'F': 5, 'E#': 5, 'F#': 6, 'Gb': 6, 'G': 7,
    'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11,
  }
  const accSuffix = accidental === '#' ? '#' : accidental === 'b' ? 'b' : ''
  const targetPc = PC[`${letter}${accSuffix}`]
  let targetOctave = octave
  if (letter === 'B' && accidental === '#') targetOctave += 1
  if (letter === 'C' && accidental === 'b') targetOctave -= 1

  const expected: FretPosition[] = []
  for (let s = 0; s < tuning.strings.length; s++) {
    for (let f = 0; f <= maxFret; f++) {
      const pn = noteAtPosition(tuning, { string: s, fret: f })
      const pnLetter = pn.name[0] as NotePitch['letter']
      const pnAcc = pn.name.length === 2 && pn.name[1] === '#' ? '#' : ''
      const pnPc = PC[`${pnLetter}${pnAcc}`]
      if (pnPc === targetPc && pn.octave === targetOctave) {
        expected.push({ string: s, fret: f })
      }
    }
  }
  expected.sort((a, b) => a.fret - b.fret || a.string - b.string)
  return expected
}

describe('note-positions.getPositions', () => {
  beforeEach(() => {
    __resetPositionsCacheForTests()
  })

  test('C3 in STANDARD_TUNING returns sorted positions', () => {
    const out = getPositions({ letter: 'C', octave: 3 })
    const expected = deriveExpected(STANDARD_TUNING, 12, 'C', undefined, 3)
    expect(out).toEqual(expected)
    expect(out.length).toBeGreaterThanOrEqual(2)
  })

  test('E2 open low E — single position [string:0, fret:0]', () => {
    const out = getPositions({ letter: 'E', octave: 2 })
    expect(out).toEqual([{ string: 0, fret: 0 }])
  })

  test('A4 returns multiple high-fret positions', () => {
    const out = getPositions({ letter: 'A', octave: 4 })
    const expected = deriveExpected(STANDARD_TUNING, 12, 'A', undefined, 4)
    expect(out).toEqual(expected)
    expect(out.length).toBeGreaterThanOrEqual(2)
  })

  test('enharmonic F#3 and Gb3 return identical positions (canonical pc match)', () => {
    const sharp = getPositions({ letter: 'F', accidental: '#', octave: 3 })
    const flat = getPositions({ letter: 'G', accidental: 'b', octave: 3 })
    expect(sharp).toEqual(flat)
    expect(sharp.length).toBeGreaterThan(0)
  })

  test('out of range C7 returns empty array within 12-fret coverage', () => {
    const out = getPositions({ letter: 'C', octave: 7 })
    expect(out).toEqual([])
  })

  test('default tuning option = STANDARD_TUNING (explicit pass yields same result)', () => {
    const implicit = getPositions({ letter: 'D', octave: 3 })
    __resetPositionsCacheForTests()
    const explicit = getPositions({ letter: 'D', octave: 3 }, { tuning: STANDARD_TUNING })
    expect(implicit).toEqual(explicit)
  })

  test('24-fret bump exposes high-octave positions beyond 12-fret baseline', () => {
    const out12 = getPositions({ letter: 'A', octave: 5 })
    const out24 = getPositions({ letter: 'A', octave: 5 }, { maxFret: 24 })
    expect(out24.length).toBeGreaterThan(out12.length)
    // Wszystkie 12-fret subset musi być prefix 24-fret superset (same sort criterion).
    for (const p of out12) {
      expect(out24).toContainEqual(p)
    }
  })

  test('memoization returns reference-equal array on repeated call; reset breaks identity', () => {
    const out1 = getPositions({ letter: 'G', octave: 3 })
    const out2 = getPositions({ letter: 'G', octave: 3 })
    expect(out1).toBe(out2)
    __resetPositionsCacheForTests()
    const out3 = getPositions({ letter: 'G', octave: 3 })
    expect(out3).not.toBe(out1)
    expect(out3).toEqual(out1)
  })

  test('sort criterion: ascending fret then ascending string', () => {
    const out = getPositions({ letter: 'B', octave: 3 })
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1]!
      const curr = out[i]!
      const ok = prev.fret < curr.fret || (prev.fret === curr.fret && prev.string < curr.string)
      expect(ok).toBe(true)
    }
  })

  test('Drop D tuning: low D2 = single open string position [string:0, fret:0]', () => {
    const out = getPositions({ letter: 'D', octave: 2 }, { tuning: DROP_D })
    expect(out).toEqual([{ string: 0, fret: 0 }])
  })

  test('NoteName chromatic root coverage — all 12 pitch classes return non-empty in octave 3', () => {
    // Smoke test żeby zweryfikować że canonical PC match działa dla wszystkich 12 chromatic
    // (NIE wszystkie 21 enharmonic spellings — tylko canonical sharps).
    const roots: NotePitch[] = [
      { letter: 'C', octave: 3 },
      { letter: 'C', accidental: '#', octave: 3 },
      { letter: 'D', octave: 3 },
      { letter: 'D', accidental: '#', octave: 3 },
      { letter: 'E', octave: 3 },
      { letter: 'F', octave: 3 },
      { letter: 'F', accidental: '#', octave: 3 },
      { letter: 'G', octave: 3 },
      { letter: 'G', accidental: '#', octave: 3 },
      { letter: 'A', octave: 3 },
      { letter: 'A', accidental: '#', octave: 3 },
      { letter: 'B', octave: 3 },
    ]
    for (const p of roots) {
      expect(getPositions(p).length).toBeGreaterThan(0)
    }
    void ({} as { _placeholder?: NoteName })  // satisfy NoteName import
  })
})
