// NotationLink integration tests per plan §6.3 + §10 (≥10 cases, coverage ≥85% line).
// Mocks LazyNotation + LazyTablature + LazyScaleOnFretboard shallow — focus na multi-slot
// children walking + cloneElement injection + context wiring + mixed-tuning warning.

import React, { useContext } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import NotationLink from '../NotationLink'
import LazyNotation from '@/components/lazy/LazyNotation'
import LazyTablature from '@/components/lazy/LazyTablature'
import LazyScaleOnFretboard from '@/components/lazy/LazyScaleOnFretboard'
import { NotationCursorContext } from '../NotationCursorContext'
import type { Note } from '../types'

// Reused dla mock Tablature/ScaleOnFretboard context subscription (real components
// useContext-subscribe; mocks emulują żeby test verify context propagation działa).
const useNotationCursorMock = () => useContext(NotationCursorContext)

// === Shallow mocks — capture props per render call ===
type NotationMockProps = {
  id: string
  notes: Note[]
  onNoteStart?: (idx: number, scheduledMs: number) => void
  enableAudio?: boolean
  defaultBpm?: number
}
const notationSpy = vi.fn<(props: NotationMockProps) => void>()
vi.mock('@/components/lazy/LazyNotation', () => {
  const Mock = (props: NotationMockProps) => {
    notationSpy(props)
    return <div data-mock-notation="" data-instance-id={props.id} />
  }
  Mock.displayName = 'Notation'
  return { default: Mock }
})

// Helper: last captured Notation mock props (z spy.mock.calls). Replaces module-level
// reassignment pattern (react-hooks/globals rule rejects in-render side effect).
const lastNotationCall = (): NotationMockProps =>
  notationSpy.mock.calls[notationSpy.mock.calls.length - 1]![0]

type TablatureMockProps = {
  id: string
  notes: Note[]
  tuning?: unknown
  enableAudio?: boolean
  showBpmControl?: boolean
}
const tablatureSpy = vi.fn<(props: TablatureMockProps) => void>()
vi.mock('@/components/lazy/LazyTablature', () => {
  const Mock = (props: TablatureMockProps) => {
    tablatureSpy(props)
    // Real Tablature.tsx subscribes via useContext(NotationCursorContext). Mock emuluje
    // żeby context dispatch (master Notation onNoteStart → setCurrentNoteIdx) wymusił
    // re-render passive Tablature consumer (visible via spy.mock.calls.length grow).
    useNotationCursorMock()
    return <div data-mock-tablature="" data-instance-id={props.id} />
  }
  Mock.displayName = 'Tablature'
  return { default: Mock }
})

type ScaleMockProps = {
  id: string
  notes: Note[]
  enableAudio?: boolean
  showBpmControl?: boolean
  rootNote?: string
}
const scaleSpy = vi.fn<(props: ScaleMockProps) => void>()
vi.mock('@/components/lazy/LazyScaleOnFretboard', () => {
  const Mock = (props: ScaleMockProps) => {
    scaleSpy(props)
    return <div data-mock-scale="" data-instance-id={props.id} />
  }
  Mock.displayName = 'ScaleOnFretboard'
  return { default: Mock }
})

beforeEach(() => {
  vi.clearAllMocks()
})

const Q = (letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', octave = 4): Note => ({
  pitch: { letter, octave },
  duration: '1/4',
})

