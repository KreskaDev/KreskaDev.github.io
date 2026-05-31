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

// ============================================================
// v5-13 — detectChord (weighted confidence + ranked top-3 per ADR-045)
// ============================================================

describe('detectChord — open majors', () => {
  it('[C, E, G] → primary "C maj", confidence ≥0.9', () => {
    const result = detectChord(['C', 'E', 'G'])
    expect(result).not.toBeNull()
    expect(result![0]!.name).toBe('C maj')
    expect(result![0]!.spec).toEqual({ root: 'C', type: 'maj' })
    expect(result![0]!.confidence).toBeGreaterThanOrEqual(0.9)
  })
  it('[G, B, D] → primary "G maj"', () => {
    const result = detectChord(['G', 'B', 'D'])
    expect(result![0]!.name).toBe('G maj')
  })
  it('[D, F#, A] → primary "D maj"', () => {
    const result = detectChord(['D', 'F#', 'A'])
    expect(result![0]!.name).toBe('D maj')
  })
  it('[A, C#, E] → primary "A maj"', () => {
    const result = detectChord(['A', 'C#', 'E'])
    expect(result![0]!.name).toBe('A maj')
  })
  it('[E, G#, B] → primary "E maj"', () => {
    const result = detectChord(['E', 'G#', 'B'])
    expect(result![0]!.name).toBe('E maj')
  })
})

describe('detectChord — open minors', () => {
  it('[A, C, E] → primary "A min"', () => {
    const result = detectChord(['A', 'C', 'E'])
    expect(result![0]!.name).toBe('A min')
  })
  it('[E, G, B] → primary "E min"', () => {
    const result = detectChord(['E', 'G', 'B'])
    expect(result![0]!.name).toBe('E min')
  })
  it('[D, F, A] → primary "D min"', () => {
    const result = detectChord(['D', 'F', 'A'])
    expect(result![0]!.name).toBe('D min')
  })
})

describe('detectChord — barre + dim/aug', () => {
  it('[F, A, C] → primary "F maj"', () => {
    const result = detectChord(['F', 'A', 'C'])
    expect(result![0]!.name).toBe('F maj')
  })
  it('[B, D, F#] → primary "B min"', () => {
    const result = detectChord(['B', 'D', 'F#'])
    expect(result![0]!.name).toBe('B min')
  })
  it('[B, D, F] → primary "B dim"', () => {
    const result = detectChord(['B', 'D', 'F'])
    expect(result![0]!.name).toBe('B dim')
  })
  it('[C, E, G#] → primary type "aug" (symmetric — wszystkie 3 augs tie at 1.0; C wins by enumOrder)', () => {
    const result = detectChord(['C', 'E', 'G#'])
    expect(result![0]!.spec.type).toBe('aug')
    expect(result![0]!.spec.root).toBe('C')
  })
})

describe('detectChord — sus chords', () => {
  it('[C, F, G] → primary "C sus4"', () => {
    const result = detectChord(['C', 'F', 'G'])
    expect(result![0]!.name).toBe('C sus4')
  })
  it('[C, D, G] → primary "C sus2"', () => {
    const result = detectChord(['C', 'D', 'G'])
    expect(result![0]!.name).toBe('C sus2')
  })
})

describe('detectChord — sevenths', () => {
  it('[C, E, G, Bb] → primary "C 7" dominant', () => {
    const result = detectChord(['C', 'E', 'G', 'Bb'])
    expect(result![0]!.name).toBe('C 7')
  })
  it('[C, E, G, B] → primary "C maj7"', () => {
    const result = detectChord(['C', 'E', 'G', 'B'])
    expect(result![0]!.name).toBe('C maj7')
  })
  it('[E, G, B, D] → primary "E min7" (E enum earlier than G 6 tie)', () => {
    const result = detectChord(['E', 'G', 'B', 'D'])
    expect(result![0]!.name).toBe('E min7')
  })
  it('[G, B, D, F] → primary "G 7"', () => {
    const result = detectChord(['G', 'B', 'D', 'F'])
    expect(result![0]!.name).toBe('G 7')
  })
  it('[B, D, F, Ab] → primary type "dim7" (symmetric — 4 dim7 tie; D wins by enumOrder)', () => {
    const result = detectChord(['B', 'D', 'F', 'Ab'])
    expect(result![0]!.spec.type).toBe('dim7')
  })
})

describe('detectChord — extended ninths', () => {
  it('[C, E, G, Bb, D] → primary "C 9"', () => {
    const result = detectChord(['C', 'E', 'G', 'Bb', 'D'])
    expect(result![0]!.name).toBe('C 9')
  })
  it('[C, E, G, B, D] → primary "C maj9"', () => {
    const result = detectChord(['C', 'E', 'G', 'B', 'D'])
    expect(result![0]!.name).toBe('C maj9')
  })
  it('[A, C, E, G, B] → primary "A min9"', () => {
    const result = detectChord(['A', 'C', 'E', 'G', 'B'])
    expect(result![0]!.name).toBe('A min9')
  })
})

describe('detectChord — power chord + ranked output', () => {
  it('[A, E] → primary "A 5" (power chord R+5)', () => {
    const result = detectChord(['A', 'E'])
    expect(result![0]!.name).toBe('A 5')
  })
  it('ranked output capped at 3 entries max (Decyzja #2 top-3 cap)', () => {
    const result = detectChord(['C', 'E', 'G'])
    expect(result!.length).toBeLessThanOrEqual(3)
  })
  it('ambiguous [C, E, G, A] → ranked includes "C 6" primary + "A min" secondary (multi-reading)', () => {
    const result = detectChord(['C', 'E', 'G', 'A'])
    expect(result!.length).toBeGreaterThanOrEqual(2)
    expect(result![0]!.name).toBe('C 6')
    expect(result!.some(r => r.name.startsWith('A min'))).toBe(true)
  })
})

