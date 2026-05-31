// ChordAnalyzer integration tests — vitest + @testing-library/react.
// HARD CONSTRAINT (v5-11 precedens FretboardVisualizer.test.tsx): mock `../audio` module
// (jsdom NIE supportuje Web Audio API). Pure math (detectChord/spellChordDegrees) NIE
// mockowane per hard rule #2 — testowane bezpośrednio w music-theory.test.ts.
//
// UC3 voicing deviation z task.md/plan: task.md UC3 użyło `[null,3,2,0,1,3]` z prose
// "Cadd9/Am7-no-root ambiguity", ale pitch class analysis pokazuje {C,E,G} only (string
// 4 fret 1 = C, string 5 fret 3 = G — brak D). Test używa `[null,3,2,0,3,3]` (canonical
// Cadd9 z prawdziwym D na B string fret 3) → Δ<0.2 triggers. UC4 deviation analogiczna:
// task.md/plan `[null,null,null,5,7,7]` w Standard tuning daje {C,F#,B} (string 3=G+5=C,
// string 4=B+7=F#, string 5=e+7=B), NIE A5. Test używa `[null,null,null,2,5,5]` (G+2=A,
// B+5=E, e+5=A) = {A,E} → "A 5" correct.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import ChordAnalyzer from '../ChordAnalyzer'

vi.mock('../audio', () => ({
  SAMPLE_INSTRUMENT: 'acoustic_guitar_nylon',
  ensureAudio: vi.fn(() => Promise.resolve({} as unknown as AudioContext)),
  playPitchedNote: vi.fn(() => Promise.resolve()),
}))

function renderWithTheme(ui: ReactNode) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark">{ui}</ThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ChordAnalyzer — shape array shorthand', () => {
  it('shape={[null,3,2,0,1,0]} renders 5 active hit-rects + 1 muted × glyph (string 0)', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="open-c-shorthand" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    const hitAreas = container.querySelectorAll('rect[data-overlay-hit]')
    expect(hitAreas.length).toBe(5)
    expect(container.querySelector('[data-testid="muted-glyph-string-0"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="muted-glyph-string-1"]')).toBeNull()
  })
})

describe('ChordAnalyzer — chord preset load', () => {
  it('chord={{root:"C",type:"maj"}} loads CHORD_SHAPES["C-maj"] → identyczny output jak shape shorthand', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="open-c-preset" chord={{ root: 'C', type: 'maj' }} />,
    )
    const hitAreas = container.querySelectorAll('rect[data-overlay-hit]')
    expect(hitAreas.length).toBe(5)
    expect(container.querySelector('[data-testid="muted-glyph-string-0"]')).toBeTruthy()
  })
})

describe('ChordAnalyzer — chord name display', () => {
  it('open C voicing → chord name "C maj" + confidence "high" + numeric ≥0.90', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="name-test" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    expect(container.querySelector('[data-testid="chord-name"]')?.textContent).toBe('C maj')
    expect(container.querySelector('[data-testid="confidence-label"]')?.textContent).toBe('high')
    const numericText = container.querySelector('[data-testid="confidence-numeric"]')?.textContent ?? '0'
    expect(parseFloat(numericText)).toBeGreaterThanOrEqual(0.9)
  })
})

describe('ChordAnalyzer — slash chord composition', () => {
  it('rootStringIndex:1 (bass=C=root) → NO slash, name "C maj"', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer
        id="not-slash"
        shape={{ frets: [null, 3, 2, 0, 1, 0], rootStringIndex: 1 }}
      />,
    )
    expect(container.querySelector('[data-testid="chord-name"]')?.textContent).toBe('C maj')
  })

  it('rootStringIndex:2 (bass=E ≠ root C) → slash "C/E" ("maj" suffix stripped)', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer
        id="slash-c-over-e"
        shape={{ frets: [null, 3, 2, 0, 1, 0], rootStringIndex: 2 }}
      />,
    )
    expect(container.querySelector('[data-testid="chord-name"]')?.textContent).toBe('C/E')
  })
})

describe('ChordAnalyzer — degrees breakdown', () => {
  it('open C voicing → degrees list [R, 3, 5]', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="degrees-test" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    const items = container.querySelectorAll('[data-testid="degrees-list"] li')
    const degrees = Array.from(items).map(li => li.textContent)
    expect(degrees).toEqual(['R', '3', '5'])
  })

  it('showDegrees={false} → brak degrees list rendering', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="no-degrees" shape={[null, 3, 2, 0, 1, 0]} showDegrees={false} />,
    )
    expect(container.querySelector('[data-testid="degrees-list"]')).toBeNull()
  })
})

