// Vitest + assertions. Hard rule #2 — no mocks (pure functions, real imports).
// Target ≥80% line coverage `music-theory.ts`.

import { describe, it, expect } from 'vitest'
import {
  noteAtPosition, positionsOfNote, scaleNotes, chordNotes,
  intervalBetween, spellNote, detectChord, spellChordDegrees,
  STANDARD_TUNING,
} from '../music-theory'
import { ALL_TUNINGS, OPEN_C } from '../tunings'
import type { NoteName, ChordType } from '../types'

describe('noteAtPosition', () => {
  it('Standard tuning open strings → E2 A2 D3 G3 B3 E4', () => {
    const expected = [
      { name: 'E', octave: 2 }, { name: 'A', octave: 2 }, { name: 'D', octave: 3 },
      { name: 'G', octave: 3 }, { name: 'B', octave: 3 }, { name: 'E', octave: 4 },
    ]
    STANDARD_TUNING.strings.forEach((_, idx) => {
      expect(noteAtPosition(STANDARD_TUNING, { string: idx, fret: 0 })).toEqual(expected[idx])
    })
  })

  it('Standard string 0 fret 7 = B2 (smoke #2)', () => {
    expect(noteAtPosition(STANDARD_TUNING, { string: 0, fret: 7 })).toEqual({ name: 'B', octave: 2 })
  })

  it('Standard string 5 fret 12 = E5 octave crossover (smoke #3)', () => {
    expect(noteAtPosition(STANDARD_TUNING, { string: 5, fret: 12 })).toEqual({ name: 'E', octave: 5 })
  })

  it('Standard string 4 fret 1 = C4 (B3 + 1 octave crossover)', () => {
    expect(noteAtPosition(STANDARD_TUNING, { string: 4, fret: 1 })).toEqual({ name: 'C', octave: 4 })
  })

  it('Open C string 4 open = C4 (crossover entry — string 4 starts at oct 4, not 3)', () => {
    expect(noteAtPosition(OPEN_C, { string: 4, fret: 0 })).toEqual({ name: 'C', octave: 4 })
  })

  it('all 8 tunings × frets {0,5,7,12} produce valid PitchedNote (oct ∈ [2..5])', () => {
    for (const tuning of ALL_TUNINGS) {
      for (const fret of [0, 5, 7, 12]) {
        for (let stringIdx = 0; stringIdx < tuning.strings.length; stringIdx++) {
          const result = noteAtPosition(tuning, { string: stringIdx, fret })
          expect(result.octave).toBeGreaterThanOrEqual(2)
          expect(result.octave).toBeLessThanOrEqual(5)
        }
      }
    }
  })

  it('unknown tuning throws explicit error', () => {
    expect(() => noteAtPosition(
      { name: 'NonExistent', strings: ['E', 'A', 'D', 'G', 'B', 'E'] },
      { string: 0, fret: 0 },
    )).toThrow(/Unknown tuning/)
  })

  it('invalid string index throws', () => {
    expect(() => noteAtPosition(STANDARD_TUNING, { string: 99, fret: 0 }))
      .toThrow(/Invalid string index/)
  })
})

describe('positionsOfNote', () => {
  it('Standard 12-fret E has multiple positions including open + 12 on lowest + highest string', () => {
    const positions = positionsOfNote(STANDARD_TUNING, 12, 'E')
    expect(positions.length).toBeGreaterThanOrEqual(4)
    expect(positions).toContainEqual({ string: 0, fret: 0 })
    expect(positions).toContainEqual({ string: 0, fret: 12 })
    expect(positions).toContainEqual({ string: 5, fret: 0 })
    expect(positions).toContainEqual({ string: 5, fret: 12 })
  })

  it('enharmonic input normalize identycznie (Eb = D#)', () => {
    const eb = positionsOfNote(STANDARD_TUNING, 12, 'Eb')
    const dSharp = positionsOfNote(STANDARD_TUNING, 12, 'D#')
    expect(eb).toEqual(dSharp)
  })
})

