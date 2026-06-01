// notation-timing.ts — pure functions dla BPM-driven audio timing w Notation widget.
// Zero VexFlow zależności, zero runtime deps; testable per hard rule #2 (no mocks dla
// pure math). Per ADR-054 onNoteStart callback evolution + plan §3.4.
//
// Mapuje notation domain (duration value + dotted + tuplet) → audio domain (ms duration).
// Tied notes mergowane: consecutive `tied:true` na poprzedniej + same pitch na kolejnej
// = single merged duration. Rest skipowane z audio durations array; ale present w
// scheduledTimes (offset preserved).

import type { Duration, Note, NotePitch, Tuplet } from './types'

// 60_000 ms / bpm = duration jednego ćwierćbeatu w ms. throw dla bpm ≤ 0 (defensive —
// nonsensowny input łatwo wykryć early niż produce silent garbage durations).
export function bpmToMsPerBeat(bpm: number): number {
  if (bpm <= 0) throw new Error(`bpmToMsPerBeat: bpm must be > 0, got ${bpm}`)
  return 60_000 / bpm
}

// Duration → beats relative to quarter note (1 beat). whole=4, half=2, quarter=1,
// eighth=0.5, etc. dotted = ×1.5. tuplet `ratio: [numNotes, notesOccupied]` skaluje
// czas trwania (triplet [3,2]: 3 ósemki w czasie 2 → każda ósemka × 2/3).
export function durationToBeats(d: Duration, dotted?: boolean, tuplet?: Tuplet): number {
  const baseMap: Record<Duration, number> = {
    '1': 4,
    '1/2': 2,
    '1/4': 1,
    '1/8': 0.5,
    '1/16': 0.25,
    '1/32': 0.125,
  }
  let beats = baseMap[d]
  if (dotted) beats *= 1.5
  if (tuplet) {
    const [numNotes, notesOccupied] = tuplet.ratio
    if (numNotes <= 0 || notesOccupied <= 0) {
      throw new Error(`durationToBeats: tuplet ratio must have positive numbers, got [${numNotes}, ${notesOccupied}]`)
    }
    beats *= notesOccupied / numNotes
  }
  return beats
}

export function durationToMs(
  d: Duration,
  dotted: boolean | undefined,
  bpm: number,
  tuplet?: Tuplet,
): number {
  return durationToBeats(d, dotted, tuplet) * bpmToMsPerBeat(bpm)
}

// Helper structural pitch equality dla tie merge. Chord-on-staff (`pitch: NotePitch[]`)
// NIE supportowany w tie merge — returns false jeśli either side is array.
function samePitch(a: Note['pitch'], b: Note['pitch']): boolean {
  if (!a || !b) return false
  if (Array.isArray(a) || Array.isArray(b)) return false
  const aP = a as NotePitch
  const bP = b as NotePitch
  return aP.letter === bP.letter
    && (aP.accidental ?? null) === (bP.accidental ?? null)
    && aP.octave === bP.octave
}

// Audio durations array — per-note duration ms BEZ rests (rests skipowane z audio).
// Tied chain merge: consecutive Notes z `tied:true` + same pitch → first note duration
// += subsequent note duration (chain until `tied:false` or pitch break or array pitch).
// Used przez Notation.tsx Play handler dla `playSequence(notes, { durations })`.
export function notesToDurations(notes: Note[], bpm: number): number[] {
  if (notes.length === 0) return []
  const out: number[] = []
  let i = 0
  while (i < notes.length) {
    const n = notes[i]!
    if (n.rest) { i += 1; continue }
    let totalMs = durationToMs(n.duration, n.dotted, bpm, n.tuplet)
    // Walk tied chain forward
    let j = i
    while (j < notes.length - 1 && notes[j]!.tied) {
      const next = notes[j + 1]!
      if (next.rest) break
      if (!samePitch(notes[j]!.pitch, next.pitch)) break
      totalMs += durationToMs(next.duration, next.dotted, bpm, next.tuplet)
      j += 1
    }
    out.push(totalMs)
    i = j + 1
  }
  return out
}

// Scheduled start times array — cumulative ms offset relative to playback start. Rests
// counted (offset preserved); tied chains compressed (single entry per merged note).
// Used przez Notation.tsx dla onNoteStart highlight precision (scheduled time per-note).
export function notesToScheduledTimes(notes: Note[], bpm: number): number[] {
  if (notes.length === 0) return []
  const out: number[] = []
  let cursor = 0
  let i = 0
  while (i < notes.length) {
    const n = notes[i]!
    if (n.rest) {
      cursor += durationToMs(n.duration, n.dotted, bpm, n.tuplet)
      i += 1
      continue
    }
    out.push(cursor)
    let durMs = durationToMs(n.duration, n.dotted, bpm, n.tuplet)
    let j = i
    while (j < notes.length - 1 && notes[j]!.tied) {
      const next = notes[j + 1]!
      if (next.rest) break
      if (!samePitch(notes[j]!.pitch, next.pitch)) break
      durMs += durationToMs(next.duration, next.dotted, bpm, next.tuplet)
      j += 1
    }
    cursor += durMs
    i = j + 1
  }
  return out
}