describe('detectChord — edge cases', () => {
  it('[] (empty) → null', () => {
    expect(detectChord([])).toBeNull()
  })
  it('[C] (single note) → null', () => {
    expect(detectChord(['C'])).toBeNull()
  })
  it('chromatic cluster [C, Db, D] → not null but top candidate confidence < 0.7', () => {
    const result = detectChord(['C', 'Db', 'D'])
    expect(result).not.toBeNull()
    expect(result![0]!.confidence).toBeLessThan(0.7)
  })
  it('enharmonic [C, Eb, G] === [C, D#, G] both detect "C min"', () => {
    const r1 = detectChord(['C', 'Eb', 'G'])
    const r2 = detectChord(['C', 'D#', 'G'])
    expect(r1![0]!.spec.type).toBe('min')
    expect(r2![0]!.spec.type).toBe('min')
    expect(r1![0]!.spec.root).toBe('C')
    expect(r2![0]!.spec.root).toBe('C')
  })
  it('duplicates [C, E, G, C, E] → dedupe → "C maj"', () => {
    const result = detectChord(['C', 'E', 'G', 'C', 'E'])
    expect(result![0]!.name).toBe('C maj')
  })
  it('confidence clamped 0..1 — never returns >1 lub <0', () => {
    const result = detectChord(['C', 'E', 'G'])
    for (const r of result!) {
      expect(r.confidence).toBeGreaterThanOrEqual(0)
      expect(r.confidence).toBeLessThanOrEqual(1)
    }
  })
})

// ============================================================
// v5-13 — spellChordDegrees (lookup table per ChordType per ADR-045)
// ============================================================

describe('spellChordDegrees — basic triads', () => {
  it('{C, maj} → [R, 3, 5]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'maj' })).toEqual(['R', '3', '5'])
  })
  it('{C, min} → [R, m3, 5]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'min' })).toEqual(['R', 'm3', '5'])
  })
  it('{C, dim} → [R, m3, b5]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'dim' })).toEqual(['R', 'm3', 'b5'])
  })
  it('{C, aug} → [R, 3, #5]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'aug' })).toEqual(['R', '3', '#5'])
  })
  it('{C, sus2} → [R, 2, 5]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'sus2' })).toEqual(['R', '2', '5'])
  })
  it('{C, sus4} → [R, 4, 5]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'sus4' })).toEqual(['R', '4', '5'])
  })
})

describe('spellChordDegrees — sevenths', () => {
  it('{C, 7} → [R, 3, 5, m7]', () => {
    expect(spellChordDegrees({ root: 'C', type: '7' })).toEqual(['R', '3', '5', 'm7'])
  })
  it('{C, maj7} → [R, 3, 5, 7]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'maj7' })).toEqual(['R', '3', '5', '7'])
  })
  it('{C, min7} → [R, m3, 5, m7]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'min7' })).toEqual(['R', 'm3', '5', 'm7'])
  })
  it('{C, min7b5} → [R, m3, b5, m7]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'min7b5' })).toEqual(['R', 'm3', 'b5', 'm7'])
  })
  it('{C, dim7} → [R, m3, b5, bb7] (non-canonical bb7)', () => {
    expect(spellChordDegrees({ root: 'C', type: 'dim7' })).toEqual(['R', 'm3', 'b5', 'bb7'])
  })
})

describe('spellChordDegrees — extended', () => {
  it('{C, 9} → [R, 3, 5, m7, 9]', () => {
    expect(spellChordDegrees({ root: 'C', type: '9' })).toEqual(['R', '3', '5', 'm7', '9'])
  })
  it('{C, min9} → [R, m3, 5, m7, 9]', () => {
    expect(spellChordDegrees({ root: 'C', type: 'min9' })).toEqual(['R', 'm3', '5', 'm7', '9'])
  })
  it('{C, 7b9} → [R, 3, 5, m7, b9] (non-canonical b9)', () => {
    expect(spellChordDegrees({ root: 'C', type: '7b9' })).toEqual(['R', '3', '5', 'm7', 'b9'])
  })
  it('{C, 7#9} → [R, 3, 5, m7, #9] (non-canonical #9)', () => {
    expect(spellChordDegrees({ root: 'C', type: '7#9' })).toEqual(['R', '3', '5', 'm7', '#9'])
  })
  it('{C, 11} → [R, 3, 5, m7, 9, 11]', () => {
    expect(spellChordDegrees({ root: 'C', type: '11' })).toEqual(['R', '3', '5', 'm7', '9', '11'])
  })
  it('{C, 13} → [R, 3, 5, m7, 9, 13]', () => {
    expect(spellChordDegrees({ root: 'C', type: '13' })).toEqual(['R', '3', '5', 'm7', '9', '13'])
  })
})

describe('spellChordDegrees — power chord + non-C roots', () => {
  it('{C, "5"} power chord → [R, 5]', () => {
    expect(spellChordDegrees({ root: 'C', type: '5' })).toEqual(['R', '5'])
  })
  it('{A, maj} → [R, 3, 5] (root invariant)', () => {
    expect(spellChordDegrees({ root: 'A', type: 'maj' })).toEqual(['R', '3', '5'])
  })
  it('{F#, min7} → [R, m3, 5, m7] (non-C root)', () => {
    expect(spellChordDegrees({ root: 'F#', type: 'min7' })).toEqual(['R', 'm3', '5', 'm7'])
  })
})
