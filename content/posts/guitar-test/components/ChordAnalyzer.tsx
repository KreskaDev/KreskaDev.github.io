'use client'

// ChordAnalyzer — inteligentny wrapper nad bazowym Fretboard (v5-09) z preset-aware
// shape input + algorithmic chord recognition + muted × glyph overlay + degrees breakdown.
// (a) Discriminated union shape|chord (opposite semantic vs FretboardVisualizer per
//     design doc §15 dec #10 — `chord` ładuje konkretny voicing preset z chord-shapes.ts,
//     NIE rozkłada abstract pitch classes na gryfie).
// (b) detectChord ranked top-3 output + Δ<0.2 secondary reading display (ADR-045).
// (c) Slash chord composition wrapper-side (math pure, wrapper compares bass vs root).
// (d) Muted × glyph SVG overlay (base Fretboard immutable per iteration workflow).
// (e) Audio playback przez direct reuse audio.ts (ADR-042 — ZERO modyfikacji audio.ts).

import { useMemo, useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import type {
  NoteName, FretPosition, FretboardNote, IntervalName,
  ChordShape, ChordSpec, Tuning, PitchedNote,
} from './types'
import { DEFAULT_FRET_COUNT } from './types'
import {
  noteAtPosition, detectChord, spellChordDegrees, chordNotes, STANDARD_TUNING,
} from './music-theory'
import { CHORD_SHAPES } from './chord-shapes'
import Fretboard from './Fretboard'
import { ensureAudio, playPitchedNote } from './audio'
import { playSequence } from './audio-sequence'
import { NotesRow, IntervalsRow, DetectedNameRow } from './accordion-rows'

// v5-14 labelMode — wrapper-API enum local; symmetric z FretboardVisualizer
// (każdy wrapper deklaruje własny typ, NIE shared do types.ts dopóki v5-16 notation).
type LabelMode = 'note' | 'degree'

// === ChordAnalyzer props (discriminated union) ===

type SharedProps = {
  id: string
  tuning?: Tuning
  fretCount?: number
  rootNote?: NoteName
  enharmonicPreference?: 'sharps' | 'flats' | 'auto'
  enableAudio?: boolean
  showDegrees?: boolean              // v5-13 — controls inline badges (orthogonal z labelMode)
  labelMode?: LabelMode              // v5-14, default 'note'; gates fretboard label mode
}

export type ChordAnalyzerProps = SharedProps & (
  | { shape: ChordShape | (number | null)[]; chord?: never }
  | {
      /**
       * Akord jako PRESET SHAPE LOAD — wrapper ładuje konkretny voicing z internal
       * chord-shapes.ts library (np. {root:'C',type:'maj'} → open C shape x32010).
       * To RÓŻNA semantyka niż `chord` w FretboardVisualizer (v5-11) gdzie ten sam
       * ChordSpec rozkłada wszystkie pozycje pitch classes na gryfie (abstract display).
       * Identyczny shape typu, OPPOSITE intent. Patrz design doc sekcja 7+8+15 decyzja #10.
       */
      chord: ChordSpec; shape?: never;
    }
)

// === Geometry MIRROR z Fretboard.tsx:48-50,94-99 + FretboardVisualizer.tsx:58-61. ===
// Source of truth: prod/content/posts/guitar-test/components/Fretboard.tsx.
// Drift risk: jeśli base geometry zmieni się w future, overlay alignuje od-by-position.
// Reason for MIRROR (nie shared import): base Fretboard NIE eksportuje geometry constants —
// wymagałoby modyfikacji base (hard constraint immutable per iteration workflow).
const FRET_WIDTH = 56
const STRING_HEIGHT = 28
const NUT_WIDTH = 8
const PADDING = { top: 28, right: 16, bottom: 28, left: 40 }

// MIRROR z ADR-037 color tokens (root + muted). SVG inline hex per Branch B (FretboardVisualizer
// precedens + Fretboard.tsx COLORS). CSS var na SVG attribute niereliabilne cross-browser.
const OVERLAY_COLORS = {
  light: {
    selectedRing: '#8B2635',      // burgundy (ADR-037 root light)
    mutedGlyph:   '#9A9A9A',      // ADR-037 muted token light
    bg:           '#FAF7F2',      // MIRROR Fretboard COLORS.light.bg — mask base label
  },
  dark: {
    selectedRing: '#D97785',      // burgundy dark
    mutedGlyph:   '#6E6A62',      // ADR-037 muted token dark
    bg:           '#1A1816',      // MIRROR Fretboard COLORS.dark.bg — mask base label
  },
} as const

// === Helpers ===

function resolveShape(props: ChordAnalyzerProps): ChordShape | null {
  if ('shape' in props && props.shape !== undefined) {
    if (Array.isArray(props.shape)) {
      return { frets: props.shape }
    }
    return props.shape
  }
  if ('chord' in props && props.chord !== undefined) {
    const key = `${props.chord.root}-${props.chord.type}`
    return CHORD_SHAPES[key] ?? null
  }
  return null
}

function confidenceLabel(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.9) return 'high'
  if (c >= 0.6) return 'medium'
  return 'low'
}

