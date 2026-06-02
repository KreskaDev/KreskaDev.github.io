// NotationScaleLink integration tests per plan §3.6 (≥6 cases, coverage ≥85% line).
// Mocks LazyNotation + LazyScaleOnFretboard shallow — focus na Pattern C context
// wiring (onNoteStart → context dispatch → ScaleOnFretboard cursor prop / context).

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import NotationScaleLink from '../NotationScaleLink'
import type { Note } from '../types'

// === LazyNotation shallow mock — capture props + simulate onNoteStart firing ===
type NotationMockProps = {
  id: string
  notes: Note[]
  onNoteStart?: (idx: number, scheduledMs: number) => void
  enableAudio?: boolean
  defaultBpm?: number
}
const notationSpy = vi.fn<(props: NotationMockProps) => void>()
let lastNotationProps: NotationMockProps | undefined
vi.mock('@/components/lazy/LazyNotation', () => ({
  default: (props: NotationMockProps) => {
    notationSpy(props)
    lastNotationProps = props
    return <div data-mock-notation="" data-instance-id={props.id} />
  },
}))

// === LazyScaleOnFretboard shallow mock — capture props ===
type ScaleMockProps = {
  id: string
  notes: Note[]
  enableAudio?: boolean
  showBpmControl?: boolean
  rootNote?: string
}
const scaleSpy = vi.fn<(props: ScaleMockProps) => void>()
vi.mock('@/components/lazy/LazyScaleOnFretboard', () => ({
  default: (props: ScaleMockProps) => {
    scaleSpy(props)
    return <div data-mock-scale="" data-instance-id={props.id} />
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  lastNotationProps = undefined
})

const Q = (letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', octave = 4): Note =>
  ({ pitch: { letter, octave }, duration: '1/4' })

describe('NotationScaleLink — render', () => {
  it('renders both LazyNotation + LazyScaleOnFretboard children w wrapper', () => {
    const notes: Note[] = [Q('C'), Q('D'), Q('E')]
    const { container } = render(
      <NotationScaleLink id="link-basic" notes={notes} rootNote="C" />,
    )
    expect(notationSpy).toHaveBeenCalledTimes(1)
    expect(scaleSpy).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-notation-scale-link-id="link-basic"]')).toBeTruthy()
    expect(container.querySelector('[data-mock-notation]')).toBeTruthy()
    expect(container.querySelector('[data-mock-scale]')).toBeTruthy()
  })

  it('passes notes prop identycznie do obu children (Pattern C single source of truth)', () => {
    const notes: Note[] = [Q('C'), Q('D'), Q('E'), Q('F')]
    render(<NotationScaleLink id="link-notes" notes={notes} rootNote="C" />)
    const notationProps = notationSpy.mock.calls[0]![0]
    const scaleProps = scaleSpy.mock.calls[0]![0]
    expect(notationProps.notes).toBe(scaleProps.notes) // reference-equality (single ref dla obu)
    expect(notationProps.notes).toHaveLength(4)
  })

  it('child ids derived z wrapper id (-notation / -fretboard suffix)', () => {
    render(<NotationScaleLink id="wrap" notes={[Q('C')]} rootNote="C" />)
    const notationProps = notationSpy.mock.calls[0]![0]
    const scaleProps = scaleSpy.mock.calls[0]![0]
    expect(notationProps.id).toBe('wrap-notation')
    expect(scaleProps.id).toBe('wrap-fretboard')
  })
})

describe('NotationScaleLink — master/passive convention (ADR-059)', () => {
  it('ScaleOnFretboard receives enableAudio=false + showBpmControl=false (passive listener)', () => {
    render(<NotationScaleLink id="link-passive" notes={[Q('C')]} rootNote="C" />)
    const scaleProps = scaleSpy.mock.calls[0]![0]
    expect(scaleProps.enableAudio).toBe(false)
    expect(scaleProps.showBpmControl).toBe(false)
  })

  it('Notation receives onNoteStart callback (master fires per-note → context dispatch)', () => {
    render(<NotationScaleLink id="link-master" notes={[Q('C')]} rootNote="C" />)
    const notationProps = notationSpy.mock.calls[0]![0]
    expect(typeof notationProps.onNoteStart).toBe('function')
  })

  it('Notation receives defaultBpm + enableAudio forwarded z wrapper props', () => {
    render(
      <NotationScaleLink
        id="link-forward"
        notes={[Q('C')]}
        rootNote="C"
        defaultBpm={140}
        enableAudio={true}
      />,
    )
    const notationProps = notationSpy.mock.calls[0]![0]
    expect(notationProps.defaultBpm).toBe(140)
    expect(notationProps.enableAudio).toBe(true)
  })
})

describe('NotationScaleLink — context wiring (Pattern C cursor dispatch)', () => {
  it('Notation onNoteStart fires → ScaleOnFretboard mock re-renderuje z updated cursor (context dispatch)', () => {
    const notes: Note[] = [Q('C'), Q('D'), Q('E')]
    render(<NotationScaleLink id="link-dispatch" notes={notes} rootNote="C" />)
    expect(notationSpy).toHaveBeenCalledTimes(1)
    const initialScaleCalls = scaleSpy.mock.calls.length

    // Fire notation onNoteStart — wrapper context cursor state updates
    act(() => {
      lastNotationProps!.onNoteStart!(1, 500)
    })

    // ScaleOnFretboard subscribed do cursor context → re-renders po dispatch
    expect(scaleSpy.mock.calls.length).toBeGreaterThan(initialScaleCalls)
  })
})

describe('NotationScaleLink — multi-instance independence', () => {
  it('2× NotationScaleLink wrappers w one tree → osobne context state (no leakage)', () => {
    const notesA: Note[] = [Q('C'), Q('D')]
    const notesB: Note[] = [Q('E'), Q('F')]

    const { container } = render(
      <>
        <NotationScaleLink id="multi-a" notes={notesA} rootNote="C" />
        <NotationScaleLink id="multi-b" notes={notesB} rootNote="E" />
      </>,
    )

    // 2 wrapper divs widoczne
    expect(container.querySelector('[data-notation-scale-link-id="multi-a"]')).toBeTruthy()
    expect(container.querySelector('[data-notation-scale-link-id="multi-b"]')).toBeTruthy()

    // 2 Notation + 2 ScaleOnFretboard children
    expect(notationSpy).toHaveBeenCalledTimes(2)
    expect(scaleSpy).toHaveBeenCalledTimes(2)

    // Each wrapper passes its own notes (zero leakage)
    const calls = notationSpy.mock.calls
    const aNotes = calls.find(c => c[0].id === 'multi-a-notation')?.[0].notes
    const bNotes = calls.find(c => c[0].id === 'multi-b-notation')?.[0].notes
    expect(aNotes).toBe(notesA)
    expect(bNotes).toBe(notesB)
    expect(aNotes).not.toBe(bNotes)
  })
})

describe('NotationScaleLink — defensive validation', () => {
  it('throws na chord-on-staff Note z message zawierającym wrapper id + index', () => {
    const notes: Note[] = [
      Q('C'),
      {
        pitch: [
          { letter: 'E', octave: 4 },
          { letter: 'G', octave: 4 },
        ],
        duration: '1/4',
      },
    ]
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(<NotationScaleLink id="bad-wrap-XYZ" notes={notes} rootNote="C" />),
    ).toThrow(/bad-wrap-XYZ.*index 1/s)
    errSpy.mockRestore()
  })

  it('empty Note[] renderuje OK (zero validation throw — empty array valid)', () => {
    expect(() =>
      render(<NotationScaleLink id="empty" notes={[]} rootNote="C" />),
    ).not.toThrow()
    expect(notationSpy).toHaveBeenCalledTimes(1)
    expect(scaleSpy).toHaveBeenCalledTimes(1)
  })
})
