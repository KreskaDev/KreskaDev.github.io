// audio-sequence.test.ts — unit tests dla playSequence per plan §3.2.
// HARD CONSTRAINT (v5-11 precedens): mock `../audio` module (jsdom NIE supportuje
// Web Audio API). Test covers interval=0 (chord), interval>0 (sequence z fake timers),
// edge cases (empty, velocity forward-compat, durations mismatch throw, durations
// propagation, ensureAudio failure propagation).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { playSequence } from '../audio-sequence'
import { ensureAudio, playPitchedNote } from '../audio'

vi.mock('../audio', () => ({
  ensureAudio: vi.fn(() => Promise.resolve({ currentTime: 0 } as unknown as AudioContext)),
  playPitchedNote: vi.fn(() => Promise.resolve()),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('playSequence — chord (interval=0)', () => {
  it('single note → exactly 1× playPitchedNote call z default duration 0.6', async () => {
    await playSequence([{ name: 'C', octave: 4 }], { interval: 0 })
    expect(playPitchedNote).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(playPitchedNote).mock.calls[0]
    expect(callArgs?.[1]).toEqual({ name: 'C', octave: 4 })
    expect(callArgs?.[2]).toBe(0.6)
  })

  it('chord (3 notes, interval=0) → 3× playPitchedNote calls in notes order', async () => {
    const notes = [
      { name: 'C' as const, octave: 4 },
      { name: 'E' as const, octave: 4 },
      { name: 'G' as const, octave: 4 },
    ]
    await playSequence(notes, { interval: 0 })
    expect(playPitchedNote).toHaveBeenCalledTimes(3)
    expect(vi.mocked(playPitchedNote).mock.calls[0]?.[1]).toEqual({ name: 'C', octave: 4 })
    expect(vi.mocked(playPitchedNote).mock.calls[1]?.[1]).toEqual({ name: 'E', octave: 4 })
    expect(vi.mocked(playPitchedNote).mock.calls[2]?.[1]).toEqual({ name: 'G', octave: 4 })
  })
})

describe('playSequence — sequence (interval>0)', () => {
  it('sequence (3 notes, interval=150ms) → cumulative call progression via fake timers', async () => {
    vi.useFakeTimers()
    const notes = [
      { name: 'C' as const, octave: 4 },
      { name: 'D' as const, octave: 4 },
      { name: 'E' as const, octave: 4 },
    ]
    // Don't await — promise resolves po Promise.all wszystkich setTimeouts; advance timers
    // manually i sprawdzaj cumulative count.
    const promise = playSequence(notes, { interval: 150 })
    // Flush microtask dla ensureAudio resolution + initial map setup.
    await vi.advanceTimersByTimeAsync(0)
    // t=0: pierwsza nuta scheduled (setTimeout 0ms)
    expect(playPitchedNote).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(150)
    expect(playPitchedNote).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(150)
    expect(playPitchedNote).toHaveBeenCalledTimes(3)
    await promise
    vi.useRealTimers()
  })
})

describe('playSequence — edge cases', () => {
  it('empty array → resolves immediately, zero playPitchedNote calls', async () => {
    await playSequence([], { interval: 0 })
    expect(playPitchedNote).not.toHaveBeenCalled()
  })

  it('velocity propagation forward-compat → no throw, resolves OK', async () => {
    await expect(
      playSequence([{ name: 'C', octave: 4 }], { interval: 0, velocity: 0.5 })
    ).resolves.toBeUndefined()
  })

  it('durations length mismatch → throws z message zawierającym lengths', async () => {
    await expect(
      playSequence(
        [{ name: 'C', octave: 4 }, { name: 'E', octave: 4 }],
        { interval: 0, durations: [0.5] }
      )
    ).rejects.toThrow(/durations\.length.*notes\.length/)
  })

  it('durations per-note propagation → playPitchedNote receives matching duration', async () => {
    await playSequence(
      [{ name: 'C', octave: 4 }, { name: 'E', octave: 4 }],
      { interval: 0, durations: [0.5, 1.0] }
    )
    expect(playPitchedNote).toHaveBeenCalledTimes(2)
    expect(vi.mocked(playPitchedNote).mock.calls[0]?.[2]).toBe(0.5)
    expect(vi.mocked(playPitchedNote).mock.calls[1]?.[2]).toBe(1.0)
  })

  it('ensureAudio failure → propagates rejection to caller', async () => {
    vi.mocked(ensureAudio).mockRejectedValueOnce(new Error('audio-unavailable'))
    await expect(
      playSequence([{ name: 'C', octave: 4 }], { interval: 0 })
    ).rejects.toThrow('audio-unavailable')
  })
})

describe('playSequence — onNoteStart callback (v5-15 ADR-054)', () => {
  it('sequential mode (interval=0 + durations + onNoteStart) → fires callback per-note z cumulative scheduledTime', async () => {
    vi.useFakeTimers()
    const notes = [
      { name: 'C' as const, octave: 4 },
      { name: 'D' as const, octave: 4 },
      { name: 'E' as const, octave: 4 },
    ]
    const onNoteStart = vi.fn()
    const promise = playSequence(notes, {
      interval: 0,
      durations: [0.5, 0.5, 1.0],
      onNoteStart,
    })
    // Flush ensureAudio + initial map setup
    await vi.advanceTimersByTimeAsync(0)
    expect(onNoteStart).toHaveBeenCalledTimes(1)
    expect(onNoteStart).toHaveBeenNthCalledWith(1, 0, 0)
    await vi.advanceTimersByTimeAsync(500)
    expect(onNoteStart).toHaveBeenCalledTimes(2)
    expect(onNoteStart).toHaveBeenNthCalledWith(2, 1, 500)
    await vi.advanceTimersByTimeAsync(500)
    expect(onNoteStart).toHaveBeenCalledTimes(3)
    expect(onNoteStart).toHaveBeenNthCalledWith(3, 2, 1000)
    await promise
    vi.useRealTimers()
  })

  it('legacy mode (interval>0 + onNoteStart) → fires callback per-note z i*interval delay', async () => {
    vi.useFakeTimers()
    const notes = [
      { name: 'C' as const, octave: 4 },
      { name: 'D' as const, octave: 4 },
    ]
    const onNoteStart = vi.fn()
    const promise = playSequence(notes, { interval: 150, onNoteStart })
    await vi.advanceTimersByTimeAsync(0)
    expect(onNoteStart).toHaveBeenCalledTimes(1)
    expect(onNoteStart).toHaveBeenNthCalledWith(1, 0, 0)
    await vi.advanceTimersByTimeAsync(150)
    expect(onNoteStart).toHaveBeenCalledTimes(2)
    expect(onNoteStart).toHaveBeenNthCalledWith(2, 1, 150)
    await promise
    vi.useRealTimers()
  })

  it('onNoteStart throw → playback NIE breaks; console.error logged', async () => {
    vi.useFakeTimers()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onNoteStart = vi.fn(() => { throw new Error('boom') })
    const promise = playSequence(
      [{ name: 'C', octave: 4 }],
      { interval: 0, durations: [0.5], onNoteStart }
    )
    await vi.advanceTimersByTimeAsync(0)
    expect(playPitchedNote).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[audio-sequence] onNoteStart callback threw:'),
      expect.any(Error)
    )
    await promise
    consoleErrorSpy.mockRestore()
    vi.useRealTimers()
  })

  it('backward-compat regression — interval=0 + durations + NO onNoteStart → hits chord codepath (synchronous)', async () => {
    // CRITICAL: replicates v5-14 test "durations per-note propagation" semantics.
    // Without onNoteStart presence, detection rule usesSequential=false → chord
    // codepath → 2× synchronous playPitchedNote calls (no setTimeout, no scheduling).
    await playSequence(
      [{ name: 'C', octave: 4 }, { name: 'E', octave: 4 }],
      { interval: 0, durations: [0.5, 1.0] }
    )
    expect(playPitchedNote).toHaveBeenCalledTimes(2)
    expect(vi.mocked(playPitchedNote).mock.calls[0]?.[2]).toBe(0.5)
    expect(vi.mocked(playPitchedNote).mock.calls[1]?.[2]).toBe(1.0)
  })

  it('AbortSignal mid-flight cancellation → clears pending setTimeouts; onNoteStart skipped post-abort', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const onNoteStart = vi.fn()
    const promise = playSequence(
      [
        { name: 'C', octave: 4 },
        { name: 'D', octave: 4 },
        { name: 'E', octave: 4 },
      ],
      {
        interval: 0,
        durations: [0.5, 0.5, 1.0],
        onNoteStart,
        signal: controller.signal,
      }
    )
    await vi.advanceTimersByTimeAsync(0)
    expect(onNoteStart).toHaveBeenCalledTimes(1)
    expect(playPitchedNote).toHaveBeenCalledTimes(1)
    controller.abort()
    await vi.advanceTimersByTimeAsync(1000)
    // Post-abort: onNoteStart NIE fires dla indices 1,2; playPitchedNote count stays 1
    expect(onNoteStart).toHaveBeenCalledTimes(1)
    expect(playPitchedNote).toHaveBeenCalledTimes(1)
    await expect(promise).resolves.toBeUndefined()
    vi.useRealTimers()
  })

  it('AbortSignal pre-aborted → playSequence resolves cleanly without firing callbacks', async () => {
    const controller = new AbortController()
    controller.abort()
    const onNoteStart = vi.fn()
    await expect(
      playSequence(
        [{ name: 'C', octave: 4 }],
        {
          interval: 0,
          durations: [0.5],
          onNoteStart,
          signal: controller.signal,
        }
      )
    ).resolves.toBeUndefined()
    expect(onNoteStart).not.toHaveBeenCalled()
    expect(playPitchedNote).not.toHaveBeenCalled()
  })
})
