// Pure music-theory functions per design doc sekcja 5.
// Pełna enharmonic logic (per Decyzja D0.2 — user opt-in poza task default):
// major + naturalMinor (relative-major key sig wynika z letter-cycle naturally) + harmonic/melodic minor
// + 5 modes (parent-major) + pentatonics/blues. Edge case G# melodic minor 7th = F## fallback do 'G'
// (NoteName 21-entry limit per design doc sekcja 4 dec #2).
//
// Hard rule #2: no mocks — funkcje deterministyczne, testy używają real imports.

import type {
  NoteName, IntervalName, ScaleType, ChordType,
  Tuning, FretPosition, PitchedNote, ChordSpec,
} from './types'
import { STANDARD_TUNING as STANDARD_TUNING_REF } from './tunings'

// Re-export żeby konsumenci importowali z music-theory.ts per design doc sekcja 5 line 251.
export const STANDARD_TUNING = STANDARD_TUNING_REF

// ============================================================
// Pitch-class mapping (chromatic 0..11)
// ============================================================

// Single source of truth dla enharmonic equivalence. 21 entries — matches NoteName union.
// Cb=11, B#=0 (octave wrap); Fb=4 (=E enharmonic); E#=5 (=F enharmonic).
const PITCH_CLASS: Record<NoteName, number> = {
  'C': 0,  'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4,  'Fb': 4,
  'F': 5,  'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
}

// Sharps fallback dla chromatic spelling bez kontekstu (used by noteAtPosition,
// spellNote bez key/preference). 12 entries indexed by pitch class 0..11.
const CHROMATIC_SHARPS: readonly NoteName[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]
const CHROMATIC_FLATS: readonly NoteName[] = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
]

// ============================================================
// Letter cycle (diatonic ladder)
// ============================================================

type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function letterOf(note: NoteName): Letter {
  return note.charAt(0) as Letter
}

function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter)
}

function letterAt(idx: number): Letter {
  const wrapped = ((idx % 7) + 7) % 7
  // wrapped jest zawsze 0..6; cast bezpieczny bo LETTERS to 7-tuple.
  return LETTERS[wrapped] as Letter
}

// Signed delta między pitch classami w zakresie [-6, +5] (najkrótsza droga semi-tonowa).
function signedSemitoneDelta(requiredPC: number, basePC: number): number {
  let delta = ((requiredPC - basePC) % 12 + 12) % 12
  if (delta > 6) delta -= 12
  return delta
}

// ============================================================
// Key signature direction (sharps vs flats)
// ============================================================

// Wybiera preferencję enharmonic spelling dla danej tonacji (major key sig direction).
// Convention: F + nuty z 'b' → flats; reszta (w tym B, C, G, D, A, E + sharps) → sharps.
function keyDirection(key: NoteName): 'sharps' | 'flats' {
  if (key.includes('#')) return 'sharps'
  if (key.includes('b') && key !== 'B') return 'flats'  // 'B' jest naturalną sharps-key
  if (key === 'F') return 'flats'
  return 'sharps'
}

// ============================================================
// Enharmonic resolution helper
// ============================================================

// Try-letter-first / fallback-to-pitch-class-only logic (per plan §3.3 implementation notes).
// Spell pitch class `requiredPC` jako konkretną literę `letter` z alteracją; jeśli wymaga
// double-altered (|alt| ≥ 2) i nie istnieje w 21-entry NoteName → fallback do enharmonic
// ekwiwalentu według `preference` direction.
function spellLetterAtPitchClass(
  letter: Letter,
  requiredPC: number,
  preference: 'sharps' | 'flats',
): NoteName {
  const alt = signedSemitoneDelta(requiredPC, LETTER_PC[letter])

  if (alt === 0) return letter
  if (alt === 1) {
    const candidate = `${letter}#` as NoteName
    if (candidate in PITCH_CLASS) return candidate
  }
  if (alt === -1) {
    const candidate = `${letter}b` as NoteName
    if (candidate in PITCH_CLASS) return candidate
  }

  // |alt| ≥ 2 lub kombinacja niereprezentowalna (np. brak Fb wpis dla 'F' letter z -1 alteration?
  // actually Fb istnieje w naszym 21-set). Fallback: znajdź dowolny NoteName z PITCH_CLASS = requiredPC.
  return findEnharmonicAtPC(requiredPC, preference)
}

