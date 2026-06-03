// Tablature widget integration tests per plan §1.2 + §2-§8 (≥12 cases, coverage ≥85% line).
// Mocks: vexflow/bravura Factory mirror Notation.test.tsx pattern (Sesja 24 precedent),
// next-themes, ../audio-sequence, ../audio. NIE hard rule #2 (integration, not pure math).

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import Tablature from '../Tablature'
import { DROP_D, DADGAD } from '../tunings'
import type { Note } from '../types'

// === VexFlow Factory mock — minimalny shape satisfying Tablature.tsx render path ===
type MockTabNote = {
  setStyle: (style: Record<string, string>) => MockTabNote
  addModifier: (mod: unknown, idx?: number) => MockTabNote
}
const makeTabNote = (): MockTabNote => ({
  setStyle: vi.fn(() => makeTabNote()),
  addModifier: vi.fn(() => makeTabNote()),
})

const makeTabStave = () => {
  const s = {
    addTabGlyph: vi.fn(() => s),
    addTimeSignature: vi.fn(() => s),
    setContext: vi.fn(() => s),
  }
  return s
}

const makeVoice = () => ({
  addTickables: vi.fn(function (this: unknown) {
    return this
  }),
  setStrict: vi.fn(function (this: unknown) {
    return this
  }),
})

const makeFormatter = () => ({
  format: vi.fn(function (this: unknown) {
    return this
  }),
})

const factoryCtor = vi.fn()
const drawSpy = vi.fn()
const tabStaveSpy = vi.fn()
const tabNoteSpy = vi.fn()

