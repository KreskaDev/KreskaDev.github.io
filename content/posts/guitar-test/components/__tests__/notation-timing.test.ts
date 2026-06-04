// notation-timing.test.ts — pure logic tests dla notation-timing.ts. ZERO mocks per
// hard rule #2 (no mocks dla pure math). Coverage target ≥95% line.

import { describe, it, expect } from 'vitest'
import type { Note } from '../types'
import {
  bpmToMsPerBeat,
  durationToBeats,
  durationToMs,
  notesToDurations,
  notesToScheduledTimes,
} from '../notation-timing'

describe('bpmToMsPerBeat', () => {
  it('120 BPM → 500 ms per beat', () => {
    expect(bpmToMsPerBeat(120)).toBe(500)
  })

  it('60 BPM → 1000 ms per beat', () => {
    expect(bpmToMsPerBeat(60)).toBe(1000)
  })

  it('90 BPM → ~666.67 ms per beat', () => {
    expect(bpmToMsPerBeat(90)).toBeCloseTo(666.667, 2)
  })

  it('zero or negative BPM throws', () => {
    expect(() => bpmToMsPerBeat(0)).toThrow(/bpm must be > 0/)
    expect(() => bpmToMsPerBeat(-50)).toThrow(/bpm must be > 0/)
  })
})

describe('durationToBeats', () => {
  it('canonical durations relative to quarter beat', () => {
    expect(durationToBeats('1')).toBe(4)
    expect(durationToBeats('1/2')).toBe(2)
    expect(durationToBeats('1/4')).toBe(1)
    expect(durationToBeats('1/8')).toBe(0.5)
    expect(durationToBeats('1/16')).toBe(0.25)
    expect(durationToBeats('1/32')).toBe(0.125)
  })

  it('dotted quarter = 1.5 beats', () => {
    expect(durationToBeats('1/4', true)).toBe(1.5)
  })

  it('dotted half = 3 beats', () => {
    expect(durationToBeats('1/2', true)).toBe(3)
  })

  it('triplet quarter (ratio [3,2]) = 2/3 beats', () => {
    expect(durationToBeats('1/4', false, { ratio: [3, 2] })).toBeCloseTo(2 / 3, 6)
  })

  it('invalid tuplet ratio throws', () => {
    expect(() => durationToBeats('1/4', false, { ratio: [0, 2] })).toThrow(/positive numbers/)
    expect(() => durationToBeats('1/4', false, { ratio: [3, 0] })).toThrow(/positive numbers/)
  })
})

describe('durationToMs', () => {
  it('quarter at 120 BPM = 500 ms', () => {
    expect(durationToMs('1/4', false, 120)).toBe(500)
  })

  it('dotted half at 60 BPM = 3000 ms', () => {
    expect(durationToMs('1/2', true, 60)).toBe(3000)
  })

  it('triplet eighth at 120 BPM = (2/3 × 500) / 2 = 166.67 ms approx', () => {
    // 1/8 = 0.5 beat, triplet [3,2] → 0.5 × 2/3 = 1/3 beat; at 120 BPM (500ms/beat)
    // → 1/3 × 500 = 166.67 ms
    expect(durationToMs('1/8', false, 120, { ratio: [3, 2] })).toBeCloseTo(166.667, 2)
  })
})

describe('notesToDurations', () => {
  const q = (letter: 'C' | 'D' | 'E' | 'F'): Note =>
    ({ pitch: { letter, octave: 4 }, duration: '1/4' })
  const half = (letter: 'C' | 'D' | 'E' | 'F'): Note =>
    ({ pitch: { letter, octave: 4 }, duration: '1/2' })

  it('empty array → empty result', () => {
    expect(notesToDurations([], 120)).toEqual([])
  })

  it('q, q, half at 120 BPM → [500, 500, 1000]', () => {
    expect(notesToDurations([q('C'), q('D'), half('E')], 120)).toEqual([500, 500, 1000])
  })

  it('tied chain (2× tied quarters same pitch) → single merged duration', () => {
    const tied: Note = { pitch: { letter: 'C', octave: 4 }, duration: '1/4', tied: true }
    const second: Note = { pitch: { letter: 'C', octave: 4 }, duration: '1/4' }
    expect(notesToDurations([tied, second, half('E')], 120)).toEqual([1000, 1000])
  })

  it('tied chain 3× quarters same pitch → single 1500ms duration', () => {
    const t1: Note = { pitch: { letter: 'C', octave: 4 }, duration: '1/4', tied: true }
    const t2: Note = { pitch: { letter: 'C', octave: 4 }, duration: '1/4', tied: true }
    const t3: Note = { pitch: { letter: 'C', octave: 4 }, duration: '1/4' }
    expect(notesToDurations([t1, t2, t3], 120)).toEqual([1500])
  })

  it('tied broken — different pitch → no merge', () => {
    const tied: Note = { pitch: { letter: 'C', octave: 4 }, duration: '1/4', tied: true }
    expect(notesToDurations([tied, q('D'), half('E')], 120)).toEqual([500, 500, 1000])
  })

  it('rest skipped from audio durations', () => {
    const rest: Note = { duration: '1/4', rest: true }
    expect(notesToDurations([q('C'), rest, q('E')], 120)).toEqual([500, 500])
  })

  it('negative BPM throws via durationToMs propagation', () => {
    expect(() => notesToDurations([q('C')], -50)).toThrow(/bpm must be > 0/)
  })
})

describe('notesToScheduledTimes', () => {
  const q = (letter: 'C' | 'D' | 'E' | 'F'): Note =>
    ({ pitch: { letter, octave: 4 }, duration: '1/4' })
  const half = (letter: 'C' | 'D' | 'E' | 'F'): Note =>
    ({ pitch: { letter, octave: 4 }, duration: '1/2' })

  it('empty array → empty result', () => {
    expect(notesToScheduledTimes([], 120)).toEqual([])
  })

  it('q, q, half at 120 BPM → [0, 500, 1000]', () => {
    expect(notesToScheduledTimes([q('C'), q('D'), half('E')], 120)).toEqual([0, 500, 1000])
  })

  it('rest counted in scheduling offset (NIE skipped)', () => {
    const rest: Note = { duration: '1/4', rest: true }
    expect(notesToScheduledTimes([q('C'), rest, q('E')], 120)).toEqual([0, 1000])
  })

  it('tied chain compresses to single scheduled entry', () => {
    const tied: Note = { pitch: { letter: 'C', octave: 4 }, duration: '1/4', tied: true }
    const second: Note = { pitch: { letter: 'C', octave: 4 }, duration: '1/4' }
    // Tied note + next merged; scheduled times = [0 (merged note), 1000 (next non-tied)]
    expect(notesToScheduledTimes([tied, second, half('E')], 120)).toEqual([0, 1000])
  })
})