// Wybiera NoteName z PITCH_CLASS == pc preferując `preference` direction, potem natural,
// potem dowolny match.
function findEnharmonicAtPC(pc: number, preference: 'sharps' | 'flats'): NoteName {
  const all = (Object.keys(PITCH_CLASS) as NoteName[]).filter(n => PITCH_CLASS[n] === pc)
  // 1) match preferencji
  const preferred = all.find(n =>
    preference === 'sharps' ? n.includes('#') : n.includes('b') && n !== 'B',
  )
  if (preferred) return preferred
  // 2) natural letter
  const natural = all.find(n => n.length === 1)
  if (natural) return natural
  // 3) cokolwiek
  return all[0] ?? CHROMATIC_SHARPS[pc] as NoteName
}

// ============================================================
// Scale + chord interval tables
// ============================================================

// Każdy scale type ma semitonowe interwały od roota + letter-offsets (ile pozycji w letter-cycle).
// Diatonic 7-tonowe (major/minor/modes) używają sekwencyjnych letter-offsetów [0..6].
// Pentatoniki + blues wybierają subset letter-offsetów (np. bluesMinor ma 4 + #4 jako E + E).
const SCALE_TABLE: Record<ScaleType, { semitones: readonly number[]; letterOffsets: readonly number[] }> = {
  'major':           { semitones: [0, 2, 4, 5, 7, 9, 11], letterOffsets: [0, 1, 2, 3, 4, 5, 6] },
  'naturalMinor':    { semitones: [0, 2, 3, 5, 7, 8, 10], letterOffsets: [0, 1, 2, 3, 4, 5, 6] },
  'harmonicMinor':   { semitones: [0, 2, 3, 5, 7, 8, 11], letterOffsets: [0, 1, 2, 3, 4, 5, 6] },
  'melodicMinor':    { semitones: [0, 2, 3, 5, 7, 9, 11], letterOffsets: [0, 1, 2, 3, 4, 5, 6] },
  'dorian':          { semitones: [0, 2, 3, 5, 7, 9, 10], letterOffsets: [0, 1, 2, 3, 4, 5, 6] },
  'phrygian':        { semitones: [0, 1, 3, 5, 7, 8, 10], letterOffsets: [0, 1, 2, 3, 4, 5, 6] },
  'lydian':          { semitones: [0, 2, 4, 6, 7, 9, 11], letterOffsets: [0, 1, 2, 3, 4, 5, 6] },
  'mixolydian':      { semitones: [0, 2, 4, 5, 7, 9, 10], letterOffsets: [0, 1, 2, 3, 4, 5, 6] },
  'locrian':         { semitones: [0, 1, 3, 5, 6, 8, 10], letterOffsets: [0, 1, 2, 3, 4, 5, 6] },
  'pentatonicMajor': { semitones: [0, 2, 4, 7, 9], letterOffsets: [0, 1, 2, 4, 5] },
  'pentatonicMinor': { semitones: [0, 3, 5, 7, 10], letterOffsets: [0, 2, 3, 4, 6] },
  // bluesMinor = pentMinor + b5 → dodajemy 6 semitones jako "letter E flat" (offset 4 z flat).
  // Dwa kolejne wpisy na pozycji 4 (b5 + 5) = "Eb E" w A bluesMinor.
  'bluesMinor':      { semitones: [0, 3, 5, 6, 7, 10], letterOffsets: [0, 2, 3, 4, 4, 6] },
  // bluesMajor = pentMajor + b3 → "letter E flat" (offset 2 z flat).
  // "Eb E" w C bluesMajor (b3, 3).
  'bluesMajor':      { semitones: [0, 2, 3, 4, 7, 9], letterOffsets: [0, 1, 2, 2, 4, 5] },
}

