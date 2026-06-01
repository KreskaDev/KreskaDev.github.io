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
  /**
   * Per-note start callback. v5-15 NEW per ADR-054 (extends ADR-049 future-flag z
   * "v5-18+" do v5-15 jako first consumer per user Q-A7=(c) override 2026-06-01).
   * Signature: index (zero-based) + scheduledTime (ms relative to playSequence call
   * start, NIE absolute audioContext.currentTime).
   *
   * Presence of `onNoteStart` ALSO triggers SEQUENTIAL scheduling semantics gdy
   * interval=0:
   *   - interval > 0 + onNoteStart: setTimeout per-note delay = i * interval
   *     (legacy v5-14 sequence path; callback fired przed playPitchedNote).
   *   - interval === 0 + onNoteStart: SEQUENTIAL mode — cumulative scheduling using
   *     durations array. Note i starts at sum(durations[0..i-1] * 1000) ms.
   *   - interval === 0 + NO onNoteStart (v5-14 chord mode): simultaneous chord intact
   *     — all playPitchedNote called synchronously, no scheduling.
   *
   * Backward-compat: v5-14 test "durations per-note propagation" (interval=0, NO
   * onNoteStart) hits chord codepath; intact.
   */
  onNoteStart?: (index: number, scheduledTime: number) => void
  /**
   * Optional absolute start times (seconds, relative to playSequence call) per note.
   * v5-15 NEW per ADR-054 follow-up — enables scheduling cases gdy cumulative durations
   * sum NIE matches desired note start (rest gaps, multi-voice parallel scheduling,
   * tied-merged notes). When `startTimes` provided AND sequential mode active (interval=0
   * + onNoteStart):
   *   - Note i scheduled przy `setTimeout(... , startTimes[i] * 1000)`.
   *   - `durations[i]` zachowuje semantykę SUSTAIN (playPitchedNote 3rd arg) NIE delay.
   *   - Two notes mogą mieć same startTime (multi-voice parallel) — both setTimeouts
   *     fire at same tick, both playPitchedNote called.
   * Backward-compat: undefined startTimes → cumulative durations.sum (v5-15 baseline).
   */
  startTimes?: number[]
  /**
   * Optional AbortSignal dla cancellation in-flight scheduled playback. v5-15 NEW per
   * ADR-054 — enables Notation widget Play→Stop toggle cancel queued setTimeout calls
   * przed fire (prevents continued audio post-Stop click). When `signal.aborted === true`:
   *   - Pending setTimeout IDs collected internally są cleared via clearTimeout.
   *   - Pending playPitchedNote scheduled calls są skipped (early-return per-iteration check).
   *   - Promise resolves cleanly (NIE rejects — abort jest user-intentional, NIE error).
   *   - onNoteStart NIE fires po abort.
   * Backward-compat: undefined signal = current behavior, brak abort logic. v5-14 chord
   * caller bez signal intact.
   */
  signal?: AbortSignal
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

  // v5-15 detection rule (ADR-054): sequential mode activated TYLKO przy onNoteStart
  // presence + interval===0. Chord codepath (NO onNoteStart) preserved dla v5-14
  // backward-compat (test "durations per-note propagation" lines 88-96).
  const usesSequential = options.onNoteStart !== undefined && options.interval === 0
  const signal = options.signal

  // Track scheduled timeouts + ich resolve callbacks dla abort cleanup. Caller passes
  // AbortSignal i odbiera anulowanie deklaratywnie. Deviation od plan §3.7: storage
  // {id, resolve} pairs zamiast samych ids — clearTimeout sam nie resolve'uje Promise,
  // więc Promise.all by hangował post-abort. resolve() collected by onAbort idempotent
  // call resolves wszystkie pending promises clean.
  const pending: Array<{ id: ReturnType<typeof setTimeout>; resolve: () => void }> = []
  const onAbort = () => {
    for (const { id, resolve } of pending) {
      clearTimeout(id)
      resolve()
    }
    pending.length = 0
  }
  // `{ once: true }` flag auto-removes listener post-fire — NO manual removeEventListener.
  // If signal pre-aborted, invoke onAbort synchronously (addEventListener wouldn't fire).
  if (signal) {
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  const schedulePromises: Promise<void>[] = notes.map((note, i) => {
    const duration = options.durations?.[i] ?? 0.6

    if (usesSequential) {
      // v5-15 sequential mode delay computation:
      // (a) startTimes[i] provided → absolute schedule offset (rest gaps + multi-voice
      //     parallel handled). Notation widget v5-15 uses this path.
      // (b) else cumulative durations[0..i-1] sum → backward-compat baseline.
      const delayMs = options.startTimes !== undefined
        ? (options.startTimes[i] ?? 0) * 1000
        : options.durations
          ? options.durations.slice(0, i).reduce((sum, d) => sum + d * 1000, 0)
          : 0
      return new Promise<void>((resolve) => {
        // Pre-aborted signal: onAbort already fired → resolve immediately, skip schedule.
        if (signal?.aborted) { resolve(); return }
        const id = setTimeout(() => {
          if (signal?.aborted) { resolve(); return }
          try { options.onNoteStart?.(i, delayMs) }
          catch (err) { console.error('[audio-sequence] onNoteStart callback threw:', err) }
          playPitchedNote(ctx, note, duration)
            .then(() => resolve())
            .catch(() => resolve())
        }, delayMs)
        pending.push({ id, resolve })
      })
    }

    if (options.interval === 0) {
      // v5-14 chord mode (interval=0 + NO onNoteStart) — backward-compat preserved.
      // Abort tutaj NIE applies (chord = synchronous fire-and-forget; abort dla chord
      // = no-op acceptable bo chord trwa pojedynczy beat).
      return playPitchedNote(ctx, note, duration)
    }

    // v5-14 legacy sequence mode (interval > 0). Signal abort applies; onNoteStart
    // może być undefined (legacy ChordAnalyzer NIE używał) lub defined (jeśli caller
    // chce per-note callback w legacy mode).
    const delayMs = i * options.interval
    return new Promise<void>((resolve) => {
      if (signal?.aborted) { resolve(); return }
      const id = setTimeout(() => {
        if (signal?.aborted) { resolve(); return }
        try { options.onNoteStart?.(i, delayMs) }
        catch (err) { console.error('[audio-sequence] onNoteStart callback threw:', err) }
        playPitchedNote(ctx, note, duration)
          .then(() => resolve())
          .catch(() => resolve())
      }, delayMs)
      pending.push({ id, resolve })
    })
  })

  await Promise.all(schedulePromises)
  // NO manual removeEventListener — `{ once: true }` flag handles auto-cleanup on
  // abort fire. Single-shot semantics clean.
}