describe('NotationLink — validation throws', () => {
  it('throws gdy zero Notation children (z message zawierającym wrapper id)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <NotationLink id="no-notation" notes={[Q('C')]}>
          <LazyTablature id="t" notes={[Q('C')]} />
        </NotationLink>,
      ),
    ).toThrow(/no-notation.*requires exactly one Notation child/s)
    errSpy.mockRestore()
  })

  it('throws gdy 2+ Notation children (z message zawierającym wrapper id + count)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <NotationLink id="multi-notation" notes={[Q('C')]}>
          <LazyNotation id="n1" notes={[Q('C')]} />
          <LazyNotation id="n2" notes={[Q('C')]} />
        </NotationLink>,
      ),
    ).toThrow(/multi-notation.*Found 2/s)
    errSpy.mockRestore()
  })

  it('throws na chord-on-staff Note (pitch is array) z wrapper id + index', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const notes: Note[] = [
      Q('C'),
      { pitch: [{ letter: 'E', octave: 4 }, { letter: 'G', octave: 4 }], duration: '1/4' },
    ]
    expect(() =>
      render(
        <NotationLink id="chord-bad" notes={notes}>
          <LazyNotation id="n" notes={notes} />
        </NotationLink>,
      ),
    ).toThrow(/chord-bad.*index 1/s)
    errSpy.mockRestore()
  })
})

describe('NotationLink — children walking + cloneElement injection', () => {
  it('multi-passive: Notation + Tablature + ScaleOnFretboard wszystkie 3 receive notes prop', () => {
    const notes: Note[] = [Q('C'), Q('D'), Q('E')]
    render(
      <NotationLink id="multi-passive" notes={notes}>
        <LazyNotation id="n" notes={[]} />
        <LazyTablature id="t" notes={[]} />
        <LazyScaleOnFretboard id="s" notes={[]} rootNote="C" />
      </NotationLink>,
    )
    expect(notationSpy).toHaveBeenCalledTimes(1)
    expect(tablatureSpy).toHaveBeenCalledTimes(1)
    expect(scaleSpy).toHaveBeenCalledTimes(1)
    // Wrapper-injected notes win over child placeholders (cloneElement override).
    expect(notationSpy.mock.calls[0]![0].notes).toBe(notes)
    expect(tablatureSpy.mock.calls[0]![0].notes).toBe(notes)
    expect(scaleSpy.mock.calls[0]![0].notes).toBe(notes)
  })

  it('Notation child receives onNoteStart handler from wrapper', () => {
    render(
      <NotationLink id="master-onstart" notes={[Q('C')]}>
        <LazyNotation id="n" notes={[]} />
      </NotationLink>,
    )
    const np = notationSpy.mock.calls[0]![0]
    expect(typeof np.onNoteStart).toBe('function')
  })

  it('Tablature passive receives enableAudio=false + showBpmControl=false', () => {
    render(
      <NotationLink id="passive-tab" notes={[Q('C')]}>
        <LazyNotation id="n" notes={[]} />
        <LazyTablature id="t" notes={[]} />
      </NotationLink>,
    )
    const tp = tablatureSpy.mock.calls[0]![0]
    expect(tp.enableAudio).toBe(false)
    expect(tp.showBpmControl).toBe(false)
  })

  it('ScaleOnFretboard passive receives enableAudio=false + showBpmControl=false', () => {
    render(
      <NotationLink id="passive-scale" notes={[Q('C')]}>
        <LazyNotation id="n" notes={[]} />
        <LazyScaleOnFretboard id="s" notes={[]} rootNote="C" />
      </NotationLink>,
    )
    const sp = scaleSpy.mock.calls[0]![0]
    expect(sp.enableAudio).toBe(false)
    expect(sp.showBpmControl).toBe(false)
  })

  it('author-provided ids na children pass through (NIE wrapper override)', () => {
    render(
      <NotationLink id="wrap" notes={[Q('C')]}>
        <LazyNotation id="custom-notation-id" notes={[]} />
        <LazyTablature id="custom-tab-id" notes={[]} />
      </NotationLink>,
    )
    expect(notationSpy.mock.calls[0]![0].id).toBe('custom-notation-id')
    expect(tablatureSpy.mock.calls[0]![0].id).toBe('custom-tab-id')
  })

  it('wrapper renders z data-notation-link-id attribute na root div', () => {
    const { container } = render(
      <NotationLink id="root-attr" notes={[Q('C')]}>
        <LazyNotation id="n" notes={[]} />
      </NotationLink>,
    )
    expect(container.querySelector('[data-notation-link-id="root-attr"]')).toBeTruthy()
  })
})

