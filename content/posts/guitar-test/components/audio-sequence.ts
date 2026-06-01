// audio-sequence.ts — cross-iteration primitive dla sekwencji audio playback.
// Per ADR-049 (Proposed v5-14): pure async function kompozycja shipped ADR-042 helpers
// (ensureAudio + playPitchedNote). Zero new runtime deps. Konsumenci v5-14: ChordAnalyzer
// (chord interval=0). Forward-compat v5-15+: scale (interval=150), notation (durations),
// tab (identyczny pattern), synced playback (onNoteStart callback extension).

import { ensureAudio, playPitchedNote } from './audio'
import type { PitchedNote } from './types'

export type SequenceOptions = {
  /**
   * Milliseconds między start każdej nuty. 0 = wszystkie nuty start jednocześnie (chord).
   * v5-14: 0 (chord), v5-15: 150 (scale), v5-16+: 0 (rhythm-aware via durations array).
   */
  interval: number
  /**
   * Optional per-note duration override (seconds). Length MUST match notes.length jeśli podane.
   * v5-14: undefined (uses audio.ts default 0.6s per note). v5-16+ rhythm-aware caller passes
   * np. [0.5, 0.25, 0.25, 1.0] dla quarter+eighth+eighth+half rhythm.
   */
  durations?: number[]
  /**
   * Velocity 0..1, default 0.8. v5-14: unused (audio.ts ignoruje obecnie). v5-16+ velocity-aware
   * caller może pass np. 0.6 dla soft passage. Defensive parameter forward-compat.
   */
  velocity?: number
}

/**
 * Plays sequence of pitched notes through shared AudioContext singleton (per ADR-042).
 * Schedules każdą nutę: interval=0 → synchronous direct call (chord); interval>0 → setTimeout
 * (ms-precision sequence). Returns Promise<void> resolved po wszystkich schedule promises;
 * NIE waits for sustain completion.
 *
 * Future scheduling primitives (onNoteStart callback per v5-18 synced playback) extension
 * jest backward-compat addition (additional optional callback param).
 *
 * @throws Error jeśli durations.length !== notes.length (defensive validation; oba podane → musi match).
 */
export async function playSequence(
  notes: PitchedNote[],
  options: SequenceOptions
): Promise<void> {
  // Edge case: empty sequence — silent return (zero playPitchedNote calls)
  if (notes.length === 0) return

  // Defensive validation — durations length must match jeśli podane (early throw lepsza niż
  // silent partial playback z bag-of-undefined runtime errors).
  if (options.durations && options.durations.length !== notes.length) {
    throw new Error(
      `playSequence: durations.length (${options.durations.length}) must match notes.length (${notes.length})`
    )
  }

  const ctx = await ensureAudio()

  // velocity unused w v5-14 (audio.ts ignoruje obecnie); zachowane w signature dla v5-16+
  // forward compat. void-suppression zamiast eslint-disable.
  void options.velocity

  const schedulePromises: Promise<void>[] = notes.map((note, i) => {
    const duration = options.durations?.[i] ?? 0.6
    if (options.interval === 0) {
      // Chord simultaneous — bezpośredni call, audioContext clock handles micro-scheduling.
      return playPitchedNote(ctx, note, duration)
    }
    // Sequence — schedule via setTimeout (ms-precision acceptable dla v5-14..v5-17;
    // v5-18+ synced playback wymaga upgrade na audioContext.currentTime-based scheduling
    // bo setTimeout drift accumulates dla long sequences).
    const delayMs = i * options.interval
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        playPitchedNote(ctx, note, duration)
          .then(() => resolve())
          .catch(() => resolve())
      }, delayMs)
    })
  })

  await Promise.all(schedulePromises)
}