describe('intervalBetween — canonical rules', () => {
  it('C to Eb = m3 (smoke #5)', () => expect(intervalBetween('C', 'Eb')).toBe('m3'))
  it('C to D# = m3 (enharmonic input normalize)', () => {
    expect(intervalBetween('C', 'D#')).toBe('m3')
  })
  it('C to G# = #5 (NOT b6)', () => expect(intervalBetween('C', 'G#')).toBe('#5'))
  it('C to Ab = #5 (enharmonic input → canonical #5)', () => {
    expect(intervalBetween('C', 'Ab')).toBe('#5')
  })
  it('C to Bb = m7 (NOT b7)', () => expect(intervalBetween('C', 'Bb')).toBe('m7'))
  it('C to A# = m7 (enharmonic Bb)', () => expect(intervalBetween('C', 'A#')).toBe('m7'))

  const roots: NoteName[] = ['C', 'G', 'D', 'F#', 'Bb']
  const canonical: Record<number, string> = {
    0: 'R', 1: 'b2', 2: '2', 3: 'm3', 4: '3', 5: '4',
    6: 'b5', 7: '5', 8: '#5', 9: '6', 10: 'm7', 11: '7',
  }
  const rootPCMap: Record<string, number> = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11, 'F#': 6, 'Bb': 10,
  }
  const targetSharps: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

  for (const root of roots) {
    for (let semis = 0; semis < 12; semis++) {
      const rootPC = rootPCMap[root] ?? 0
      const target = targetSharps[(rootPC + semis) % 12] as NoteName
      const expected = canonical[semis]
      it(`${root} + ${semis} semitones → ${expected} (target=${target})`, () => {
        expect(intervalBetween(root, target)).toBe(expected)
      })
    }
  }
})

describe('scaleNotes — major (15 keys, full enharmonic per D0.2)', () => {
  const majorExpected: Record<string, NoteName[]> = {
    'C':  ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'G':  ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    'D':  ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
    'A':  ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
    'E':  ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
    'B':  ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
    'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
    'C#': ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
    'F':  ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
    'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
    'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
    'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
    'Gb': ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
    'Cb': ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
  }
  for (const [root, expected] of Object.entries(majorExpected)) {
    it(`${root} major = ${expected.join(' ')}`, () => {
      expect(scaleNotes(root as NoteName, 'major')).toEqual(expected)
    })
  }
})