// === Overlay sub-component (inline, not exported) ===

type Palette = { selectedRing: string; mutedGlyph: string; bg: string }

type OverlayProps = {
  activeNotes: FretboardNote[]
  mutedStrings: number[]
  selectedPos: FretPosition | null
  tuning: Tuning
  fretCount: number
  palette: Palette
  onNoteClick: (pos: FretPosition, pitched: PitchedNote) => void
}

function MutedAndSelectedOverlay({
  activeNotes, mutedStrings, selectedPos, tuning, fretCount, palette, onNoteClick,
}: OverlayProps) {
  const stringCount = tuning.strings.length
  const innerWidth = NUT_WIDTH + FRET_WIDTH * fretCount
  const innerHeight = STRING_HEIGHT * (stringCount - 1)
  const svgWidth = innerWidth + PADDING.left + PADDING.right
  const svgHeight = innerHeight + PADDING.top + PADDING.bottom

  // MIRROR formula z Fretboard.tsx:105-110 (= FretboardVisualizer.tsx:95-100).
  // Open-string (fret=0) center: x = PADDING.left + NUT_WIDTH/2 - 16 (LEFT of nut).
  const noteCenter = (pos: FretPosition) => ({
    x: pos.fret === 0
      ? PADDING.left + NUT_WIDTH / 2 - 16
      : PADDING.left + NUT_WIDTH + (pos.fret - 0.5) * FRET_WIDTH,
    y: PADDING.top + (stringCount - 1 - pos.string) * STRING_HEIGHT,
  })

  // Muted "X" glyph zastępuje string label base Fretboard (NIE nakłada się na literkę).
  // Base label position: x = padding.left - 8 = 32, textAnchor="end", fontSize=11
  // (Fretboard.tsx:206-208). Overlay maskuje literkę background-color rect (`bg` token
  // matching base SVG background) i renderuje "X" w tym samym miejscu.
  const mutedGlyphPos = (stringIdx: number) => ({
    x: PADDING.left - 8,
    y: PADDING.top + (stringCount - 1 - stringIdx) * STRING_HEIGHT,
  })

  return (
    <svg
      aria-hidden="true"
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      // Pozycjonowanie top-0 left-0 relative do inner div (siblings z base SVG).
      // Base SVG i overlay SVG mają identyczny width/height/viewBox → idealne pokrycie.
      // FretboardVisualizer.tsx:116 ten sam pattern (neutralizacja base outer div przez
      // display:contents na wrapperze).
      className="absolute top-0 left-0 block pointer-events-none"
    >
      {/* Muted "X" glyph — zastępuje base label literki (E/A/D/G/B/e) bez nakładania.
          Mask rect bg-colored zasłania base label, X renderowany w tym samym anchor.
          Pointer-events-none, brak click handler (muted = no-op visual). */}
      {mutedStrings.map(stringIdx => {
        const pos = mutedGlyphPos(stringIdx)
        return (
          <g key={`muted-${stringIdx}`} className="pointer-events-none">
            <rect
              x={pos.x - 8}
              y={pos.y - 8}
              width={14}
              height={16}
              fill={palette.bg}
            />
            <text
              data-testid={`muted-glyph-string-${stringIdx}`}
              x={pos.x}
              y={pos.y}
              textAnchor="end"
              dominantBaseline="middle"
              fill={palette.mutedGlyph}
              fontSize="12"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontWeight="700"
            >X</text>
          </g>
        )
      })}
      {/* Hit-rects per active note — 48×STRING_HEIGHT (precedent FretboardVisualizer:140-148).
          STRING_HEIGHT (NIE 48) na height: eliminuje vertical overlap między sąsiadującymi
          strun hit-rects (regression guard inherited z v5-11 commit 824da5d). */}
      {activeNotes.map((note, idx) => {
        const center = noteCenter(note)
        const pitched = noteAtPosition(tuning, note)
        return (
          <rect
            key={`hit-${idx}-${note.string}-${note.fret}`}
            data-overlay-hit=""
            x={center.x - 24}
            y={center.y - STRING_HEIGHT / 2}
            width={48}
            height={STRING_HEIGHT}
            fill="transparent"
            className="pointer-events-auto cursor-pointer"
            onClick={() => onNoteClick(note, pitched)}
          />
        )
      })}
      {/* Selected ring overlay — burgundy r=14 stroke-width=3 (precedent v5-11 FBV). */}
      {selectedPos && activeNotes.some(n =>
        n.string === selectedPos.string && n.fret === selectedPos.fret) && (
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

// === Main component ===

export default function ChordAnalyzer(props: ChordAnalyzerProps) {
  const {
    id, tuning = STANDARD_TUNING, fretCount = DEFAULT_FRET_COUNT,
    enableAudio = true, showDegrees = true, rootNote: rootNoteOverride,
  } = props

  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // Canonical next-themes mount-safe pattern (precedens BayesAnalyzer:561 + Fretboard:80-86).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const [selected, setSelected] = useState<FretPosition | null>(null)

  // v5-14 labelMode — per ADR-011 per-instance state. Orthogonal z showDegrees per
  // scenario X (plan §0.3): showDegrees gates inline badges, labelMode gates fretboard
  // label mode. Combination labelMode='degree' + showDegrees=true → both render (acceptable).
  const [labelMode, setLabelMode] = useState<LabelMode>(props.labelMode ?? 'note')
  const toggleLabelMode = () =>
    setLabelMode(prev => prev === 'note' ? 'degree' : 'note')

  const shape = resolveShape(props)

  // Active notes (frets[i] !== null) z color rola (root vs chord-tone na podstawie
  // rootStringIndex matching). Muted strings handled w overlay (NIE jako FretboardNote).
  const activeNotes = useMemo<FretboardNote[]>(() => {
    if (!shape) return []
    const result: FretboardNote[] = []
    for (let stringIdx = 0; stringIdx < shape.frets.length; stringIdx++) {
      const fret = shape.frets[stringIdx]
      if (fret === null || fret === undefined) continue
      result.push({
        string: stringIdx,
        fret,
        color: stringIdx === shape.rootStringIndex ? 'root' : 'chord-tone',
      })
    }
    return result
  }, [shape])

  // Muted strings indices — used w overlay glyph layer.
  const mutedStrings = useMemo<number[]>(() => {
    if (!shape) return []
    const result: number[] = []
    for (let i = 0; i < shape.frets.length; i++) {
      if (shape.frets[i] === null) result.push(i)
    }
    return result
  }, [shape])

  // Detection — pitch classes z activeNotes → detectChord → ranked top-3.
  const detection = useMemo(() => {
    if (activeNotes.length === 0) return null
    const pitchClasses = activeNotes.map(n => noteAtPosition(tuning, n).name)
    return detectChord(pitchClasses)
  }, [activeNotes, tuning])

  // Primary reading helper — narrowing per noUncheckedIndexedAccess.
  const primary = detection && detection.length > 0 ? detection[0] : null

  // Slash chord composition (wrapper-side per ADR-045 (c)). Per Decyzja: type='maj' →
  // strip " maj" suffix dla canonical "C/E" nomenclature; inne ChordTypes preserve
  // pełną nazwę (np. "C min/E", "C 7/G").
  const slashDisplayName = useMemo<string | null>(() => {
    if (!primary) return null
    const detectedName = primary.name
    if (!shape || shape.rootStringIndex === undefined) return detectedName
    const bassFret = shape.frets[shape.rootStringIndex]
    if (bassFret === null || bassFret === undefined) return detectedName
    const bassNote = noteAtPosition(tuning, { string: shape.rootStringIndex, fret: bassFret })
    if (bassNote.name === primary.spec.root) return detectedName
    const baseSlashName = primary.spec.type === 'maj'
      ? primary.spec.root
      : detectedName
    return `${baseSlashName}/${bassNote.name}`
  }, [primary, shape, tuning])

  // Secondary reading — Δ<0.2 threshold per ADR-045 (e).
  const secondaryReading = useMemo(() => {
    if (!detection || detection.length < 2) return null
    const p = detection[0]
    const s = detection[1]
    if (!p || !s) return null
    if (p.confidence - s.confidence >= 0.2) return null
    return s
  }, [detection])

  // Degrees breakdown — lookup z spellChordDegrees na primary spec.
  const degrees = useMemo<readonly IntervalName[]>(() => {
    if (!showDegrees || !primary) return []
    return spellChordDegrees(primary.spec)
  }, [primary, showDegrees])

  const isSamePos = (a: FretPosition | null, b: FretPosition) =>
    a !== null && a.string === b.string && a.fret === b.fret

  const handleNoteClick = (pos: FretPosition, pitched: PitchedNote) => {
    setSelected(prev => isSamePos(prev, pos) ? null : pos)
    if (enableAudio !== false) {
      // Lazy audio load na first user gesture (autoplay policy + bundle budget).
      // Reuse audio.ts module-scoped singleton per ADR-042 (cross-widget shared context).
      ensureAudio()
        .then(ctx => playPitchedNote(ctx, pitched, 0.6))
        .catch(err => {
          // Silent UX per ADR-034 — czytelnik nie widzi modal/toast; autor w devtools.
          console.error('[ChordAnalyzer] audio playback failed:', err)
        })
    }
  }

  const palette = mounted && resolvedTheme === 'dark' ? OVERLAY_COLORS.dark : OVERLAY_COLORS.light
  const stringCount = tuning.strings.length
  const svgWidth = NUT_WIDTH + FRET_WIDTH * fretCount + PADDING.left + PADDING.right
  const svgHeight = STRING_HEIGHT * (stringCount - 1) + PADDING.top + PADDING.bottom

  const allMuted = shape !== null && shape.frets.length > 0 && shape.frets.every(f => f === null)
  const showUnrecognized = !primary && (allMuted || (shape !== null && activeNotes.length >= 2))

  // Display chord name: slashDisplayName uwzględnia slash composition jeśli applicable,
  // fallback do raw primary.name (np. "C maj" gdy brak rootStringIndex lub bass=root).
  const displayName = slashDisplayName ?? primary?.name ?? null

  // v5-14 accordion content (independent od v5-13 `degrees` useMemo which is showDegrees-gated;
  // accordion content musi renderować się regardless of showDegrees value per Pre-confirmed #2
  // — accordion expansion to OSOBNA feature niż inline badges).
  const accordionNoteNames = useMemo<NoteName[]>(() => {
    if (!primary) return []
    return chordNotes(primary.spec.root, primary.spec.type)
  }, [primary])

  const accordionDegrees = useMemo<IntervalName[]>(() => {
    if (!primary) return []
    return spellChordDegrees(primary.spec)
  }, [primary])

  // accordionDisplayName direct reuse of `displayName` (already computes slash) — plan §3.5
  // Decyzja (a): zero extra computation dla primary; sloth: brak osobnego useMemo bo displayName
  // jest już derived value (slashDisplayName ?? primary?.name ?? null).
  const accordionDisplayName = displayName

  // Secondary reading w accordion — Δ<0.2 threshold per ADR-045 + plan §3.5 Decyzja (b).
  // Inline slash logic duplicated dla secondary (plan accepts inline duplication; zero
  // modyfikacji shipped slashDisplayName useMemo per plan §3.5 final paragraph).
  const accordionSecondaryName = useMemo<string | undefined>(() => {
    if (!detection || detection.length < 2) return undefined
    const p = detection[0]
    const s = detection[1]
    if (!p || !s) return undefined
    if (p.confidence - s.confidence >= 0.2) return undefined
    // Slash composition dla secondary — symmetric logic do shipped slashDisplayName useMemo.
    if (!shape || shape.rootStringIndex === undefined) return s.name
    const bassFret = shape.frets[shape.rootStringIndex]
    if (bassFret === null || bassFret === undefined) return s.name
    const bassNote = noteAtPosition(tuning, { string: shape.rootStringIndex, fret: bassFret })
    if (bassNote.name === s.spec.root) return s.name
    const baseSlashName = s.spec.type === 'maj' ? s.spec.root : s.name
    return `${baseSlashName}/${bassNote.name}`
  }, [detection, shape, tuning])

  // v5-14 Play chord handler — kompozycja activeNotes → PitchedNote[] → playSequence z
  // interval=0 (chord simultaneous). enableAudio guard per v5-13 convention; silent UX
  // na error per ADR-034.
  const handlePlayChord = async () => {
    if (enableAudio === false) return
    if (activeNotes.length === 0) return
    try {
      const pitchedNotes: PitchedNote[] = activeNotes.map(fbNote =>
        noteAtPosition(tuning, { string: fbNote.string, fret: fbNote.fret })
      )
      await playSequence(pitchedNotes, { interval: 0 })
    } catch (err) {
      console.error('[ChordAnalyzer] play chord failed:', err)
    }
  }

  // Layout pattern z FretboardVisualizer.tsx:252-287 — outer wrapper z display:contents
  // na base outer div neutralizuje margin-collapse i scroll desync (commit 84624b1).
  return (
    <div
      className={
        'relative my-6 -mx-4 sm:-mx-6 md:-mx-8 overflow-x-auto ' +
        '[&>div[data-fretboard-id]]:contents'
      }
      data-chord-analyzer-id={id}
    >
      {/* Chord name display ABOVE fretboard */}
      {primary ? (
        <div className="mx-auto max-w-prose mb-2 px-4 sm:px-0 not-prose">
          <div className="flex items-baseline gap-2">
            <span
              data-testid="chord-name"
              className="font-display text-xl text-text-primary"
            >
              {displayName}
            </span>
            <span
              data-testid="confidence-label"
              className="text-xs uppercase tracking-wide text-text-tertiary"
            >
              {confidenceLabel(primary.confidence)}
            </span>
            <span
              data-testid="confidence-numeric"
              className="text-xs font-mono text-text-tertiary"
            >
              {primary.confidence.toFixed(2)}
            </span>
          </div>
          {secondaryReading && (
            <div className="text-sm text-text-secondary mt-1">
              <span className="opacity-70">alt:</span>{' '}
              <span data-testid="secondary-name">{secondaryReading.name}</span>{' '}
              <span data-testid="secondary-numeric" className="font-mono opacity-70">
                {secondaryReading.confidence.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      ) : showUnrecognized ? (
        <div className="mx-auto max-w-prose mb-2 px-4 sm:px-0 not-prose text-text-tertiary text-sm">
          — <span data-testid="unrecognized-message">Unrecognized chord</span>
        </div>
      ) : null}

      <div
        className="relative mx-auto"
        style={{ width: `${svgWidth}px`, minWidth: '640px', height: `${svgHeight}px` }}
      >
        <Fretboard
          id={`${id}-base`}
          tuning={tuning}
          fretCount={fretCount}
          notes={activeNotes}
          rootNote={rootNoteOverride ?? primary?.spec.root}
          showDegrees={labelMode === 'degree'}
        />
        <MutedAndSelectedOverlay
          activeNotes={activeNotes}
          mutedStrings={mutedStrings}
          selectedPos={selected}
          tuning={tuning}
          fretCount={fretCount}
          palette={palette}
          onNoteClick={handleNoteClick}
        />
      </div>

      {/* Degrees breakdown BELOW fretboard */}
      {showDegrees && degrees.length > 0 && (
        <ul
          data-testid="degrees-list"
          className="mx-auto max-w-prose mt-3 px-4 sm:px-0 flex flex-wrap gap-2 not-prose list-none p-0"
        >
          {degrees.map((deg, idx) => (
            <li
              key={`${deg}-${idx}`}
              className="font-mono text-xs px-2 py-0.5 rounded bg-accent-soft text-accent"
            >
              {deg}
            </li>
          ))}
        </ul>
      )}

      {/* v5-14 accordion + Play chord + degree toggle button row. Accordion kolokowany
          pod inline degrees badges (v5-13 zostają intact per Pre-confirmed #2). Native
          <details> per Pre-confirmed #9; accordion + degree toggle niezależne per
          Pre-confirmed #3. Play button rendered tylko jeśli enableAudio !== false
          (plan §3.5 hide-not-disable lock). */}
      <div className="mx-auto max-w-prose mt-3 px-4 sm:px-0 not-prose flex flex-wrap items-center gap-3">
        {primary && (
          <details className="w-full sm:w-auto">
            <summary className="cursor-pointer py-3 px-4 text-sm text-text-secondary hover:text-text-primary transition-colors">
              Show intervals
            </summary>
            <div className="mt-3 pl-4 space-y-2 text-sm">
              <NotesRow notes={accordionNoteNames} />
              <IntervalsRow degrees={accordionDegrees} />
              <DetectedNameRow name={accordionDisplayName} secondaryName={accordionSecondaryName} />
              {enableAudio !== false && activeNotes.length > 0 && (
                <button
                  type="button"
                  onClick={handlePlayChord}
                  data-testid="play-chord-button"
                  className="mt-2 py-3 px-4 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded transition-colors"
                >
                  ▶ Play chord
                </button>
              )}
            </div>
          </details>
        )}
        {primary && (
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
