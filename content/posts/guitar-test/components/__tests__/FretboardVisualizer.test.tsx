// FretboardVisualizer integration tests. Per Decyzja planisty #2 — BEZ `audio.test.ts`;
// audio.ts mocked tutaj (jsdom NIE supportuje Web Audio API). Actual playback tested
// manualnie w smoke check #14. Target ≥80% line coverage FretboardVisualizer.tsx.

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import FretboardVisualizer from '../FretboardVisualizer'

// Mock audio.ts — jsdom NIE ma Web Audio API. Mock asserts wrapper integration,
// nie custom mini-player code path. AudioContext shape unused przez mock playPitchedNote.
vi.mock('../audio', () => ({
  SAMPLE_INSTRUMENT: 'acoustic_guitar_nylon',
  ensureAudio: vi.fn(() => Promise.resolve({} as AudioContext)),
  playPitchedNote: vi.fn(() => Promise.resolve()),
}))

function renderWithTheme(ui: React.ReactNode) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark">{ui}</ThemeProvider>,
  )
}

// Selector strategy: `rect[data-overlay-hit]` distinguishes wrapper's overlay hit-rects
// od base's identyczne 48×48 hit-rects (base też renderuje, dla onPlayNote forwarding).
// Bez tego selektora: (a) count testy double-count, (b) interaction testy klikają base
// rect → wrapper state machine nigdy się nie odpala → false-negative.
const OVERLAY_HIT_SELECTOR = 'rect[data-overlay-hit]'

beforeEach(() => vi.clearAllMocks())

// === Test 1: scale mode renders ≥21 active notes (smoke check #1) ===
describe('FretboardVisualizer — scale mode', () => {
  it('scale={{root:"C",type:"major"}} renders ≥21 active notes', () => {
    const { container } = renderWithTheme(
      <FretboardVisualizer id="c-major-test" scale={{ root: 'C', type: 'major' }} />,
    )
    // C-dur na STANDARD_TUNING fretCount=12 ma ~32 positions. 21 = bezpieczny lower bound.
    const hitAreas = container.querySelectorAll(OVERLAY_HIT_SELECTOR)
    expect(hitAreas.length).toBeGreaterThanOrEqual(21)
  })
})

// === Test 2: chord mode renders D/F/A pitch class labels (smoke check #2) ===
describe('FretboardVisualizer — chord mode', () => {
  it('chord={{root:"D",type:"min"}} contains D, F, A pitch class labels', () => {
    const { container } = renderWithTheme(
      <FretboardVisualizer id="d-min-test" chord={{ root: 'D', type: 'min' }} />,
    )
    const labels = Array.from(container.querySelectorAll('text')).map(t => t.textContent)
    expect(labels).toContain('D')
    expect(labels).toContain('F')
    expect(labels).toContain('A')
  })
})

// === Test 3: notes escape hatch (smoke check #3) ===
describe('FretboardVisualizer — notes mode (escape hatch)', () => {
  it('notes=[{string:0,fret:5},{string:2,fret:7}] renders exactly 2 active notes', () => {
    const { container } = renderWithTheme(
      <FretboardVisualizer
        id="notes-test"
        notes={[{ string: 0, fret: 5 }, { string: 2, fret: 7 }]}
      />,
    )
    const hitAreas = container.querySelectorAll(OVERLAY_HIT_SELECTOR)
    expect(hitAreas.length).toBe(2)
  })
})