describe('ChordAnalyzer — A5 power chord muted-heavy (UC4 voicing)', () => {
  it('shape={[null,null,null,2,5,5]} → 3 muted glyphs (strings 0,1,2) + 3 active + name "A 5"', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="a5-power" shape={[null, null, null, 2, 5, 5]} />,
    )
    expect(container.querySelector('[data-testid="muted-glyph-string-0"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="muted-glyph-string-1"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="muted-glyph-string-2"]')).toBeTruthy()
    const hitAreas = container.querySelectorAll('rect[data-overlay-hit]')
    expect(hitAreas.length).toBe(3)
    expect(container.querySelector('[data-testid="chord-name"]')?.textContent).toBe('A 5')
  })
})

describe('ChordAnalyzer — ambiguous voicing multi-reading (UC3 Cadd9)', () => {
  it('shape={[null,3,2,0,3,3]} (Cadd9) → primary "C add9" + secondary "C maj" (Δ<0.2 trigger)', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="ambiguous" shape={[null, 3, 2, 0, 3, 3]} />,
    )
    expect(container.querySelector('[data-testid="chord-name"]')?.textContent).toBe('C add9')
    expect(container.querySelector('[data-testid="secondary-name"]')?.textContent).toBe('C maj')
  })
})

describe('ChordAnalyzer — no-match handling (ADR-034 inline message)', () => {
  it('all-muted shape → "Unrecognized chord" inline (NO modal per ADR-034)', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer
        id="all-muted"
        shape={[null, null, null, null, null, null]}
      />,
    )
    expect(container.querySelector('[data-testid="chord-name"]')).toBeNull()
    expect(container.querySelector('[data-testid="unrecognized-message"]')?.textContent)
      .toBe('Unrecognized chord')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('ChordAnalyzer — click-to-select + audio playback', () => {
  it('click hit-rect → selected ring + ensureAudio + playPitchedNote called', async () => {
    const audio = await import('../audio')
    const { container } = renderWithTheme(
      <ChordAnalyzer id="click-test" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    expect(container.querySelector('[data-selected="true"]')).toBeNull()
    const firstHit = container.querySelector('rect[data-overlay-hit]')!
    fireEvent.click(firstHit)
    // Flush microtask — `.then(playPitchedNote)` w handlerze odpala się po resolve mocku.
    await Promise.resolve()
    expect(container.querySelector('circle[data-selected="true"]')).toBeTruthy()
    expect(audio.ensureAudio).toHaveBeenCalledTimes(1)
    expect(audio.playPitchedNote).toHaveBeenCalledTimes(1)
  })

  it('click na tej samej hit-rect ponownie → toggle null (no selected ring)', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="toggle-test" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    const firstHit = container.querySelector('rect[data-overlay-hit]')!
    fireEvent.click(firstHit)
    expect(container.querySelector('[data-selected="true"]')).toBeTruthy()
    fireEvent.click(firstHit)
    expect(container.querySelector('[data-selected="true"]')).toBeNull()
  })
})

describe('ChordAnalyzer — multi-instance independence (ADR-011)', () => {
  it('4× widgets w jednym DOM zachowują osobny selected state', () => {
    const { container } = renderWithTheme(
      <>
        <ChordAnalyzer id="m1" shape={[null, 3, 2, 0, 1, 0]} />
        <ChordAnalyzer id="m2" chord={{ root: 'A', type: 'min' }} />
        <ChordAnalyzer id="m3" chord={{ root: 'G', type: 'maj' }} />
        <ChordAnalyzer id="m4" shape={[null, null, null, 2, 5, 5]} />
      </>,
    )
    const widgets = container.querySelectorAll('[data-chord-analyzer-id]')
    expect(widgets.length).toBe(4)
    const w1Hit = widgets[0]!.querySelector('rect[data-overlay-hit]')!
    fireEvent.click(w1Hit)
    expect(widgets[0]!.querySelector('[data-selected="true"]')).toBeTruthy()
    expect(widgets[1]!.querySelector('[data-selected="true"]')).toBeNull()
    expect(widgets[2]!.querySelector('[data-selected="true"]')).toBeNull()
    expect(widgets[3]!.querySelector('[data-selected="true"]')).toBeNull()
  })
})

describe('ChordAnalyzer — enableAudio guard', () => {
  it('enableAudio={false} → click NIE wywołuje ensureAudio() ani playPitchedNote()', async () => {
    const audio = await import('../audio')
    const { container } = renderWithTheme(
      <ChordAnalyzer id="silent" shape={[null, 3, 2, 0, 1, 0]} enableAudio={false} />,
    )
    const hit = container.querySelector('rect[data-overlay-hit]')!
    fireEvent.click(hit)
    expect(audio.ensureAudio).not.toHaveBeenCalled()
    expect(audio.playPitchedNote).not.toHaveBeenCalled()
  })
})
