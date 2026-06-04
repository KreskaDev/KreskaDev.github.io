// ScaleOnFretboard integration tests per plan §3.2 (≥10 cases, coverage ≥85% line).
// Mocks: Fretboard (shallow spy dla props inspection), next-themes, ../audio-sequence,
// ../audio. Hard rule #2 N/A — integration test, NIE pure math.

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import ScaleOnFretboard from '../ScaleOnFretboard'
import { NotationScaleLinkCursorContext } from '../NotationScaleLinkContext'
import type { Note, FretboardNote, NoteName } from '../types'

// === Fretboard shallow mock — capture props dla assertion ===
type FretboardSpyProps = {
  id: string
  notes: FretboardNote[]
  rootNote?: NoteName
  fretCount?: number
}
const fretboardSpy = vi.fn<(props: FretboardSpyProps) => void>()
vi.mock('../Fretboard', () => ({
  default: (props: FretboardSpyProps) => {
    fretboardSpy(props)
    return <div data-fretboard-id={props.id} data-mock-fretboard="" />
  },
}))

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: 'dark' })),
}))

type PlaySequenceOptions = {
  interval: number
  durations?: number[]
  startTimes?: number[]
  signal?: AbortSignal
  onNoteStart?: (idx: number, scheduledMs: number) => void
}
const playSequenceSpy = vi.fn<(notes: unknown, options: PlaySequenceOptions) => Promise<void>>(
  () => Promise.resolve(),
)
vi.mock('../audio-sequence', () => ({
  playSequence: (notes: unknown, options: PlaySequenceOptions) =>
    playSequenceSpy(notes, options),
}))

