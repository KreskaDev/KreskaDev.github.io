// Notation widget integration tests per plan §3.3 (≥9 cases, coverage ≥85% line).
// Mocks: vexflow/bravura (jsdom NIE supportuje VexFlow Factory rendering reliably),
// next-themes, ../audio-sequence, ../audio. Hard rule #2 N/A — to integration test
// nie pure math.

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import Notation from '../Notation'
import type { Note } from '../types'

// === VexFlow Factory mock — minimalny shape satisfying Notation.tsx render path. ===
type MockStaveNote = {
  setStyle: (style: Record<string, string>) => MockStaveNote
  addModifier: (mod: unknown, idx?: number) => MockStaveNote
}
const makeStaveNote = (): MockStaveNote => ({
  setStyle: vi.fn(() => makeStaveNote()),
  addModifier: vi.fn(() => makeStaveNote()),
})

const makeStave = () => {
  const s = {
    addTimeSignature: vi.fn(() => s),
    addKeySignature: vi.fn(() => s),
    setContext: vi.fn(() => s),
  }
  return s
}

const makeVoice = () => ({
  addTickables: vi.fn(function (this: unknown) { return this }),
  setStrict: vi.fn(function (this: unknown) { return this }),
})

const makeFormatter = () => ({
  joinVoices: vi.fn(function (this: unknown) { return this }),
  format: vi.fn(function (this: unknown) { return this }),
})

const factoryCtor = vi.fn()
const drawSpy = vi.fn()

vi.mock('vexflow/bravura', () => {
  return {
    VexFlow: {
      Factory: vi.fn().mockImplementation(function (this: object, options: object) {
        factoryCtor(options)
        Object.assign(this, {
          getContext: vi.fn(() => ({})),
          Stave: vi.fn(() => makeStave()),
          StaveNote: vi.fn(() => makeStaveNote()),
          Voice: vi.fn(() => makeVoice()),
          Formatter: vi.fn(() => makeFormatter()),
          Accidental: vi.fn(() => ({})),
          Articulation: vi.fn(() => ({})),
          Ornament: vi.fn(() => ({})),
          Tuplet: vi.fn(() => ({})),
          StaveTie: vi.fn(() => ({})),
          draw: drawSpy,
        })
      }),
    },
  }
})

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: 'dark-cool' })),
}))

type PlaySequenceFn = (notes: unknown, options: unknown) => Promise<void>
const playSequenceSpy = vi.fn<PlaySequenceFn>(() => Promise.resolve())
vi.mock('../audio-sequence', () => ({
  playSequence: (notes: unknown, options: unknown) => playSequenceSpy(notes, options),
}))

type PlayPitchedNoteFn = (ctx: AudioContext, note: unknown, dur: number) => Promise<void>
const ensureAudioSpy = vi.fn(() => Promise.resolve({ currentTime: 0 } as unknown as AudioContext))
const playPitchedNoteSpy = vi.fn<PlayPitchedNoteFn>(() => Promise.resolve())
vi.mock('../audio', () => ({
  ensureAudio: () => ensureAudioSpy(),
  playPitchedNote: (ctx: AudioContext, note: unknown, dur: number) => playPitchedNoteSpy(ctx, note, dur),
}))

// jsdom rAF stub — fire synchronously (skipping next-paint deferral acceptable w test).
beforeEach(() => {
  vi.clearAllMocks()
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0)
    return 0
  }) as typeof globalThis.requestAnimationFrame
  globalThis.cancelAnimationFrame = (() => {}) as typeof globalThis.cancelAnimationFrame
})

const Q = (letter: 'C' | 'D' | 'E' | 'F', octave = 4): Note =>
  ({ pitch: { letter, octave }, duration: '1/4' })

describe('Notation widget — render', () => {
  it('minimal 1-note → Factory called once + draw invoked', async () => {
    await act(async () => {
      render(<Notation id="t1" notes={[Q('C')]} />)
    })
    // Factory constructor wrapped via mockImplementation calls factoryCtor with options.
    expect(factoryCtor).toHaveBeenCalledTimes(1)
    expect(drawSpy).toHaveBeenCalledTimes(1)
    // Background config = transparent per ADR-053 theme injection
    const opts = factoryCtor.mock.calls[0]?.[0] as { renderer: { background: string } }
    expect(opts.renderer.background).toBe('transparent')
  })
})

describe('Notation widget — BPM hybrid control', () => {
  it('defaultBpm=120 → slider + input synced; slider→90 propagates; clamp 300→240', async () => {
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(<Notation id="t2" defaultBpm={120} notes={[Q('C')]} />)
    })
    const slider = result!.getByTestId('bpm-slider') as HTMLInputElement
    const input = result!.getByTestId('bpm-input') as HTMLInputElement
    expect(slider.value).toBe('120')
    expect(input.value).toBe('120')

    await act(async () => { fireEvent.change(slider, { target: { value: '90' } }) })
    expect(input.value).toBe('90')

    await act(async () => { fireEvent.change(input, { target: { value: '300' } }) })
    expect(slider.value).toBe('240')
  })
})

