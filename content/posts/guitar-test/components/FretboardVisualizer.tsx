'use client'

// FretboardVisualizer — intelligent wrapper nad bazowym Fretboard (v5-09).
// (a) Discriminated union props scale|chord|notes, (b) on-the-fly note generator via
// shipped music-theory pure functions (zero static presets), (c) click-to-highlight
// state machine z overlay SVG sibling (base immutable; base.onPlayNote forwarduje tylko
// PitchedNote → multi-octave collision possible → wrapper przejmuje click control),
// (d) audio playback przez custom Web Audio mini-player (audio.ts, zero npm deps).
// Per ADR-042 (audio architecture) + ADR-011 (React local state per-instance).

import { useMemo, useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import type {
  NoteName, FretPosition, FretboardNote, IntervalName,
  ScaleSpec, ChordSpec, Tuning, PitchedNote,
} from './types'
import { DEFAULT_FRET_COUNT } from './types'
import {
  scaleNotes, chordNotes, positionsOfNote, noteAtPosition, STANDARD_TUNING,
  intervalBetween, spellChordDegrees,
} from './music-theory'
import Fretboard from './Fretboard'
import { ensureAudio, playPitchedNote } from './audio'
import { NotesRow, IntervalsRow, DetectedNameRow } from './accordion-rows'

// v5-14 labelMode — wrapper-API enum, NIE shared do types.ts dopóki v5-16 notation
// wprowadza cross-component shared. ChordAnalyzer ma własny identyczny lokalny type.
type LabelMode = 'note' | 'degree'

// === FretboardVisualizer props (discriminated union — task.md §"Kontekst" wzór) ===

type SharedProps = {
  id: string                              // REQUIRED, symmetric z base (D11.4 v5-09)
  tuning?: Tuning                         // default STANDARD_TUNING
  fretCount?: number                      // default DEFAULT_FRET_COUNT (12)
  enableAudio?: boolean                   // default true (Pre-confirmed #3)
  labelMode?: LabelMode                   // v5-14, default 'note' (Pre-confirmed #4)
}

export type FretboardVisualizerProps = SharedProps & (
  | { scale: ScaleSpec; chord?: never; notes?: never }
  | {
      /**
       * Akord jako ABSTRACT PITCH-CLASS DISPLAY — wrapper rozkłada wszystkie
       * pozycje pitch classes na gryfie (np. {root:'C',type:'maj'} → wszystkie C/E/G).
       * To RÓŻNA semantyka niż `chord` w przyszłym ChordAnalyzer (v5-12) gdzie ten
       * sam ChordSpec ładuje konkretny preset shape voicing (np. open C voicing
       * x32010). Identyczny shape typu, różny intent. Patrz design doc sekcja 7+8+15
       * decyzja #10.
       */
      chord: ChordSpec; scale?: never; notes?: never
    }
  | { notes: FretPosition[]; scale?: never; chord?: never }
)

// === Geometry MIRROR z Fretboard.tsx:48-50,94-99. ===
// Source of truth: prod/content/posts/guitar-test/components/Fretboard.tsx.
// Drift risk (Risk #3): jeśli base geometry zmieni się w future, wrapper overlay
// nie alignuje position-by-position. Mitigation: manual smoke po każdej v5-NN
// touching base. Reason for MIRROR (nie shared import): base Fretboard NIE eksportuje
// geometry constants — wymagałoby modyfikacji base (hard constraint immutable).
//
// `padding.left = 40` MIRROR safe: wrapper NIE exposuje `showStringLabels` →
// base zawsze defaults true → padding.left zawsze 40. Drift today: nie ma.
const FRET_WIDTH = 56
const STRING_HEIGHT = 28
const NUT_WIDTH = 8
const PADDING = { top: 28, right: 16, bottom: 28, left: 40 }

// MIRROR z ADR-037 root color tokens (jedyne hex potrzebne overlay'owi).
// SVG stroke/fill NIE supportuje CSS var reliably cross-browser → inline hex
// (precedens: BayesAnalyzer.tsx + Fretboard.tsx COLORS).
const OVERLAY_COLORS = {
  light: { selectedRing: '#8B2635' },   // burgundy (= ADR-037 root light)
  dark:  { selectedRing: '#D97785' },   // burgundy dark
} as const

type SelectedOverlayProps = {
  positions: FretboardNote[]
  selectedPos: FretPosition | null
  tuning: Tuning
  fretCount: number
  resolvedTheme: string | undefined
  mounted: boolean
  onNoteClick: (pos: FretPosition, pitched: PitchedNote) => void
}

function SelectedOverlay({
  positions, selectedPos, tuning, fretCount,
  resolvedTheme, mounted, onNoteClick,
}: SelectedOverlayProps) {
  const palette = mounted && resolvedTheme === 'dark' ? OVERLAY_COLORS.dark : OVERLAY_COLORS.light
  const stringCount = tuning.strings.length
  const innerWidth = NUT_WIDTH + FRET_WIDTH * fretCount
  const innerHeight = STRING_HEIGHT * (stringCount - 1)
  const svgWidth = innerWidth + PADDING.left + PADDING.right
  const svgHeight = innerHeight + PADDING.top + PADDING.bottom

  // MIRROR formula z Fretboard.tsx:105-110. Open-string center (fret=0) NIE używa
  // FRET_WIDTH arithmetic — circle siedzi LEFT od nut (`x = padding.left - 12`).
  // Risk #20: misalign tu = open C/G w UC1 i open E w UC2 prog-em nie reagują.
  const noteCenter = (pos: FretPosition) => ({
    x: pos.fret === 0
      ? PADDING.left + NUT_WIDTH / 2 - 16
      : PADDING.left + NUT_WIDTH + (pos.fret - 0.5) * FRET_WIDTH,
    y: PADDING.top + (stringCount - 1 - pos.string) * STRING_HEIGHT,
  })

  return (
    <svg
      aria-hidden="true"
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      // Pozycjonowanie top-0 left-0 relative do inner div (siblings z base SVG).
      // Base SVG i overlay SVG mają identyczny width/height/viewBox → idealne pokrycie.
      // Wcześniejszy `top-6` zakładał że base SVG jest 24px od wrapper-top (przez my-6
      // na base outer div) — nieprawda przez margin-collapse: my-6 collapsował UP do
      // wrappera, base SVG siedział na top=0 wrapper-content → overlay top-6 = 24px
      // za nisko, hit-rects 24px niżej niż visible note circles, rings drawn off-grid.
      // Fix: neutralizujemy base outer div via [&>div[data-fretboard-id]]:contents
      // (parent inner div), base SVG staje się direct child, overlay top-0 = match.
      className="absolute top-0 left-0 block pointer-events-none"
    >
      {/* Hit areas — 48×STRING_HEIGHT (48×28) invisible rects, pointer-events auto.
          Height = STRING_HEIGHT exactly: eliminuje 20px vertical overlap zone między
          hit-rectami sąsiadujących strun (oryginalne 48×48 dawało 20px overlap, w którym
          later-rendered rect w DOM wygrywał click → user click na visible "D" circle
          na string 1 fret 5 mógł trafić w dolne pół-circle gdzie A2 hit-rect z string
          0 fret 5 też pokrywał → A2 wins per render order → wrong-string sound).
          Tap target 48×28: width 48 OK (FRET_WIDTH=56 → 8px gap między adjacent fret
          hit-rects, no horizontal overlap), height 28 < 44px hard rule #6 mobile spec
          BUT compounded by immutable base STRING_HEIGHT=28 (v5-09 shipped, plan §3.1
          hard constraint — base Fretboard NIE może być modyfikowany; vertical tap target
          nie może być większy niż fizyczny string spacing bez wprowadzania overlap).
          Precedent: TagFilter chips ~32px (CLAUDE.md hard rule #6 parenthetical exception
          dla compact patterns). Width 48 zostaje dla horizontal precision per fret.
          Regression guard: __tests__ "hit-rect vertical no-overlap invariant" asserts
          adjacent string hit-rects mają non-overlapping y ranges — łapie regression
          jeśli ktoś zmieni height z powrotem na 48.
          data-overlay-hit marker distinguishes overlay rects od base's identyczne 48×48
          hit-rects — selektor `rect[data-overlay-hit]` targetuje wyłącznie wrapper. */}
      {positions.map((pos, idx) => {
        const center = noteCenter(pos)
        const pitched = noteAtPosition(tuning, pos)
        return (
          <rect
            key={`hit-${idx}-${pos.string}-${pos.fret}`}
            data-overlay-hit=""
            x={center.x - 24} y={center.y - STRING_HEIGHT / 2}
            width={48} height={STRING_HEIGHT}
            fill="transparent"
            className="pointer-events-auto cursor-pointer"
            onClick={() => onNoteClick(pos, pitched)}
          />
        )
      })}
      {/* Selected ring overlay (Decyzja #3 — wariant (a) SVG ring). Base note r=10.5,
          ring r=14 → ~3.5px outer offset visible delta. */}
      {selectedPos && positions.some(p =>
        p.string === selectedPos.string && p.fret === selectedPos.fret) && (
        <circle
          data-selected="true"
          cx={noteCenter(selectedPos).x}
          cy={noteCenter(selectedPos).y}
          r={14}
          stroke={palette.selectedRing}
          strokeWidth={3}
          fill="none"
          className="pointer-events-none"
        />
      )}
    </svg>
  )
}

export default function FretboardVisualizer(props: FretboardVisualizerProps) {
  const {
    id, tuning = STANDARD_TUNING, fretCount = DEFAULT_FRET_COUNT,
    enableAudio = true,
  } = props

  // v5-14 labelMode state (per ADR-011 per-instance React state). Default 'note'
  // (Pre-confirmed #4 — pierwsza impresja = note names). Toggle button niezależny
  // od accordion expand state (Pre-confirmed #3).
  const [labelMode, setLabelMode] = useState<LabelMode>(props.labelMode ?? 'note')
  const toggleLabelMode = () =>
    setLabelMode(prev => prev === 'note' ? 'degree' : 'note')

  // useTheme + mounted guard — precedent BayesAnalyzer.tsx + Fretboard.tsx:80-86.
  // resolvedTheme undefined w SSR → hydration mismatch jeśli inline'owany. setState
  // jednorazowy, NIE cascading.
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const [selected, setSelected] = useState<FretPosition | null>(null)

  const isSamePos = (a: FretPosition | null, b: FretPosition) =>
    a !== null && a.string === b.string && a.fret === b.fret

  const handleNoteClick = (pos: FretPosition, pitched: PitchedNote) => {
    setSelected(prev => isSamePos(prev, pos) ? null : pos)
    if (enableAudio !== false) {
      // Lazy load samples na first user gesture (autoplay policy + bundle budget).
      // ensureAudio() resolves z AudioContext; playPitchedNote async (per-note lazy decode).
      ensureAudio()
        .then(ctx => playPitchedNote(ctx, pitched, 0.6))
        .catch(err => {
          // Silent UX per ADR-034 — czytelnik nie widzi modal/toast; autor w devtools.
          console.error('[FretboardVisualizer] audio playback failed:', err)
        })
    }
  }

  // Generate notes from props (useMemo — invariant per render).
  const baseNotes = useMemo<FretboardNote[]>(() => {
    if ('scale' in props && props.scale) {
      const root = props.scale.root
      const scale = scaleNotes(root, props.scale.type)
      return scale.flatMap(note =>
        positionsOfNote(tuning, fretCount, note).map<FretboardNote>(pos => ({
          ...pos,
          color: note === root ? 'root' : 'scale-tone',
        })),
      )
    }
    if ('chord' in props && props.chord) {
      const root = props.chord.root
      const chord = chordNotes(root, props.chord.type)
      return chord.flatMap(note =>
        positionsOfNote(tuning, fretCount, note).map<FretboardNote>(pos => ({
          ...pos,
          color: note === root ? 'root' : 'chord-tone',
        })),
      )
    }
    // 'notes' mode (escape hatch) — explicit list, no root inference.
    return props.notes.map<FretboardNote>(pos => ({ ...pos, color: 'chord-tone' }))
  }, [props, tuning, fretCount])

  // Decyzja planisty #7 — extract + pass do base (forward compat v5-13 degree overlay).
  const rootNote: NoteName | undefined =
    'scale' in props && props.scale ? props.scale.root :
    'chord' in props && props.chord ? props.chord.root :
    undefined

  // v5-14 accordion content — wrapper computes (Decyzja planisty #2 = B generic dumb-display).
  // notes variant: brak deterministycznej note list bez root context → accordion hidden
  // entirely (§3.4 edge case lock).
  const hasAccordionContent = 'scale' in props || 'chord' in props

  const accordionNoteNames = useMemo<NoteName[]>(() => {
    if ('scale' in props && props.scale) return scaleNotes(props.scale.root, props.scale.type)
    if ('chord' in props && props.chord) return chordNotes(props.chord.root, props.chord.type)
    return []
  }, [props])

  const accordionDegrees = useMemo<IntervalName[]>(() => {
    if ('scale' in props && props.scale) {
      const root = props.scale.root
      return accordionNoteNames.map(n => intervalBetween(root, n))
    }
    if ('chord' in props && props.chord) {
      return spellChordDegrees({ root: props.chord.root, type: props.chord.type })
    }
    return []
  }, [props, accordionNoteNames])

  const displayName = useMemo<string | null>(() => {
    if ('scale' in props && props.scale) return `${props.scale.root} ${props.scale.type}`
    if ('chord' in props && props.chord) return `${props.chord.root} ${props.chord.type}`
    return null
  }, [props])

  // Wrapper-level geometry — duplikowane z SelectedOverlay (oba muszą znać svgWidth
  // żeby inner div miał poprawny width dla layered SVG sibling alignment).
  const stringCount = tuning.strings.length
  const svgWidth = NUT_WIDTH + FRET_WIDTH * fretCount + PADDING.left + PADDING.right
  const svgHeight = STRING_HEIGHT * (stringCount - 1) + PADDING.top + PADDING.bottom

  // Layout architecture (post-bugfix):
  // - Outer wrapper: my-6 + negative horizontal margins extending poza prose container
  //   (prose max-w-3xl content ≈720px, SVG 736px → break out żeby pomieścić bez scroll
  //   na desktop). overflow-x-auto fallback dla narrow viewports (mobile).
  // - Inner div: relative, mx-auto, width=svgWidth → SHARED layout container dla obu
  //   SVGs. Base SVG (przez [&>div[data-fretboard-id]]:contents wariant Tailwind
  //   neutralizuje base outer div my-6 -mx-4 sm:mx-0 overflow-x-auto via display:contents)
  //   staje się direct child inner div, normal flow. Overlay SVG absolute top-0 left-0
  //   overlays. Identical viewBox + width = pixel-perfect alignment, no margin-collapse
  //   bug (poprzednio: my-6 base outer div collapsował do wrapper, overlay top-6 dawał
  //   24px desync hit-rects vs visible notes).
  return (
    <div
      className={
        'relative my-6 -mx-4 sm:-mx-6 md:-mx-8 overflow-x-auto ' +
        // Neutralize base outer div via display:contents — drops its my-6 -mx-4 sm:mx-0
        // overflow-x-auto (które na mobile rozpychało base outer div o 32px i przywracało
        // overlay scroll desync). Tailwind 4 syntax: `[&>...]` = direct child (underscore
        // `[&_>...]` = descendant, niepoprawne tutaj).
        '[&>div[data-fretboard-id]]:contents'
      }
      data-fretboard-visualizer-id={id}
    >
      <div
        className="relative mx-auto"
        style={{ width: `${svgWidth}px`, minWidth: '640px', height: `${svgHeight}px` }}
      >
        <Fretboard
          id={`${id}-base`}
          tuning={tuning}
          fretCount={fretCount}
          notes={baseNotes}
          rootNote={rootNote}
          showDegrees={labelMode === 'degree'}
          // onPlayNote left at default noop — wrapper handles click via overlay sibling.
        />
        <SelectedOverlay
          positions={baseNotes}
          selectedPos={selected}
          tuning={tuning}
          fretCount={fretCount}
          resolvedTheme={resolvedTheme}
          mounted={mounted}
          onNoteClick={handleNoteClick}
        />
      </div>

      {/* v5-14 accordion + degree toggle button row (Pre-confirmed #9 native <details>;
          accordion + toggle są niezależne — Pre-confirmed #3). notes variant: accordion
          hidden (no semantic root → puste notes/intervals), toggle button widoczny tylko
          jeśli rootNote dostępny (degree mode wymaga root). */}
      <div className="mx-auto max-w-prose mt-3 px-4 sm:px-0 not-prose flex flex-wrap items-center gap-3">
        {hasAccordionContent && (
          <details className="w-full sm:w-auto">
            <summary className="cursor-pointer py-3 px-4 text-sm text-text-secondary hover:text-text-primary transition-colors">
              Show intervals
            </summary>
            <div className="mt-3 pl-4 space-y-2 text-sm">
              <NotesRow notes={accordionNoteNames} />
              <IntervalsRow degrees={accordionDegrees} />
              <DetectedNameRow name={displayName} />
            </div>
          </details>
        )}
        {rootNote && (
          <button
            type="button"
            onClick={toggleLabelMode}
            data-testid="label-mode-toggle"
            className="py-3 px-4 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded transition-colors"
          >
            {labelMode === 'note' ? 'Show degrees' : 'Show notes'}
          </button>
        )}
      </div>
    </div>
  )
}