// === Test 4: click-to-highlight state machine (smoke checks #4 + #13) ===
describe('FretboardVisualizer — click-to-highlight state machine', () => {
  it('null → click → set → click same → null (toggle)', () => {
    const { container } = renderWithTheme(
      <FretboardVisualizer
        id="toggle-test"
        notes={[{ string: 0, fret: 5 }, { string: 2, fret: 7 }]}
      />,
    )
    expect(container.querySelector('[data-selected="true"]')).toBeNull()
    const firstHit = container.querySelectorAll(OVERLAY_HIT_SELECTOR)[0]
    fireEvent.click(firstHit!)
    // Decyzja #3 wariant (a) assertion shape — SVG ring locked.
    expect(
      container.querySelector('circle[data-selected="true"][stroke-width="3"][fill="none"]'),
    ).not.toBeNull()
    fireEvent.click(firstHit!)
    expect(container.querySelector('[data-selected="true"]')).toBeNull()
  })

  it('click different position → swap selected', () => {
    const { container } = renderWithTheme(
      <FretboardVisualizer
        id="swap-test"
        notes={[{ string: 0, fret: 5 }, { string: 2, fret: 7 }]}
      />,
    )
    const hits = container.querySelectorAll(OVERLAY_HIT_SELECTOR)
    fireEvent.click(hits[0]!)
    const firstSelectedCx = container.querySelector('[data-selected="true"]')?.getAttribute('cx')
    fireEvent.click(hits[1]!)
    const secondSelectedCx = container.querySelector('[data-selected="true"]')?.getAttribute('cx')
    expect(firstSelectedCx).toBeDefined()
    expect(secondSelectedCx).toBeDefined()
    expect(secondSelectedCx).not.toBe(firstSelectedCx)
  })
})

// === Test 5: multi-instance independence (smoke check #6, ADR-011) ===
describe('FretboardVisualizer — multi-instance independence', () => {
  it('4× widgets w jednym DOM zachowują osobny selected state', () => {
    const { container } = renderWithTheme(
      <>
        <FretboardVisualizer id="m1" chord={{ root: 'D', type: 'min' }} />
        <FretboardVisualizer id="m2" chord={{ root: 'A', type: 'min' }} />
        <FretboardVisualizer id="m3" chord={{ root: 'E', type: 'min' }} />
        <FretboardVisualizer id="m4" chord={{ root: 'F', type: 'maj' }} />
      </>,
    )
    const widgets = container.querySelectorAll('[data-fretboard-visualizer-id]')
    expect(widgets.length).toBe(4)
    const firstWidgetHit = widgets[0]!.querySelector(OVERLAY_HIT_SELECTOR)
    fireEvent.click(firstWidgetHit!)
    expect(widgets[0]!.querySelector('[data-selected="true"]')).not.toBeNull()
    expect(widgets[1]!.querySelector('[data-selected="true"]')).toBeNull()
    expect(widgets[2]!.querySelector('[data-selected="true"]')).toBeNull()
    expect(widgets[3]!.querySelector('[data-selected="true"]')).toBeNull()
  })
})

// === Test 6: enableAudio guard (smoke checks #5 + #7) ===
describe('FretboardVisualizer — enableAudio guard', () => {
  it('enableAudio={false} → click NIE wywołuje ensureAudio() ani playPitchedNote()', async () => {
    const audio = await import('../audio')
    const { container } = renderWithTheme(
      <FretboardVisualizer
        id="silent-test"
        notes={[{ string: 0, fret: 5 }]}
        enableAudio={false}
      />,
    )
    const hit = container.querySelector(OVERLAY_HIT_SELECTOR)
    fireEvent.click(hit!)
    expect(audio.ensureAudio).not.toHaveBeenCalled()
    expect(audio.playPitchedNote).not.toHaveBeenCalled()
  })

  it('enableAudio default (undefined) → click DOES wywołać ensureAudio()', async () => {
    const audio = await import('../audio')
    const { container } = renderWithTheme(
      <FretboardVisualizer id="audio-test" notes={[{ string: 0, fret: 5 }]} />,
    )
    // Pre-click assert (smoke #5): ensureAudio NIE called na mount.
    expect(audio.ensureAudio).not.toHaveBeenCalled()
    const hit = container.querySelector(OVERLAY_HIT_SELECTOR)
    fireEvent.click(hit!)
    expect(audio.ensureAudio).toHaveBeenCalledTimes(1)
  })
})

// === Test 7: id propagation (data attribute) ===
describe('FretboardVisualizer — id propagation', () => {
  it('renders data-fretboard-visualizer-id={id}', () => {
    const { container } = renderWithTheme(
      <FretboardVisualizer id="my-widget" scale={{ root: 'G', type: 'major' }} />,
    )
    expect(
      container.querySelector('[data-fretboard-visualizer-id="my-widget"]'),
    ).not.toBeNull()
  })
})