describe('Notation widget — Play button', () => {
  it('enableAudio=true → ▶ Play visible; click → playSequence called z {interval:0, durations, signal, onNoteStart}', async () => {
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(<Notation id="t3" notes={[Q('C'), Q('D'), Q('E')]} />)
    })
    const btn = result!.getByTestId('play-button')
    expect(btn.textContent).toContain('Play')
    await act(async () => { fireEvent.click(btn) })
    expect(playSequenceSpy).toHaveBeenCalledTimes(1)
    const callArgs = playSequenceSpy.mock.calls[0]
    const options = callArgs?.[1] as { interval: number; durations: number[]; onNoteStart?: unknown; signal?: AbortSignal }
    expect(options.interval).toBe(0)
    expect(Array.isArray(options.durations)).toBe(true)
    expect(options.durations).toHaveLength(3)
    expect(options.onNoteStart).toBeTypeOf('function')
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it('enableAudio=false → ▶ Play hidden', async () => {
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(<Notation id="t4" enableAudio={false} notes={[Q('C')]} />)
    })
    expect(result!.queryByTestId('play-button')).toBeNull()
  })
})

describe('Notation widget — onNoteStart highlight', () => {
  it('onNoteStart callback → data-current-note attribute updates per-note', async () => {
    let result: ReturnType<typeof render> | undefined
    let capturedOnNoteStart: ((idx: number, scheduled: number) => void) | undefined
    playSequenceSpy.mockImplementationOnce((_notes, opts) => {
      capturedOnNoteStart = (opts as { onNoteStart: (i: number, s: number) => void }).onNoteStart
      return Promise.resolve()
    })
    await act(async () => {
      result = render(<Notation id="t5" notes={[Q('C'), Q('D'), Q('E')]} />)
    })
    await act(async () => { fireEvent.click(result!.getByTestId('play-button')) })
    expect(capturedOnNoteStart).toBeDefined()
    const hostDiv = result!.container.querySelector('.notation-host') as HTMLElement
    expect(hostDiv).toBeTruthy()
    await act(async () => { capturedOnNoteStart!(0, 0) })
    expect(hostDiv.getAttribute('data-current-note')).toBe('0')
    await act(async () => { capturedOnNoteStart!(1, 500) })
    expect(hostDiv.getAttribute('data-current-note')).toBe('1')
    await act(async () => { capturedOnNoteStart!(2, 1000) })
    expect(hostDiv.getAttribute('data-current-note')).toBe('2')
  })
})

describe('Notation widget — Stop toggle', () => {
  it('click Play then click Stop → abort signal triggered + currentNoteIdx reset', async () => {
    let result: ReturnType<typeof render> | undefined
    let capturedSignal: AbortSignal | undefined
    playSequenceSpy.mockImplementationOnce((_notes, opts) => {
      capturedSignal = (opts as { signal: AbortSignal }).signal
      return new Promise(() => { /* never resolves; emulates long playback */ })
    })
    await act(async () => {
      result = render(<Notation id="t6" notes={[Q('C'), Q('D')]} />)
    })
    const btn = result!.getByTestId('play-button')
    await act(async () => { fireEvent.click(btn) })
    expect(btn.textContent).toContain('Stop')
    expect(capturedSignal?.aborted).toBe(false)
    await act(async () => { fireEvent.click(btn) })
    expect(capturedSignal?.aborted).toBe(true)
    expect(btn.textContent).toContain('Play')
  })
})

describe('Notation widget — multi-instance independence', () => {
  it('2× widgets w container → niezależny Factory calls + BPM state', async () => {
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(
        <>
          <Notation id="ma" defaultBpm={90} notes={[Q('C')]} />
          <Notation id="mb" defaultBpm={120} notes={[Q('D')]} />
        </>
      )
    })
    expect(factoryCtor).toHaveBeenCalledTimes(2)
    const sliders = result!.container.querySelectorAll('[data-testid="bpm-slider"]') as NodeListOf<HTMLInputElement>
    expect(sliders).toHaveLength(2)
    expect(sliders[0]!.value).toBe('90')
    expect(sliders[1]!.value).toBe('120')
    await act(async () => { fireEvent.change(sliders[0]!, { target: { value: '60' } }) })
    expect(sliders[0]!.value).toBe('60')
    expect(sliders[1]!.value).toBe('120')
  })
})