// Chord intervals — semitones + letter-offsets per ChordType.
// Dla ekstensji powyżej oktawy (9th=14, 11th=17, 13th=21) letter-offset wraca do cyklu mod 7
// (9th letter = letter + 1, 11th = letter + 3, 13th = letter + 5).
const CHORD_TABLE: Record<ChordType, { semitones: readonly number[]; letterOffsets: readonly number[] }> = {
  '5':         { semitones: [0, 7],                       letterOffsets: [0, 4] },
  'maj':       { semitones: [0, 4, 7],                    letterOffsets: [0, 2, 4] },
  'min':       { semitones: [0, 3, 7],                    letterOffsets: [0, 2, 4] },
  'dim':       { semitones: [0, 3, 6],                    letterOffsets: [0, 2, 4] },
  'aug':       { semitones: [0, 4, 8],                    letterOffsets: [0, 2, 4] },
  'sus2':      { semitones: [0, 2, 7],                    letterOffsets: [0, 1, 4] },
  'sus4':      { semitones: [0, 5, 7],                    letterOffsets: [0, 3, 4] },
  '6':         { semitones: [0, 4, 7, 9],                 letterOffsets: [0, 2, 4, 5] },
  'min6':      { semitones: [0, 3, 7, 9],                 letterOffsets: [0, 2, 4, 5] },
  '7':         { semitones: [0, 4, 7, 10],                letterOffsets: [0, 2, 4, 6] },
  'maj7':      { semitones: [0, 4, 7, 11],                letterOffsets: [0, 2, 4, 6] },
  'min7':      { semitones: [0, 3, 7, 10],                letterOffsets: [0, 2, 4, 6] },
  'dim7':      { semitones: [0, 3, 6, 9],                 letterOffsets: [0, 2, 4, 6] },
  'min7b5':    { semitones: [0, 3, 6, 10],                letterOffsets: [0, 2, 4, 6] },
  '7sus4':     { semitones: [0, 5, 7, 10],                letterOffsets: [0, 3, 4, 6] },
  '9':         { semitones: [0, 4, 7, 10, 14],            letterOffsets: [0, 2, 4, 6, 1] },
  'maj9':      { semitones: [0, 4, 7, 11, 14],            letterOffsets: [0, 2, 4, 6, 1] },
  'min9':      { semitones: [0, 3, 7, 10, 14],            letterOffsets: [0, 2, 4, 6, 1] },
  'add9':      { semitones: [0, 4, 7, 14],                letterOffsets: [0, 2, 4, 1] },
  'min(add9)': { semitones: [0, 3, 7, 14],                letterOffsets: [0, 2, 4, 1] },
  '7b9':       { semitones: [0, 4, 7, 10, 13],            letterOffsets: [0, 2, 4, 6, 1] },
  '7#9':       { semitones: [0, 4, 7, 10, 15],            letterOffsets: [0, 2, 4, 6, 1] },
  '7b5':       { semitones: [0, 4, 6, 10],                letterOffsets: [0, 2, 4, 6] },
  '7#5':       { semitones: [0, 4, 8, 10],                letterOffsets: [0, 2, 4, 6] },
  '11':        { semitones: [0, 4, 7, 10, 14, 17],        letterOffsets: [0, 2, 4, 6, 1, 3] },
  '13':        { semitones: [0, 4, 7, 10, 14, 17, 21],    letterOffsets: [0, 2, 4, 6, 1, 3, 5] },
}

// ============================================================
// OPEN_OCTAVES_PER_TUNING — explicit lookup
// ============================================================