describe('NotationLink — context wiring (Pattern C cursor dispatch)', () => {
  it('onNoteStart fires → context cursor state propagates do passive Tablature consumer', () => {
    render(
      <NotationLink id="dispatch" notes={[Q('C'), Q('D'), Q('E')]}>
        <LazyNotation id="n" notes={[]} />
        <LazyTablature id="t" notes={[]} />
      </NotationLink>,
    )
    expect(notationSpy).toHaveBeenCalledTimes(1)
    expect(tablatureSpy).toHaveBeenCalledTimes(1)
    const initialTabCalls = tablatureSpy.mock.calls.length

    act(() => {
      lastNotationCall().onNoteStart!(1, 500)
    })
    // Tablature mock subscribes context → context value change wymusza re-render →
    // tablatureSpy invoked again. Pattern matches shipped NotationScaleLink.test.tsx case 7.
    expect(tablatureSpy.mock.calls.length).toBeGreaterThan(initialTabCalls)
  })
})

describe('NotationLink — multi-instance independence', () => {
  it('2× NotationLink wrappers w one tree → osobne context state (no leakage)', () => {
    const notesA: Note[] = [Q('C'), Q('D')]
    const notesB: Note[] = [Q('E'), Q('F')]
    const { container } = render(
      <>
        <NotationLink id="wrap-a" notes={notesA}>
          <LazyNotation id="na" notes={[]} />
        </NotationLink>
        <NotationLink id="wrap-b" notes={notesB}>
          <LazyNotation id="nb" notes={[]} />
        </NotationLink>
      </>,
    )
    expect(container.querySelector('[data-notation-link-id="wrap-a"]')).toBeTruthy()
    expect(container.querySelector('[data-notation-link-id="wrap-b"]')).toBeTruthy()
    expect(notationSpy).toHaveBeenCalledTimes(2)
    const calls = notationSpy.mock.calls
    const aNotes = calls.find((c) => c[0].id === 'na')?.[0].notes
    const bNotes = calls.find((c) => c[0].id === 'nb')?.[0].notes
    expect(aNotes).toBe(notesA)
    expect(bNotes).toBe(notesB)
    expect(aNotes).not.toBe(bNotes)
  })
})

describe('NotationLink — mixed-tuning warning (ADR-062 §4.4)', () => {
  it('Tablature z tuning="Drop D" + Notation present → console.warn fires', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <NotationLink id="mixed-warn" notes={[Q('C')]}>
        <LazyNotation id="n" notes={[]} />
        <LazyTablature id="t" notes={[]} tuning="Drop D" />
      </NotationLink>,
    )
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const warnMsg = warnSpy.mock.calls[0]![0] as string
    expect(warnMsg).toMatch(/mixed-warn/)
    expect(warnMsg).toMatch(/Drop D/)
    warnSpy.mockRestore()
  })

  it('Tablature z STANDARD_TUNING (no tuning prop) + Notation → ZERO warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <NotationLink id="no-warn" notes={[Q('C')]}>
        <LazyNotation id="n" notes={[]} />
        <LazyTablature id="t" notes={[]} />
      </NotationLink>,
    )
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('NotationLink — defaultBpm propagation', () => {
  it('defaultBpm prop forwards do Notation child (gdy child nie ma własnego)', () => {
    render(
      <NotationLink id="bpm" notes={[Q('C')]} defaultBpm={140}>
        <LazyNotation id="n" notes={[]} />
      </NotationLink>,
    )
    expect(notationSpy.mock.calls[0]![0].defaultBpm).toBe(140)
  })

  it('author-provided defaultBpm na Notation child wins over wrapper defaultBpm', () => {
    render(
      <NotationLink id="bpm-override" notes={[Q('C')]} defaultBpm={140}>
        <LazyNotation id="n" notes={[]} defaultBpm={60} />
      </NotationLink>,
    )
    expect(notationSpy.mock.calls[0]![0].defaultBpm).toBe(60)
  })
})
