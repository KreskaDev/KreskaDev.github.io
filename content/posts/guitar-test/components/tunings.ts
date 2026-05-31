// 8 canonical tunings per design doc sekcja 14 v5-09.
// Octaves NIE są częścią Tuning.strings (NoteName[] tylko) — computed w noteAtPosition
// przez OPEN_OCTAVES_PER_TUNING lookup (music-theory.ts). Per Decyzja D11.7.

import type { Tuning } from './types'

export const STANDARD_TUNING: Tuning = {
  name: 'Standard',
  strings: ['E', 'A', 'D', 'G', 'B', 'E'],
  // Octaves (computed by noteAtPosition): E2 A2 D3 G3 B3 E4
}

export const DROP_D: Tuning = {
  name: 'Drop D',
  strings: ['D', 'A', 'D', 'G', 'B', 'E'],
  // Octaves: D2 A2 D3 G3 B3 E4
}

export const DADGAD: Tuning = {
  name: 'DADGAD',
  strings: ['D', 'A', 'D', 'G', 'A', 'D'],
  // Octaves: D2 A2 D3 G3 A3 D4
}

export const OPEN_G: Tuning = {
  name: 'Open G',
  strings: ['D', 'G', 'D', 'G', 'B', 'D'],
  // Octaves: D2 G2 D3 G3 B3 D4 (Richards-style, NIE reentrant)
}

export const OPEN_D: Tuning = {
  name: 'Open D',
  strings: ['D', 'A', 'D', 'F#', 'A', 'D'],
  // Octaves: D2 A2 D3 F#3 A3 D4
}

export const OPEN_C: Tuning = {
  name: 'Open C',
  strings: ['C', 'G', 'C', 'G', 'C', 'E'],
  // Octaves: C2 G2 C3 G3 C4 E4 (CGCGCE — popularny variant)
}

export const HALF_STEP_DOWN: Tuning = {
  name: 'Half-step down (Eb)',
  strings: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'],
  // Octaves: Eb2 Ab2 Db3 Gb3 Bb3 Eb4
}

export const FULL_STEP_DOWN: Tuning = {
  name: 'Full-step down (D)',
  strings: ['D', 'G', 'C', 'F', 'A', 'D'],
  // Octaves: D2 G2 C3 F3 A3 D4
}

export const ALL_TUNINGS: readonly Tuning[] = [
  STANDARD_TUNING, DROP_D, DADGAD, OPEN_G, OPEN_D, OPEN_C, HALF_STEP_DOWN, FULL_STEP_DOWN,
] as const