// Per Decyzja D11.7 + post-review Issue 1 fix: per-string open octave hardkodowany
// dla wszystkich 8 canonical tunings. Heurystyka "low strings = oct 2" NIE wystarcza
// bo Open C string 4 = C4 (oct 4) — crossover poza pierwsze dwie struny.
// Source: design doc sekcja 14 v5-09 lines 606-613 (canonical octave references).
const OPEN_OCTAVES_PER_TUNING: Record<string, readonly number[]> = {
  'Standard':              [2, 2, 3, 3, 3, 4],  // E2 A2 D3 G3 B3 E4
  'Drop D':                [2, 2, 3, 3, 3, 4],  // D2 A2 D3 G3 B3 E4
  'DADGAD':                [2, 2, 3, 3, 3, 4],  // D2 A2 D3 G3 A3 D4
  'Open G':                [2, 2, 3, 3, 3, 4],  // D2 G2 D3 G3 B3 D4
  'Open D':                [2, 2, 3, 3, 3, 4],  // D2 A2 D3 F#3 A3 D4
  'Open C':                [2, 2, 3, 3, 4, 4],  // C2 G2 C3 G3 C4 E4 (CROSSOVER string 4)
  'Half-step down (Eb)':   [2, 2, 3, 3, 3, 4],  // Eb2 Ab2 Db3 Gb3 Bb3 Eb4
  'Full-step down (D)':    [2, 2, 3, 3, 3, 4],  // D2 G2 C3 F3 A3 D4
}

function openOctaveForString(tuning: Tuning, stringIdx: number): number {
  const map = OPEN_OCTAVES_PER_TUNING[tuning.name]
  if (!map) {
    throw new Error(
      `Unknown tuning name: ${tuning.name}. Add entry to OPEN_OCTAVES_PER_TUNING in music-theory.ts.`,
    )
  }
  const oct = map[stringIdx]
  if (oct === undefined) {
    throw new Error(
      `Tuning "${tuning.name}" has no open octave for string ${stringIdx} (map length=${map.length}).`,
    )
  }
  return oct
}

// ============================================================
// Public API — noteAtPosition / positionsOfNote
// ============================================================

export function noteAtPosition(tuning: Tuning, pos: FretPosition): PitchedNote {
  const openNote = tuning.strings[pos.string]
  if (openNote === undefined) {
    throw new Error(`Invalid string index ${pos.string} for tuning ${tuning.name}`)
  }
  const openPC = PITCH_CLASS[openNote]
  const totalSemis = openPC + pos.fret
  const pc = ((totalSemis % 12) + 12) % 12
  const baseOctave = openOctaveForString(tuning, pos.string)
  const octave = baseOctave + Math.floor(totalSemis / 12)
  const name = CHROMATIC_SHARPS[pc]
  if (name === undefined) {
    throw new Error(`Invalid pitch class ${pc}`)
  }
  return { name, octave }
}

export function positionsOfNote(
  tuning: Tuning, fretCount: number, note: NoteName,
): FretPosition[] {
  const targetPC = PITCH_CLASS[note]
  const out: FretPosition[] = []
  for (let stringIdx = 0; stringIdx < tuning.strings.length; stringIdx++) {
    const openNote = tuning.strings[stringIdx]
    if (openNote === undefined) continue
    const openPC = PITCH_CLASS[openNote]
    for (let fret = 0; fret <= fretCount; fret++) {
      const pc = ((openPC + fret) % 12 + 12) % 12
      if (pc === targetPC) out.push({ string: stringIdx, fret })
    }
  }
  return out
}

// ============================================================
// scaleNotes — full enharmonic (letter cycle + double-altered fallback)
// ============================================================

export function scaleNotes(root: NoteName, scaleType: ScaleType): NoteName[] {
  const rootPC = PITCH_CLASS[root]
  const rootLetter = letterOf(root)
  const rootLetterIdx = letterIndex(rootLetter)
  const table = SCALE_TABLE[scaleType]
  const preference = keyDirection(root)

  const result: NoteName[] = []
  for (let i = 0; i < table.semitones.length; i++) {
    const semis = table.semitones[i]
    const letterOffset = table.letterOffsets[i]
    if (semis === undefined || letterOffset === undefined) continue
    const requiredPC = (rootPC + semis) % 12
    const letter = letterAt(rootLetterIdx + letterOffset)
    result.push(spellLetterAtPitchClass(letter, requiredPC, preference))
  }
  return result
}