describe('scaleNotes — minor + modes + pentatonics + blues (full enharmonic)', () => {
  it('A natural minor (relative-major C, no accidentals)', () => {
    expect(scaleNotes('A', 'naturalMinor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })
  it('D natural minor (relative-major F, Bb)', () => {
    expect(scaleNotes('D', 'naturalMinor')).toEqual(['D', 'E', 'F', 'G', 'A', 'Bb', 'C'])
  })
  it('F# natural minor (relative-major A, 3 sharps)', () => {
    expect(scaleNotes('F#', 'naturalMinor')).toEqual(['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'])
  })

  it('A harmonic minor (raised 7th = G#)', () => {
    expect(scaleNotes('A', 'harmonicMinor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G#'])
  })
  it('A melodic minor ascending (raised 6+7 = F# G#)', () => {
    expect(scaleNotes('A', 'melodicMinor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F#', 'G#'])
  })

  it('D dorian (parent C major)', () => {
    expect(scaleNotes('D', 'dorian')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C'])
  })
  it('G mixolydian (parent C major)', () => {
    expect(scaleNotes('G', 'mixolydian')).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F'])
  })
  it('E phrygian (parent C major)', () => {
    expect(scaleNotes('E', 'phrygian')).toEqual(['E', 'F', 'G', 'A', 'B', 'C', 'D'])
  })
  it('F lydian (parent C major)', () => {
    expect(scaleNotes('F', 'lydian')).toEqual(['F', 'G', 'A', 'B', 'C', 'D', 'E'])
  })
  it('B locrian (parent C major)', () => {
    expect(scaleNotes('B', 'locrian')).toEqual(['B', 'C', 'D', 'E', 'F', 'G', 'A'])
  })

  it('C pentatonicMajor', () => {
    expect(scaleNotes('C', 'pentatonicMajor')).toEqual(['C', 'D', 'E', 'G', 'A'])
  })
  it('A pentatonicMinor', () => {
    expect(scaleNotes('A', 'pentatonicMinor')).toEqual(['A', 'C', 'D', 'E', 'G'])
  })
  it('A bluesMinor (pentMinor + b5 = added Eb)', () => {
    expect(scaleNotes('A', 'bluesMinor')).toEqual(['A', 'C', 'D', 'Eb', 'E', 'G'])
  })
  it('C bluesMajor (pentMajor + b3 = added Eb)', () => {
    expect(scaleNotes('C', 'bluesMajor')).toEqual(['C', 'D', 'Eb', 'E', 'G', 'A'])
  })

  it('G# melodic minor — double-altered 7th (F##) → enharmonic fallback to G', () => {
    const result = scaleNotes('G#', 'melodicMinor')
    expect(result[0]).toBe('G#')
    expect(result[6]).toBe('G')
  })

  it('G# harmonic minor — double-altered 7th (F##) → enharmonic fallback to G', () => {
    const result = scaleNotes('G#', 'harmonicMinor')
    expect(result[0]).toBe('G#')
    expect(result[6]).toBe('G')
  })
})

describe('chordNotes — full assertions (5 representative) + smoke-exists (21 remaining)', () => {
  it('C maj = C E G', () => expect(chordNotes('C', 'maj')).toEqual(['C', 'E', 'G']))
  it('A min = A C E', () => expect(chordNotes('A', 'min')).toEqual(['A', 'C', 'E']))
  it('G 7 = G B D F', () => expect(chordNotes('G', '7')).toEqual(['G', 'B', 'D', 'F']))
  it('D maj7 = D F# A C#', () => expect(chordNotes('D', 'maj7')).toEqual(['D', 'F#', 'A', 'C#']))
  it('B dim7 = B D F Ab (bb7 → Ab enharmonic per NoteName 21-entry limit)', () => {
    const result = chordNotes('B', 'dim7')
    expect(result[0]).toBe('B')
    expect(result[1]).toBe('D')
    expect(result[2]).toBe('F')
    expect(['Ab', 'A']).toContain(result[3])
  })

  for (const root of ['C', 'F#', 'Bb'] as NoteName[]) {
    it(`${root} maj has 3 notes`, () => expect(chordNotes(root, 'maj')).toHaveLength(3))
    it(`${root} min has 3 notes`, () => expect(chordNotes(root, 'min')).toHaveLength(3))
  }

  const remainingChordTypes: ChordType[] = [
    '5', 'dim', 'aug', 'sus2', 'sus4', '6', 'min6', 'min7', 'min7b5', '7sus4',
    '9', 'maj9', 'min9', 'add9', 'min(add9)', '7b9', '7#9', '7b5', '7#5', '11', '13',
  ]
  for (const type of remainingChordTypes) {
    it(`${type} produces non-empty array starting with root for C`, () => {
      const result = chordNotes('C', type)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toBe('C')
    })
  }
})

describe('spellNote (full enharmonic — D0.2)', () => {
  it('explicit sharps override (Bb → A#)', () => {
    expect(spellNote('Bb', { preference: 'sharps' })).toBe('A#')
  })
  it('explicit flats override (F# → Gb)', () => {
    expect(spellNote('F#', { preference: 'flats' })).toBe('Gb')
  })
  it('no context → sharps fallback (A# → A#)', () => {
    expect(spellNote('A#', {})).toBe('A#')
  })
  it('key context (Eb major dictates Bb spelling)', () => {
    expect(spellNote('A#', { key: 'Eb' })).toBe('Bb')
  })
  it('key context chromatic note (Eb major, F# not in scale → flat direction Gb)', () => {
    expect(spellNote('F#', { key: 'Eb' })).toBe('Gb')
  })
})

describe('stub functions (D0.1)', () => {
  it('detectChord returns null (stub for v5-11)', () => {
    expect(detectChord(['C', 'E', 'G'])).toBeNull()
  })
  it('spellChordDegrees returns [] (stub for v5-12)', () => {
    expect(spellChordDegrees({ root: 'C', type: 'maj' })).toEqual([])
  })
})
