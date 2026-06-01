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

// === v5-14: intervals accordion + Play chord + labelMode (plan §3.8) ===
// jsdom <details> pattern: preferowane fireEvent.click(summary) → details.open=true
// (verified empirycznie podczas FretboardVisualizer test runa; pinned dla całego v5-14).

vi.mock('../audio-sequence', () => ({
  playSequence: vi.fn(() => Promise.resolve()),
}))

describe('ChordAnalyzer — v5-14 accordion render', () => {
  it('renders <details> collapsed by default', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="ca-acc-1" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details?.open).toBe(false)
  })

  it('expanded accordion shows notes + intervals + chord name + Play button', () => {
    const { container, getByText, getByTestId } = renderWithTheme(
      <ChordAnalyzer id="ca-acc-2" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    fireEvent.click(getByText('Show intervals'))
    expect(getByTestId('notes-row').textContent).toContain('C')
    expect(getByTestId('notes-row').textContent).toContain('E')
    expect(getByTestId('notes-row').textContent).toContain('G')
    expect(getByTestId('intervals-row').textContent).toContain('R')
    expect(getByTestId('detected-name-row').textContent).toMatch(/C\s*maj/)
    expect(container.querySelector('[data-testid="play-chord-button"]')).not.toBeNull()
  })
})

describe('ChordAnalyzer — v5-14 Play chord button', () => {
  it('click Play chord → playSequence called z chord notes + interval=0', async () => {
    const audioSeq = await import('../audio-sequence')
    const { container, getByText } = renderWithTheme(
      <ChordAnalyzer id="ca-play-1" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    fireEvent.click(getByText('Show intervals'))
    const playBtn = container.querySelector('[data-testid="play-chord-button"]')!
    fireEvent.click(playBtn)
    await Promise.resolve()
    expect(audioSeq.playSequence).toHaveBeenCalledTimes(1)
    const [notesArg, optionsArg] = vi.mocked(audioSeq.playSequence).mock.calls[0]!
    expect(notesArg.length).toBe(5)   // C maj open voicing = 5 active notes
    expect(optionsArg).toEqual({ interval: 0 })
  })

  it('enableAudio={false} → Play button hidden w accordion', () => {
    const { container, getByText } = renderWithTheme(
      <ChordAnalyzer id="ca-play-2" shape={[null, 3, 2, 0, 1, 0]} enableAudio={false} />,
    )
    fireEvent.click(getByText('Show intervals'))
    const playButton = container.querySelector('[data-testid="play-chord-button"]')
    expect(playButton).toBeNull()
  })
})

describe('ChordAnalyzer — v5-14 v5-13 regression preservation', () => {
  it('v5-13 inline degrees-list badges still rendered (showDegrees default true)', () => {
    const { getByTestId } = renderWithTheme(
      <ChordAnalyzer id="ca-reg-1" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    expect(getByTestId('degrees-list')).not.toBeNull()
    const items = getByTestId('degrees-list').querySelectorAll('li')
    expect(items.length).toBeGreaterThan(0)
  })
})

describe('ChordAnalyzer — v5-14 secondary reading w accordion', () => {
  it('ambiguous Cadd9 voicing → DetectedNameRow zawiera "Other reading"', () => {
    const { container, getByText, getByTestId } = renderWithTheme(
      <ChordAnalyzer id="ca-sec-1" shape={[null, 3, 2, 0, 3, 3]} />,
    )
    // Sprawdź czy primary jest add9 (per v5-13 Sesja 20 deviation #1 voicing)
    const chordName = container.querySelector('[data-testid="chord-name"]')?.textContent ?? ''
    // Niezależnie od dokładnej formy primary, accordion DetectedNameRow musi pokazać secondary
    fireEvent.click(getByText('Show intervals'))
    const nameRow = getByTestId('detected-name-row')
    // Per plan §3.8 Test #6: secondary reading present when Δ<0.2
    expect(nameRow.textContent).toMatch(/Other reading/)
    // Primary z chord-name UI matches accordion primary
    if (chordName) {
      expect(nameRow.textContent).toContain(chordName.split(' ')[0]!)
    }
  })
})

describe('ChordAnalyzer — v5-14 orthogonal labelMode × showDegrees (plan §3.8 #7-10)', () => {
  it('State A: labelMode="note" + showDegrees=true (defaults) → notes na fretboard + badges visible', () => {
    const { container, getByTestId } = renderWithTheme(
      <ChordAnalyzer id="ca-ortho-A" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    const svgText = container.querySelector('svg')?.textContent ?? ''
    expect(svgText).not.toMatch(/R/)   // note mode (no R degree label)
    expect(getByTestId('degrees-list')).not.toBeNull()
  })

  it('State B: labelMode="note" + showDegrees=false → notes na fretboard + badges hidden', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="ca-ortho-B" shape={[null, 3, 2, 0, 1, 0]} showDegrees={false} />,
    )
    const svgText = container.querySelector('svg')?.textContent ?? ''
    expect(svgText).not.toMatch(/R/)
    expect(container.querySelector('[data-testid="degrees-list"]')).toBeNull()
  })

  it('State C: labelMode="degree" + showDegrees=true → degrees na fretboard + badges visible', () => {
    const { container, getByTestId } = renderWithTheme(
      <ChordAnalyzer id="ca-ortho-C" shape={[null, 3, 2, 0, 1, 0]} labelMode="degree" />,
    )
    const svgText = container.querySelector('svg')?.textContent ?? ''
    expect(svgText).toMatch(/R/)
    expect(getByTestId('degrees-list')).not.toBeNull()
  })

  it('State D: labelMode="degree" + showDegrees=false → degrees na fretboard + badges hidden', () => {
    const { container } = renderWithTheme(
      <ChordAnalyzer id="ca-ortho-D" shape={[null, 3, 2, 0, 1, 0]} labelMode="degree" showDegrees={false} />,
    )
    const svgText = container.querySelector('svg')?.textContent ?? ''
    expect(svgText).toMatch(/R/)
    expect(container.querySelector('[data-testid="degrees-list"]')).toBeNull()
  })
})

describe('ChordAnalyzer — v5-14 degree toggle button', () => {
  it('click "Show degrees" → labelMode switches to degree (fretboard text changes)', () => {
    const { container, getByText } = renderWithTheme(
      <ChordAnalyzer id="ca-tog-1" shape={[null, 3, 2, 0, 1, 0]} />,
    )
    expect(getByText('Show degrees')).not.toBeNull()
    fireEvent.click(getByText('Show degrees'))
    expect(getByText('Show notes')).not.toBeNull()
    const svgText = container.querySelector('svg')?.textContent ?? ''
    expect(svgText).toMatch(/R/)
  })
})
