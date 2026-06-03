// Typy fretboard widget'u — data model invariants per design doc sekcja 4 + 5.
// Stałe MIN/MAX/DEFAULT_FRET_COUNT kolokowane z typami (Decyzja D11.1) bo opisują
// dozwolony range pola `fretCount` w `FretboardProps`.

export const MIN_FRET_COUNT = 5 as const
export const MAX_FRET_COUNT = 24 as const
export const DEFAULT_FRET_COUNT = 12 as const

// Note names — 21 entries. Includes B#/E#/Fb/Cb dla poprawnego spell C#-major (B#),
// F#-major (E#), Cb-major (Cb/Fb), Gb-major (Cb). Świadomie BEZ double-altered
// (Bbb, Cx, F##) — design doc sekcja 4 dec #2 limit; spellNote G# melodic minor F##
// fallback'uje do enharmonic ekwiwalentu (G), test case dokumentuje compromise.
export type NoteName =
  | 'C' | 'C#' | 'Db' | 'D' | 'D#' | 'Eb' | 'E' | 'E#' | 'Fb' | 'F'
  | 'F#' | 'Gb' | 'G' | 'G#' | 'Ab' | 'A' | 'A#' | 'Bb' | 'B' | 'B#' | 'Cb'

// Intervals — 24 entries pełny enum. v5-09 konsumuje tylko 12 canonical
// (zwracanych przez intervalBetween): R, b2, 2, m3, 3, 4, b5, 5, #5, 6, m7, 7.
// Pełne 24 entries shipowane od razu — uniknięcie type churn w v5-10/v5-12 gdy
// spellChordDegrees zacznie zwracać non-canonical (b3/b6/bb7/#2/b9/#9/11/#11/13/b13).
export type IntervalName =
  | 'R' | 'b2' | '2' | '#2' | 'b3' | 'm3' | '3'
  | '4' | '#4' | 'b5' | '5' | '#5' | 'b6' | '6'
  | 'bb7' | 'm7' | '7'
  | 'b9' | '9' | '#9' | '11' | '#11' | 'b13' | '13'

// Scale types — 13 entries MVP set. 'aeolian' === 'naturalMinor' → używamy 'naturalMinor'.
// 'bluesMinor' = pentatonicMinor + b5; 'bluesMajor' = pentatonicMajor + b3.
export type ScaleType =
  | 'major' | 'naturalMinor' | 'harmonicMinor' | 'melodicMinor'
  | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'
  | 'pentatonicMajor' | 'pentatonicMinor'
  | 'bluesMinor' | 'bluesMajor'

// Chord types — 26 entries MVP set. '5' = power chord (R + 5, no third).
export type ChordType =
  | '5' | 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4'
  | '6' | 'min6' | '7' | 'maj7' | 'min7' | 'dim7' | 'min7b5'
  | '7sus4' | '9' | 'maj9' | 'min9' | 'add9' | 'min(add9)'
  | '7b9' | '7#9' | '7b5' | '7#5' | '11' | '13'

export type Tuning = {
  name: string
  strings: NoteName[]  // low → high (E A D G B E dla Standard)
}

export type FretPosition = {
  string: number       // 0 = najniższa (low E w Standard)
  fret: number         // 0 = open, 1..fretCount
}

export type PitchedNote = {
  name: NoteName
  octave: number       // scientific pitch (low E open = E2, high e open = E4)
}

export type FretboardNote = FretPosition & {
  label?: string                                                            // override; default = computed
  degree?: IntervalName                                                     // showDegrees + rootNote
  color?: 'root' | 'chord-tone' | 'scale-tone' | 'extension' | 'muted'
}

export type ChordSpec = { root: NoteName; type: ChordType }
export type ScaleSpec = { root: NoteName; type: ScaleType }

export type ChordShape = {
  frets: (number | null)[]    // null = muted; length === tuning.strings.length
  rootStringIndex?: number    // index struny niosącej bass note (slash chord)
}

// id REQUIRED — symmetric z runtime throw dla fretCount out-of-range (D11.6).
// v5-13 może dodać runtime duplicate check (URL hash collision); v5-09 author responsibility.
export type FretboardProps = {
  id: string
  tuning?: Tuning
  fretCount?: number
  notes: FretboardNote[]
  editable?: boolean                                              // v5-09 ignoruje (v5-13)
  showFretNumbers?: boolean
  showStringLabels?: boolean
  showDegrees?: boolean
  rootNote?: NoteName
  onFretClick?: (pos: FretPosition) => void                       // v5-09 ignoruje (v5-13)
  onPlayNote?: (note: PitchedNote) => void
}

// === Music vertical shared types (v5-15+, ADR-053 binding declaration) ===
// types.ts staje się modifiable w v5-15 dla cross-component music-vertical primitives.
// Iteracje v5-16/17/19 mogą rozszerzać types.ts dalej bez extra ADR — precedent
// established w ADR-053 "Music Vertical Shared Types" subsection. Modyfikacje muszą być
// additive (zero rename/removal) i w scope music vertical.

export type Duration = '1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32'

export type TimeSignature = { numerator: number; denominator: number }

export type KeySignature = NoteName  // 'C' = no accidentals; 'G' = 1 sharp; 'Bb' = 2 flats; etc.

export type Articulation = 'staccato' | 'accent' | 'tenuto' | 'marcato'

export type Ornament = 'trill' | 'mordent' | 'turn' | 'fermata'

// ratio = [numNotes, notesOccupied] — triplet = [3, 2] (3 nuty w czasie 2).
// group = opcjonalny explicit ID dla bundle multi-tuplet boundaries; consecutive
// same-ratio bez explicit group implicit-grouping heuristic w notation-timing.ts.
export type Tuplet = { ratio: [number, number]; group?: string }

// Notation domain pitch (strukturalny letter + accidental + octave). Distinct od
// audio-domain `PitchedNote { name: NoteName; octave }` — conversion via lokalny helper
// w Notation.tsx (letter + accidental → NoteName). Domain separation: notation potrzebuje
// structured pitch dla key signature inference + rendering; audio potrzebuje NoteName
// enum dla sample lookup.
export type NotePitch = {
  letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
  accidental?: '#' | 'b' | 'natural'
  octave: number  // scientific pitch (middle C = C4)
}

// Constraint runtime-validated (Notation.tsx render): `pitch` REQUIRED OR `rest: true`.
// `pitch` array = chord-on-staff (stacked notes single beat). `position` = v5-16/17
// forward-compat hook (fretboard graph + tab) — IGNORED w v5-15 Notation widget.
export type Note = {
  pitch?: NotePitch | NotePitch[]
  position?: FretPosition
  duration: Duration
  dotted?: boolean
  rest?: boolean
  tied?: boolean
  voice?: 1 | 2
  articulation?: Articulation
  ornament?: Ornament
  tuplet?: Tuplet
}