const ensureAudioSpy = vi.fn(() => Promise.resolve({ currentTime: 0 } as unknown as AudioContext))
vi.mock('../audio', () => ({
  ensureAudio: () => ensureAudioSpy(),
  playPitchedNote: vi.fn(() => Promise.resolve()),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// Helper: quarter-note pitch w shipped Note shape.
const Q = (letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', octave = 3): Note =>
  ({ pitch: { letter, octave }, duration: '1/4' })

const REST = (duration: Note['duration'] = '1/4'): Note => ({ duration, rest: true })

describe('ScaleOnFretboard — render + position derivation', () => {
  it('renders Fretboard z derived FretboardNote[] (explicit positions preserved)', () => {
    const notes: Note[] = [
      { pitch: { letter: 'C', octave: 3 }, position: { string: 1, fret: 3 }, duration: '1/4' },
      { pitch: { letter: 'E', octave: 3 }, position: { string: 0, fret: 12 }, duration: '1/4' },
    ]
    render(<ScaleOnFretboard id="test-explicit" notes={notes} rootNote="C" />)
    expect(fretboardSpy).toHaveBeenCalled()
    const props = fretboardSpy.mock.calls[0]![0]
    expect(props.notes).toHaveLength(2)
    expect(props.notes[0]).toMatchObject({ string: 1, fret: 3, color: 'root' })
    expect(props.notes[1]).toMatchObject({ string: 0, fret: 12 })
    expect(props.rootNote).toBe('C')
  })

  it('derives positions via note-positions naïve lookup when Note.position absent', () => {
    const notes: Note[] = [Q('E', 2), Q('A', 2)]
    render(<ScaleOnFretboard id="test-naive" notes={notes} rootNote="E" />)
    const props = fretboardSpy.mock.calls[0]![0]
    expect(props.notes).toHaveLength(2)
    // E2 lowest fret = {string:0, fret:0} (low E open)
    expect(props.notes[0]).toMatchObject({ string: 0, fret: 0, color: 'root' })
    // A2 lowest fret = {string:0, fret:5} (low E + 5 semitones) or {string:1, fret:0}
    // sort lowest-fret-first → {string:1, fret:0}
    expect(props.notes[1]).toMatchObject({ string: 1, fret: 0 })
  })

  it('rootNote auto-derived from first non-rest pitch when prop absent', () => {
    const notes: Note[] = [Q('G', 3), Q('A', 3)]
    render(<ScaleOnFretboard id="test-autoroot" notes={notes} />)
    const props = fretboardSpy.mock.calls[0]![0]
    expect(props.rootNote).toBe('G')
  })
})

describe('ScaleOnFretboard — arrows overlay', () => {
  it('renders N-1 arrow <line> elements dla N non-rest positions', () => {
    const notes: Note[] = [Q('C', 3), Q('D', 3), Q('E', 3), Q('F', 3)]
    const { container } = render(
      <ScaleOnFretboard id="test-arrows" notes={notes} rootNote="C" showArrows={true} />,
    )
    const lines = container.querySelectorAll('svg line')
    // 4 positions → 3 segments (some may be skipped if len<26; for E-F adjacent same-string positions)
    // We assert ≤ N-1 (3) and ≥ 1 (at least one survives the len threshold).
    expect(lines.length).toBeLessThanOrEqual(3)
    expect(lines.length).toBeGreaterThanOrEqual(1)
  })

  it('renders zero arrows when showArrows={false}', () => {
    const notes: Note[] = [Q('C', 3), Q('D', 3), Q('E', 3)]
    const { container } = render(
      <ScaleOnFretboard id="test-noarrows" notes={notes} rootNote="C" showArrows={false} />,
    )
    const lines = container.querySelectorAll('svg line')
    expect(lines.length).toBe(0)
  })

  it('skips rests in arrow chain (connects neighboring non-rest positions)', () => {
    const notes: Note[] = [Q('C', 3), REST(), Q('E', 3), Q('G', 3)]
    render(<ScaleOnFretboard id="test-rest" notes={notes} rootNote="C" />)
    const props = fretboardSpy.mock.calls[0]![0]
    // 3 non-rest pitches → 3 entries w fretboardNotes (rest filtered out)
    expect(props.notes).toHaveLength(3)
  })
})

describe('ScaleOnFretboard — BPM control', () => {
  it('renders BPM slider + input + Play button (standalone defaults)', () => {
    const notes: Note[] = [Q('C', 3)]
    const { getByTestId } = render(
      <ScaleOnFretboard id="test-bpm" notes={notes} rootNote="C" />,
    )
    expect(getByTestId('bpm-slider')).toBeDefined()
    expect(getByTestId('bpm-input')).toBeDefined()
    expect(getByTestId('play-button')).toBeDefined()
  })

  it('clamps BPM input to [40..240] range', () => {
    const notes: Note[] = [Q('C', 3)]
    const { getByTestId } = render(
      <ScaleOnFretboard id="test-clamp" notes={notes} rootNote="C" defaultBpm={500} />,
    )
    const input = getByTestId('bpm-input') as HTMLInputElement
    expect(Number(input.value)).toBe(240)

    fireEvent.change(input, { target: { value: '20' } })
    expect(Number(input.value)).toBe(40)

    fireEvent.change(input, { target: { value: '120' } })
    expect(Number(input.value)).toBe(120)
  })

  it('hides BPM control + Play when showBpmControl={false}', () => {
    const notes: Note[] = [Q('C', 3)]
    const { queryByTestId } = render(
      <ScaleOnFretboard
        id="test-hidden"
        notes={notes}
        rootNote="C"
        showBpmControl={false}
      />,
    )
    expect(queryByTestId('bpm-slider')).toBeNull()
    expect(queryByTestId('play-button')).toBeNull()
  })
})

describe('ScaleOnFretboard — playback', () => {
  it('Play click triggers playSequence z derived schedule + AbortSignal + onNoteStart', async () => {
    const notes: Note[] = [Q('C', 3), Q('D', 3)]
    const { getByTestId } = render(
      <ScaleOnFretboard id="test-play" notes={notes} rootNote="C" />,
    )
    await act(async () => {
      fireEvent.click(getByTestId('play-button'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(ensureAudioSpy).toHaveBeenCalled()
    expect(playSequenceSpy).toHaveBeenCalled()
    const [melodicArg, optsArg] = playSequenceSpy.mock.calls[0]!
    expect(Array.isArray(melodicArg)).toBe(true)
    expect((melodicArg as unknown[]).length).toBe(2)
    expect(optsArg.interval).toBe(0)
    expect(optsArg.durations).toHaveLength(2)
    expect(optsArg.startTimes).toHaveLength(2)
    expect(optsArg.signal).toBeInstanceOf(AbortSignal)
    expect(typeof optsArg.onNoteStart).toBe('function')
  })

  it('Stop toggle mid-playback aborts AbortController + resets state', async () => {
    const notes: Note[] = [Q('C', 3), Q('D', 3)]
    // Make playSequence never-resolving Promise so isPlaying stays true.
    let abortSignal: AbortSignal | undefined
    playSequenceSpy.mockImplementationOnce((_notes, opts) => {
      abortSignal = opts.signal
      return new Promise(() => {}) // never resolves
    })
    const { getByTestId } = render(
      <ScaleOnFretboard id="test-stop" notes={notes} rootNote="C" />,
    )
    await act(async () => {
      fireEvent.click(getByTestId('play-button'))
      await Promise.resolve()
      await Promise.resolve()
    })
    // Button should now show Stop
    expect(getByTestId('play-button').textContent).toContain('Stop')
    // Click Stop
    await act(async () => {
      fireEvent.click(getByTestId('play-button'))
    })
    expect(abortSignal?.aborted).toBe(true)
    expect(getByTestId('play-button').textContent).toContain('Play')
  })

  it('onNoteStart callback updates data-current-note attribute', async () => {
    const notes: Note[] = [Q('C', 3), Q('D', 3), Q('E', 3)]
    let capturedOnNoteStart: ((idx: number, ms: number) => void) | undefined
    playSequenceSpy.mockImplementationOnce((_notes, opts) => {
      capturedOnNoteStart = opts.onNoteStart
      return new Promise(() => {})
    })
    const { getByTestId, container } = render(
      <ScaleOnFretboard id="test-highlight" notes={notes} rootNote="C" />,
    )
    await act(async () => {
      fireEvent.click(getByTestId('play-button'))
      await Promise.resolve()
      await Promise.resolve()
    })
    // Trigger onNoteStart manually (simulate audio-sequence firing per scheduled note)
    expect(capturedOnNoteStart).toBeDefined()
    await act(async () => {
      capturedOnNoteStart!(1, 100)
    })
    const overflowDiv = container.querySelector('[data-current-note]')
    expect(overflowDiv?.getAttribute('data-current-note')).toBe('1')
  })
})

describe('ScaleOnFretboard — linked mode (Pattern C)', () => {
  it('linked mode (non-null cursor context) hides Play + BPM; renders highlight z context cursor', () => {
    const notes: Note[] = [Q('C', 3), Q('D', 3), Q('E', 3)]
    const cursorValue = {
      currentNoteIdx: 2,
      isPlaying: false,
      setCurrentNoteIdx: vi.fn(),
      setIsPlaying: vi.fn(),
    }
    const { queryByTestId, container } = render(
      <NotationScaleLinkCursorContext.Provider value={cursorValue}>
        <ScaleOnFretboard id="test-linked" notes={notes} rootNote="C" />
      </NotationScaleLinkCursorContext.Provider>,
    )
    expect(queryByTestId('bpm-slider')).toBeNull()
    expect(queryByTestId('play-button')).toBeNull()
    const overflowDiv = container.querySelector('[data-current-note]')
    expect(overflowDiv?.getAttribute('data-current-note')).toBe('2')
  })

  it('standalone (outside provider) renders Play + BPM intact', () => {
    const notes: Note[] = [Q('C', 3)]
    const { getByTestId } = render(
      <ScaleOnFretboard id="test-standalone" notes={notes} rootNote="C" />,
    )
    expect(getByTestId('play-button')).toBeDefined()
    expect(getByTestId('bpm-slider')).toBeDefined()
  })
})

describe('ScaleOnFretboard — defensive validation', () => {
  it('throws on chord-on-staff Note z message zawierającym id + index + hint', () => {
    const notes: Note[] = [
      {
        pitch: [
          { letter: 'C', octave: 4 },
          { letter: 'E', octave: 4 },
        ],
        duration: '1/4',
      },
    ]
    // Suppress error boundary noise
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(<ScaleOnFretboard id="bad-id-XYZ" notes={notes} rootNote="C" />),
    ).toThrow(/bad-id-XYZ.*index 0/s)
    errSpy.mockRestore()
  })

  it('rest-only Note[] renders OK + Play handler returns early (zero playSequence)', async () => {
    const notes: Note[] = [REST(), REST()]
    const { getByTestId } = render(
      <ScaleOnFretboard id="test-restonly" notes={notes} rootNote="C" />,
    )
    await act(async () => {
      fireEvent.click(getByTestId('play-button'))
      await Promise.resolve()
    })
    expect(playSequenceSpy).not.toHaveBeenCalled()
  })
})