describe('Notation widget — chord audio expansion', () => {
  it('chord pitch[] → playSequence dla pierwszej + extras via playPitchedNote w onNoteStart', async () => {
    let result: ReturnType<typeof render> | undefined
    let capturedOnNoteStart: ((idx: number, scheduled: number) => void) | undefined
    let capturedNotes: unknown
    playSequenceSpy.mockImplementationOnce((notes, opts) => {
      capturedNotes = notes
      capturedOnNoteStart = (opts as { onNoteStart: (i: number, s: number) => void }).onNoteStart
      return Promise.resolve()
    })
    const chord: Note = {
      pitch: [
        { letter: 'C', octave: 4 },
        { letter: 'E', octave: 4 },
        { letter: 'G', octave: 4 },
      ],
      duration: '1/4',
    }
    await act(async () => {
      result = render(<Notation id="t7" notes={[chord]} />)
    })
    await act(async () => { fireEvent.click(result!.getByTestId('play-button')) })
    // playSequence called z melodic = [C4] (first pitch only)
    const melodic = capturedNotes as Array<{ name: string }>
    expect(melodic.length).toBe(1)
    expect(melodic[0]?.name).toBe('C')
    // Fire onNoteStart → expect extras E4, G4 via direct playPitchedNote
    await act(async () => { capturedOnNoteStart?.(0, 0) })
    // Extras = E + G (2 calls)
    expect(playPitchedNoteSpy).toHaveBeenCalledTimes(2)
    const call0 = playPitchedNoteSpy.mock.calls[0]
    const call1 = playPitchedNoteSpy.mock.calls[1]
    expect((call0?.[1] as { name: string } | undefined)?.name).toBe('E')
    expect((call1?.[1] as { name: string } | undefined)?.name).toBe('G')
  })
})

describe('Notation widget — error fallback', () => {
  it('VexFlow.Factory throw → render <pre> error fallback + console.error logged', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Single-shot throw on next Factory ctor invocation (vi.mock is per-test mocked).
    factoryCtor.mockImplementationOnce(() => { throw new Error('vf-render-fail') })
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(<Notation id="t8" notes={[Q('C')]} />)
    })
    const errEl = result!.container.querySelector('pre')
    expect(errEl).toBeTruthy()
    expect(errEl?.textContent).toContain('vf-render-fail')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Notation] render failed:'),
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})

// === v5-16.2 NEW: external onNoteStart additive prop (per ADR-059 Notation extension) ===

describe('Notation widget — v5-16.2 external onNoteStart prop', () => {
  it('external onNoteStart fires per-note synchronously z internal cursor (entry.origIdx semantyka)', async () => {
    const external = vi.fn<(idx: number, scheduled: number) => void>()
    let capturedOnNoteStart: ((idx: number, scheduled: number) => void) | undefined
    playSequenceSpy.mockImplementationOnce((_notes, opts) => {
      capturedOnNoteStart = (opts as { onNoteStart: (i: number, s: number) => void }).onNoteStart
      return Promise.resolve()
    })
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(
        <Notation id="ext-fire" notes={[Q('C'), Q('D'), Q('E')]} onNoteStart={external} />,
      )
    })
    await act(async () => { fireEvent.click(result!.getByTestId('play-button')) })
    expect(capturedOnNoteStart).toBeDefined()

    // Fire internal playSequence onNoteStart manually (simulates audio-sequence per-note tick)
    await act(async () => { capturedOnNoteStart!(0, 0) })
    await act(async () => { capturedOnNoteStart!(1, 500) })
    await act(async () => { capturedOnNoteStart!(2, 1000) })

    // External called z entry.origIdx (= original notes[] index post-buildPlaybackSchedule).
    // Dla single-voice melodic Note[] origIdx === playIdx, ale assertion sprawdza forward.
    expect(external).toHaveBeenCalledTimes(3)
    expect(external).toHaveBeenNthCalledWith(1, 0, 0)
    expect(external).toHaveBeenNthCalledWith(2, 1, 500)
    expect(external).toHaveBeenNthCalledWith(3, 2, 1000)

    // Internal cursor STILL fires (data-current-note updates niezależnie)
    const hostDiv = result!.container.querySelector('.notation-host') as HTMLElement
    expect(hostDiv.getAttribute('data-current-note')).toBe('2')
  })

  it('external onNoteStart throw NIE breaks internal cursor lub playback (defensive try/catch)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const external = vi.fn<(idx: number, scheduled: number) => void>(() => {
      throw new Error('external-throw-test')
    })
    let capturedOnNoteStart: ((idx: number, scheduled: number) => void) | undefined
    playSequenceSpy.mockImplementationOnce((_notes, opts) => {
      capturedOnNoteStart = (opts as { onNoteStart: (i: number, s: number) => void }).onNoteStart
      return Promise.resolve()
    })
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(
        <Notation id="ext-throw" notes={[Q('C'), Q('D')]} onNoteStart={external} />,
      )
    })
    await act(async () => { fireEvent.click(result!.getByTestId('play-button')) })

    // Fire onNoteStart — external throw'uje ale NIE propaguje
    await act(async () => { capturedOnNoteStart!(0, 0) })
    await act(async () => { capturedOnNoteStart!(1, 500) })

    expect(external).toHaveBeenCalledTimes(2)
    // Internal cursor updates intact mimo external throws
    const hostDiv = result!.container.querySelector('.notation-host') as HTMLElement
    expect(hostDiv.getAttribute('data-current-note')).toBe('1')
    // console.error logged dla external throw (Notation defensive wrapper)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Notation] external onNoteStart threw:'),
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })
})