// ============================================================
// chordNotes — letter-cycle through chord interval table
// ============================================================

export function chordNotes(root: NoteName, chordType: ChordType): NoteName[] {
  const rootPC = PITCH_CLASS[root]
  const rootLetter = letterOf(root)
  const rootLetterIdx = letterIndex(rootLetter)
  const table = CHORD_TABLE[chordType]
  const preference = keyDirection(root)

  const result: NoteName[] = []
  for (let i = 0; i < table.semitones.length; i++) {
    const semis = table.semitones[i]
    const letterOffset = table.letterOffsets[i]
    if (semis === undefined || letterOffset === undefined) continue
    const requiredPC = (rootPC + semis) % 12
    const letter = letterAt(rootLetterIdx + letterOffset)
    result.push(spellLetterAtPitchClass(letter, requiredPC, preference))
  }
  return result
}

// ============================================================
// intervalBetween — canonical 12-entry set
// ============================================================

// Zwraca canonical interval z 12-entry zbioru. Enharmonic input ('Eb' vs 'D#') normalize
// identycznie do tej samej canonical nazwy (m3) bo PITCH_CLASS oba mapuje na pc=3.
// Non-canonical interval names (b3/b6/bb7/#2/b9/#9/11/#11/13/b13) rezerwowane dla
// spellChordDegrees w v5-12.
const CANONICAL_INTERVALS: readonly IntervalName[] = [
  'R', 'b2', '2', 'm3', '3', '4', 'b5', '5', '#5', '6', 'm7', '7',
]

export function intervalBetween(root: NoteName, note: NoteName): IntervalName {
  const delta = ((PITCH_CLASS[note] - PITCH_CLASS[root]) % 12 + 12) % 12
  const name = CANONICAL_INTERVALS[delta]
  if (name === undefined) {
    throw new Error(`Invalid interval delta ${delta}`)
  }
  return name
}

// ============================================================
// spellNote — preference override or key-context (major key sig)
// ============================================================

export function spellNote(
  note: NoteName,
  context: { key?: NoteName; preference?: 'sharps' | 'flats' },
): NoteName {
  const pc = PITCH_CLASS[note]

  if (context.preference === 'sharps') {
    const candidate = CHROMATIC_SHARPS[pc]
    if (candidate !== undefined) return candidate
  }
  if (context.preference === 'flats') {
    const candidate = CHROMATIC_FLATS[pc]
    if (candidate !== undefined) return candidate
  }

  if (context.key) {
    // Major key sig context: spróbuj dopasować nutę do letter-cycle major scale.
    const scale = scaleNotes(context.key, 'major')
    const match = scale.find(n => PITCH_CLASS[n] === pc)
    if (match) return match
    // pc poza skalą (chromatic note) → użyj key direction preference.
    const direction = keyDirection(context.key)
    return direction === 'sharps'
      ? (CHROMATIC_SHARPS[pc] as NoteName)
      : (CHROMATIC_FLATS[pc] as NoteName)
  }

  // brak preferencji + brak key → sharps fallback
  return (CHROMATIC_SHARPS[pc] as NoteName)
}

// ============================================================
// Stubs (per D0.1 — implementation w v5-11 / v5-12)
// ============================================================

// TODO v5-11 — implementacja per design doc sekcja 8 (best-effort detection).
export function detectChord(notes: NoteName[]): { name: string; confidence: number } | null {
  void notes
  return null
}

// TODO v5-12 — używa non-canonical IntervalName entries (b3/b6/bb7/#2/b9/#9/11/#11/13/b13).
export function spellChordDegrees(chord: ChordSpec): IntervalName[] {
  void chord
  return []
}