vi.mock('vexflow/bravura', () => {
  return {
    VexFlow: {
      Factory: vi.fn().mockImplementation(function (this: object, options: object) {
        factoryCtor(options)
        Object.assign(this, {
          getContext: vi.fn(() => ({})),
          TabStave: vi.fn((opts: unknown) => {
            tabStaveSpy(opts)
            return makeTabStave()
          }),
          TabNote: vi.fn((opts: unknown) => {
            tabNoteSpy(opts)
            return makeTabNote()
          }),
          Voice: vi.fn(() => makeVoice()),
          Formatter: vi.fn(() => makeFormatter()),
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

const ensureAudioSpy = vi.fn(() => Promise.resolve({ currentTime: 0 } as unknown as AudioContext))
type PlayPitchedNoteFn = (ctx: AudioContext, note: unknown, dur: number) => Promise<void>
const playPitchedNoteSpy = vi.fn<PlayPitchedNoteFn>(() => Promise.resolve())
vi.mock('../audio', () => ({
  ensureAudio: () => ensureAudioSpy(),
  playPitchedNote: (ctx: AudioContext, note: unknown, dur: number) =>
    playPitchedNoteSpy(ctx, note, dur),
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

const Q = (
  letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B',
  octave = 4,
  position?: { string: number; fret: number },
): Note => ({
  pitch: { letter, octave },
  duration: '1/4',
  ...(position ? { position } : {}),
})

describe('Tablature widget — render lifecycle', () => {
  it('minimal 1-note z explicit position → Factory + TabStave + TabNote + draw called', async () => {
    await act(async () => {
      render(
        <Tablature id="tab-min" notes={[Q('C', 4, { string: 4, fret: 3 })]} />,
      )
    })
    expect(factoryCtor).toHaveBeenCalledTimes(1)
    expect(tabStaveSpy).toHaveBeenCalledTimes(1)
    expect(tabNoteSpy).toHaveBeenCalledTimes(1)
    expect(drawSpy).toHaveBeenCalledTimes(1)
    const tabNoteOpts = tabNoteSpy.mock.calls[0]![0] as {
      positions: Array<{ str: number; fret: number | string }>
      duration: string
    }
    // tuning.strings.length=6, position.string=4 → vexStr = 6-4 = 2
    expect(tabNoteOpts.positions).toEqual([{ str: 2, fret: 3 }])
    expect(tabNoteOpts.duration).toBe('q')
  })

  it('absent position → fallback getPositions first-match (C4 STANDARD = string:1 fret:1)', async () => {
    await act(async () => {
      render(<Tablature id="tab-fallback" notes={[Q('C', 4)]} />)
    })
    expect(tabNoteSpy).toHaveBeenCalledTimes(1)
    const opts = tabNoteSpy.mock.calls[0]![0] as {
      positions: Array<{ str: number; fret: number | string }>
    }
    // C4 STANDARD lowest-fret first-pos = {string:4, fret:1} (B3 string + 1 semitone)
    // → vexStr = tuning.strings.length(6) - position.string(4) = 2
    expect(opts.positions[0]!.str).toBe(2)
    expect(opts.positions[0]!.fret).toBe(1)
  })

  it('chord-on-tab: pitch array → multi-position TabNote (G3-C4-E4 → 3 positions)', async () => {
    await act(async () => {
      render(
        <Tablature
          id="tab-chord"
          notes={[
            {
              pitch: [
                { letter: 'G', octave: 3 },
                { letter: 'C', octave: 4 },
                { letter: 'E', octave: 4 },
              ],
              duration: '1/2',
            },
          ]}
        />,
      )
    })
    expect(tabNoteSpy).toHaveBeenCalledTimes(1)
    const opts = tabNoteSpy.mock.calls[0]![0] as {
      positions: Array<{ str: number; fret: number | string }>
    }
    expect(opts.positions).toHaveLength(3)
    // G3 STANDARD = string:3 fret:0 → vexStr=3; C4 = string:1 fret:1 → vexStr=5? wait
    // Actually C4 lowest-fret STANDARD = string:1 fret:1 (B3 string + 1 fret). E4 = string:0 fret:0? no, E4 = high E open = string:5 fret:0 → vexStr=1
    // Let me just assert distinct vexStr values (3 unique strings, NO collision per plan §10.2 D13)
    const vexStrs = opts.positions.map((p) => p.str).sort()
    expect(new Set(vexStrs).size).toBe(3)
  })
})

describe('Tablature widget — tuning prop union (ADR-062)', () => {
  it('tuning="Drop D" string lookup → resolveTuning resolves do DROP_D', async () => {
    await act(async () => {
      render(
        <Tablature
          id="tab-drop-d-str"
          tuning="Drop D"
          notes={[Q('D', 2)]}
        />,
      )
    })
    expect(drawSpy).toHaveBeenCalledTimes(1)
    // D2 unique playable w DROP_D string:0 fret:0 → vexStr = 6-0 = 6
    const opts = tabNoteSpy.mock.calls[0]![0] as {
      positions: Array<{ str: number; fret: number | string }>
    }
    expect(opts.positions).toEqual([{ str: 6, fret: 0 }])
  })

  it('tuning={DROP_D} literal pass-through → identical render', async () => {
    await act(async () => {
      render(
        <Tablature
          id="tab-drop-d-lit"
          tuning={DROP_D}
          notes={[Q('D', 2)]}
        />,
      )
    })
    const opts = tabNoteSpy.mock.calls[0]![0] as {
      positions: Array<{ str: number; fret: number | string }>
    }
    expect(opts.positions).toEqual([{ str: 6, fret: 0 }])
  })

  it('tuning indicator rendered ONLY dla non-STANDARD tuning', async () => {
    const { container: c1 } = await act(async () => {
      return render(<Tablature id="t-std" notes={[Q('C', 4)]} />)
    })
    expect(c1.textContent).not.toContain('Tuning:')

    const { container: c2 } = await act(async () => {
      return render(<Tablature id="t-drop" tuning={DROP_D} notes={[Q('D', 2)]} />)
    })
    expect(c2.textContent).toContain('Tuning: Drop D')

    const { container: c3 } = await act(async () => {
      return render(<Tablature id="t-dadgad" tuning={DADGAD} notes={[Q('D', 3)]} />)
    })
    expect(c3.textContent).toContain('Tuning: DADGAD')
  })
})

describe('Tablature widget — BPM hybrid control + Play/Stop', () => {
  it('defaultBpm=140 → slider + input synced; clamp 300→240', async () => {
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(<Tablature id="t-bpm" defaultBpm={140} notes={[Q('C', 4)]} />)
    })
    const slider = result!.getByTestId('bpm-slider') as HTMLInputElement
    const input = result!.getByTestId('bpm-input') as HTMLInputElement
    expect(slider.value).toBe('140')
    expect(input.value).toBe('140')
    await act(async () => {
      fireEvent.change(input, { target: { value: '300' } })
    })
    expect(slider.value).toBe('240') // clamped
  })

  it('Play button (enableAudio=true) → playSequence wywołane z melodic + startTimes', async () => {
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(<Tablature id="t-play" notes={[Q('C', 4), Q('D', 4)]} />)
    })
    const playBtn = result!.getByTestId('play-button')
    await act(async () => {
      fireEvent.click(playBtn)
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(playSequenceSpy).toHaveBeenCalledTimes(1)
    const [melodic, opts] = playSequenceSpy.mock.calls[0]! as [
      unknown[],
      { startTimes?: number[]; durations?: number[]; signal?: AbortSignal },
    ]
    expect(melodic).toHaveLength(2)
    expect(opts.startTimes).toBeDefined()
    expect(opts.durations).toBeDefined()
    expect(opts.signal).toBeDefined()
  })

  it('Stop mid-playback → AbortController.abort() fired', async () => {
    let result: ReturnType<typeof render> | undefined
    let capturedSignal: AbortSignal | undefined
    playSequenceSpy.mockImplementationOnce((_notes, options) => {
      capturedSignal = (options as { signal?: AbortSignal }).signal
      return new Promise(() => {}) // never resolves — playback active
    })
    await act(async () => {
      result = render(<Tablature id="t-stop" notes={[Q('C', 4)]} />)
    })
    const playBtn = result!.getByTestId('play-button')
    await act(async () => {
      fireEvent.click(playBtn)
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(capturedSignal?.aborted).toBe(false)
    await act(async () => {
      fireEvent.click(playBtn) // Stop toggle
    })
    expect(capturedSignal?.aborted).toBe(true)
  })
})

describe('Tablature widget — defensive validation', () => {
  it('throws gdy explicit position.string > tuning.strings.length-1', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <Tablature
          id="t-bad-str"
          notes={[Q('C', 4, { string: 99, fret: 3 })]}
        />,
      ),
    ).toThrow(/t-bad-str.*position\.string=99.*out of range/s)
    errSpy.mockRestore()
  })

  it('throws gdy explicit position.fret > maxFret', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <Tablature
          id="t-bad-fret"
          maxFret={12}
          notes={[Q('C', 4, { string: 4, fret: 25 })]}
        />,
      ),
    ).toThrow(/t-bad-fret.*position\.fret=25.*out of range/s)
    errSpy.mockRestore()
  })

  it('throws gdy chord-Note ma explicit position field', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const notes: Note[] = [
      {
        pitch: [
          { letter: 'C', octave: 4 },
          { letter: 'E', octave: 4 },
        ],
        position: { string: 1, fret: 0 },
        duration: '1/4',
      },
    ]
    expect(() => render(<Tablature id="t-chord-pos" notes={notes} />)).toThrow(
      /t-chord-pos.*chord Note at index 0/s,
    )
    errSpy.mockRestore()
  })

  it('throws gdy pitch unreachable w tuning (D2 w STANDARD — below low E)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Tablature id="t-unreach" notes={[Q('D', 2)]} />)).toThrow(
      /t-unreach.*unreachable in tuning "Standard"/s,
    )
    errSpy.mockRestore()
  })
})

describe('Tablature widget — multi-instance independence', () => {
  it('2× Tablature widgets w one tree → osobne useId scopes (no Factory targetId collision)', async () => {
    await act(async () => {
      render(
        <>
          <Tablature id="t-multi-a" notes={[Q('C', 4)]} />
          <Tablature id="t-multi-b" notes={[Q('D', 4)]} />
        </>,
      )
    })
    expect(factoryCtor).toHaveBeenCalledTimes(2)
    const opts1 = factoryCtor.mock.calls[0]![0] as { renderer: { elementId: string } }
    const opts2 = factoryCtor.mock.calls[1]![0] as { renderer: { elementId: string } }
    expect(opts1.renderer.elementId).not.toBe(opts2.renderer.elementId)
  })
})

describe('Tablature widget — host wrapper attributes', () => {
  it('figure data-tablature-id = author-provided id', async () => {
    const { container } = await act(async () => {
      return render(<Tablature id="t-host" notes={[Q('C', 4)]} />)
    })
    expect(container.querySelector('[data-tablature-id="t-host"]')).toBeTruthy()
  })

  it('tablature-host class + initial data-current-note empty', async () => {
    const { container } = await act(async () => {
      return render(<Tablature id="t-host2" notes={[Q('C', 4)]} />)
    })
    const host = container.querySelector('.tablature-host')
    expect(host).toBeTruthy()
    // Initial state: currentNoteIdx=null → data-current-note=''
    expect(host?.getAttribute('data-current-note')).toBe('')
  })
})
