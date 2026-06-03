'use client'

// ScaleOnFretboard — read-only scale-on-fretboard widget (v5-16 per ADR-057).
// Composition reuse immutable Fretboard.tsx (v5-09 contract) via sibling overlay pattern
// (v5-11 SelectedOverlay precedent). Note[] verbatim (Pre-confirmed #2, D2 user decision).
// Audio: shipped playSequence + notation-timing helpers (ADR-049 + ADR-054, third consumer
// chain ChordAnalyzer → Notation → ScaleOnFretboard).
//
// Linked mode (Pattern C per ADR-059): useContext(NotationScaleLinkCursorContext) non-null
// → hide Play+BPM, read cursor z context. Standalone (default) preserved.

import { useState, useEffect, useId, useRef, useContext, useMemo } from 'react'
import { useTheme } from 'next-themes'
import type {
  Note,
  NotePitch,
  FretPosition,
  FretboardNote,
  NoteName,
  Tuning,
  PitchedNote,
  IntervalName,
} from './types'
import { DEFAULT_FRET_COUNT } from './types'
import { playSequence } from './audio-sequence'
import { ensureAudio } from './audio'
import { notesToDurations, notesToScheduledTimes } from './notation-timing'
import { STANDARD_TUNING, intervalBetween } from './music-theory'
import { getPositions } from './note-positions'
import Fretboard from './Fretboard'
import { NotationCursorContext } from './NotationCursorContext'

export type ScaleOnFretboardProps = {
  id: string
  notes: Note[]
  rootNote?: NoteName
  tuning?: Tuning
  fretCount?: number
  defaultBpm?: number
  enableAudio?: boolean
  showBpmControl?: boolean
  showArrows?: boolean
  showDegrees?: boolean
}

// === BPM constants (analog Notation.tsx) ===
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const MIN_BPM = 40
const MAX_BPM = 240
const DEFAULT_BPM_FALLBACK = 90

// === MIRROR z Fretboard.tsx:48-50,94-99 (drift Risk §8 #1 mitigation). ===
// Source of truth: prod/content/posts/guitar-test/components/Fretboard.tsx.
// Update tam najpierw, tu replikuj. ScaleOnFretboard NIE exposuje showFretNumbers/
// showStringLabels override — padding fixed assumption stable.
const FRET_WIDTH = 56
const STRING_HEIGHT = 28
const NUT_WIDTH = 8
const PADDING = { top: 28, right: 16, bottom: 28, left: 40 }

// MIRROR formula z Fretboard.tsx:105-110.
function noteCenter(pos: FretPosition, stringCount: number): { x: number; y: number } {
  return {
    x: pos.fret === 0
      ? PADDING.left + NUT_WIDTH / 2 - 16
      : PADDING.left + NUT_WIDTH + (pos.fret - 0.5) * FRET_WIDTH,
    y: PADDING.top + (stringCount - 1 - pos.string) * STRING_HEIGHT,
  }
}

// ARROW_COLORS = ADR-037 'arrow' token extension (luminance reuse scaleTone palette).
// HIGHLIGHT_COLORS = ADR-037 root token reuse (visual emphasis = root note color).
// Inline hex bo SVG stroke/fill NIE supportuje CSS var reliably cross-browser
// (precedent: Fretboard.tsx + FretboardVisualizer.tsx).
const ARROW_COLORS = {
  light: { stroke: '#6B6B6B' },
  dark: { stroke: '#B5B0A6' },
} as const

const HIGHLIGHT_COLORS = {
  light: { stroke: '#8B2635' },
  dark: { stroke: '#D97785' },
} as const

// === Helpers ===

// NotePitch (notation domain) → PitchedNote (audio domain). Analog Notation.tsx:71-74.
// 'natural' accidental dropped jako empty suffix.
function toPitchedNote(p: NotePitch): PitchedNote {
  const accSuffix = p.accidental === '#' ? '#' : p.accidental === 'b' ? 'b' : ''
  return { name: (p.letter + accSuffix) as NoteName, octave: p.octave }
}

// First non-rest non-chord pitch → NoteName (letter + accidental). Used jako fallback root
// gdy `rootNote` prop nie podany.
function deriveRootFromFirstNote(notes: Note[]): NoteName | undefined {
  for (const n of notes) {
    if (n.rest) continue
    if (!n.pitch) continue
    if (Array.isArray(n.pitch)) continue
    const p = n.pitch
    const acc = p.accidental === '#' ? '#' : p.accidental === 'b' ? 'b' : ''
    return `${p.letter}${acc}` as NoteName
  }
  return undefined
}

type DerivedNote = {
  note: Note
  position: FretPosition | null
  fretboardNote: FretboardNote | null
  origIdx: number
}

function deriveFretboardNotes(
  notes: Note[],
  tuning: Tuning,
  rootNote: NoteName | undefined,
): DerivedNote[] {
  const root = rootNote ?? deriveRootFromFirstNote(notes)
  return notes.map((n, origIdx) => {
    if (n.rest || !n.pitch || Array.isArray(n.pitch)) {
      return { note: n, position: null, fretboardNote: null, origIdx }
    }
    const pitch = n.pitch
    // Explicit position priority; fallback to naïve first-match (lowest-fret).
    const candidate = n.position ?? getPositions(pitch, { tuning })[0]
    if (!candidate) {
      return { note: n, position: null, fretboardNote: null, origIdx }
    }
    const pitched = toPitchedNote(pitch)
    let degree: IntervalName | undefined
    if (root) {
      try {
        degree = intervalBetween(root, pitched.name)
      } catch {
        // intervalBetween throw'uje gdy NoteName non-canonical — silent skip degree.
        degree = undefined
      }
    }
    const color: FretboardNote['color'] = degree === 'R' ? 'root' : 'scale-tone'
    const fretboardNote: FretboardNote = { ...candidate, degree, color }
    return { note: n, position: candidate, fretboardNote, origIdx }
  })
}

// Build schedule dla playSequence — monophonic only (chord-on-staff throw'd upstream).
// notation-timing helpers zwracają ms; convert do seconds dla audio-sequence API.
function buildScaleSchedule(notes: Note[], bpm: number): {
  melodic: PitchedNote[]
  durations: number[]
  startTimes: number[]
  origIndices: number[]
} {
  const scheduledMs = notesToScheduledTimes(notes, bpm) // length = non-rest count
  const durationsMs = notesToDurations(notes, bpm)
  const melodic: PitchedNote[] = []
  const origIndices: number[] = []
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!
    if (n.rest || !n.pitch) continue
    if (Array.isArray(n.pitch)) continue // throw'd upstream defensive guard
    melodic.push(toPitchedNote(n.pitch))
    origIndices.push(i)
  }
  return {
    melodic,
    durations: durationsMs.map(ms => ms / 1000),
    startTimes: scheduledMs.map(ms => ms / 1000),
    origIndices,
  }
}

// === ArrowsOverlay sub-component (kolokowane) ===

type ArrowsOverlayProps = {
  positions: FretPosition[]
  fretCount: number
  stringCount: number
}

function ArrowsOverlay({ positions, fretCount, stringCount }: ArrowsOverlayProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // Canonical next-themes mount-safe pattern — analog Fretboard.tsx:85 + Notation.tsx:206.
  // setState jednorazowy on mount, NIE cascading.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  const palette = mounted && resolvedTheme === 'dark' ? ARROW_COLORS.dark : ARROW_COLORS.light

  // useId() MUST być top-level (Rules of Hooks). markerId per-instance — multi-instance
  // dwa wrappers = dwa różne markerIds, no SVG def collision.
  const reactId = useId()
  const markerId = `arrowhead-${reactId.replace(/:/g, '')}`

  const innerWidth = NUT_WIDTH + FRET_WIDTH * fretCount
  const innerHeight = STRING_HEIGHT * (stringCount - 1)
  const svgWidth = innerWidth + PADDING.left + PADDING.right
  const svgHeight = innerHeight + PADDING.top + PADDING.bottom

  if (positions.length < 2) return null

  return (
    <svg
      aria-hidden="true"
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="absolute top-0 left-0 block pointer-events-none"
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,4 L0,8 z" fill={palette.stroke} />
        </marker>
      </defs>
      {positions.slice(0, -1).map((from, i) => {
        const to = positions[i + 1]!
        const a = noteCenter(from, stringCount)
        const b = noteCenter(to, stringCount)
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy)
        // Skip arrow jeśli adjacent positions too close (sąsiadujące note circles r=10.5
        // overlap z arrow line). Offset 13px > r=10.5 zapewnia visible gap.
        if (len < 26) return null
        const ux = dx / len
        const uy = dy / len
        const x1 = a.x + ux * 13
        const y1 = a.y + uy * 13
        const x2 = b.x - ux * 13
        const y2 = b.y - uy * 13
        return (
          <line
            key={`arrow-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={palette.stroke}
            strokeWidth={1.5}
            markerEnd={`url(#${markerId})`}
          />
        )
      })}
    </svg>
  )
}

// === HighlightOverlay sub-component (kolokowane) ===

type HighlightOverlayProps = {
  position: FretPosition | null
  fretCount: number
  stringCount: number
}

function HighlightOverlay({ position, fretCount, stringCount }: HighlightOverlayProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  const palette = mounted && resolvedTheme === 'dark' ? HIGHLIGHT_COLORS.dark : HIGHLIGHT_COLORS.light

  const innerWidth = NUT_WIDTH + FRET_WIDTH * fretCount
  const innerHeight = STRING_HEIGHT * (stringCount - 1)
  const svgWidth = innerWidth + PADDING.left + PADDING.right
  const svgHeight = innerHeight + PADDING.top + PADDING.bottom

  if (!position) return null
  const c = noteCenter(position, stringCount)

  return (
    <svg
      aria-hidden="true"
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="absolute top-0 left-0 block pointer-events-none"
    >
      <circle
        cx={c.x}
        cy={c.y}
        r={14}
        fill="none"
        stroke={palette.stroke}
        strokeWidth={2.5}
      />
    </svg>
  )
}

// === Main component ===

export default function ScaleOnFretboard(props: ScaleOnFretboardProps) {
  const {
    id,
    notes,
    rootNote,
    tuning = STANDARD_TUNING,
    fretCount = DEFAULT_FRET_COUNT,
    defaultBpm,
    enableAudio = true,
    showBpmControl = true,
    showArrows = true,
    showDegrees = true,
  } = props

  // Defensive validation pre-render (Decyzja #8 — monophonic-only widget). Chord-on-staff
  // throw z actionable hint dla autora MDX. Linked mode: wrapper NotationScaleLink throws
  // first (Pre-confirmed #13 Kolizja #2), tu = defense in depth dla standalone usage.
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!
    if (n.pitch && Array.isArray(n.pitch)) {
      throw new Error(
        `ScaleOnFretboard "${id}": chord-on-staff Note at index ${i} rejected (pitch is array). ` +
        `Scale widget supports monophonic sequences only. For chord-on-fretboard rendering ` +
        `use FretboardVisualizer; for chord-on-staff use standalone <Notation/>; or split chord ` +
        `into separate Note entries.`,
      )
    }
  }

  // Linked mode detection (Pattern C per ADR-059). Non-null cursor context → linked.
  const linkedCtx = useContext(NotationCursorContext)
  const isLinked = linkedCtx !== null

  // Derived FretboardNote[] dla base Fretboard render. useMemo bo notes/tuning/rootNote
  // stable per Pattern C wrapper (notes stable context).
  const derivedNotes = useMemo(
    () => deriveFretboardNotes(notes, tuning, rootNote),
    [notes, tuning, rootNote],
  )

  const reactId = useId()
  const [bpm, setBpm] = useState(() => clamp(defaultBpm ?? DEFAULT_BPM_FALLBACK, MIN_BPM, MAX_BPM))
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentNoteIdx, setCurrentNoteIdx] = useState<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Effective currentNoteIdx — linked → context; standalone → internal state.
  const effectiveCurrentIdx = isLinked ? linkedCtx.currentNoteIdx : currentNoteIdx

  // Cleanup pending playback on unmount.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const handlePlay = async () => {
    if (isPlaying) {
      abortControllerRef.current?.abort()
      setIsPlaying(false)
      setCurrentNoteIdx(null)
      return
    }
    if (!enableAudio) return

    const schedule = buildScaleSchedule(notes, bpm)
    if (schedule.melodic.length === 0) {
      setIsPlaying(false)
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsPlaying(true)
    setCurrentNoteIdx(null)

    // Pre-resolve ctx ONCE — analog Notation.tsx:523 (eliminates ensureAudio race).
    try {
      await ensureAudio()
    } catch (err) {
      console.error('[ScaleOnFretboard] ensureAudio failed:', err)
      setIsPlaying(false)
      setCurrentNoteIdx(null)
      return
    }

    playSequence(schedule.melodic, {
      interval: 0,
      durations: schedule.durations,
      startTimes: schedule.startTimes,
      signal: controller.signal,
      onNoteStart: (playIdx, scheduledMs) => {
        void scheduledMs
        try {
          setCurrentNoteIdx(schedule.origIndices[playIdx] ?? null)
        } catch (err) {
          console.error('[ScaleOnFretboard] highlight failed:', err)
        }
      },
    })
      .then(() => {
        if (controller.signal.aborted) return
        // playSequence resolves po notach scheduled, NIE po sustain. Hold cursor + isPlaying
        // do końca sustain ostatniej nuty (mirror Notation.tsx — last-note blink fix).
        const lastSustainMs = (schedule.durations[schedule.durations.length - 1] ?? 0) * 1000
        setTimeout(() => {
          if (controller.signal.aborted) return
          setIsPlaying(false)
          setCurrentNoteIdx(null)
        }, lastSustainMs)
      })
      .catch((err: unknown) => {
        console.error('[ScaleOnFretboard] playback failed:', err)
        setIsPlaying(false)
        setCurrentNoteIdx(null)
      })
  }

  const handleBpmChange = (raw: number) => {
    if (Number.isNaN(raw)) return
    setBpm(clamp(Math.round(raw), MIN_BPM, MAX_BPM))
  }

  const stringCount = tuning.strings.length
  const fretboardNotes = derivedNotes
    .map(d => d.fretboardNote)
    .filter((n): n is FretboardNote => n !== null)
  const arrowPositions = derivedNotes
    .filter(d => d.position !== null && !d.note.rest)
    .map(d => d.position!)
  const highlightPosition = effectiveCurrentIdx !== null
    ? derivedNotes[effectiveCurrentIdx]?.position ?? null
    : null

  const showBpm = !isLinked && showBpmControl
  const showPlay = !isLinked && enableAudio

  return (
    <figure className="my-6 -mx-4 sm:mx-0" data-scale-on-fretboard-id={id}>
      <div className="overflow-x-auto" data-current-note={effectiveCurrentIdx ?? ''}>
        <div className="relative inline-block [&>div[data-fretboard-id]]:contents">
          <Fretboard
            id={`${id}-base`}
            tuning={tuning}
            fretCount={fretCount}
            notes={fretboardNotes}
            showDegrees={showDegrees}
            rootNote={rootNote ?? deriveRootFromFirstNote(notes)}
            showFretNumbers
            showStringLabels
          />
          {showArrows && (
            <ArrowsOverlay
              positions={arrowPositions}
              fretCount={fretCount}
              stringCount={stringCount}
            />
          )}
          <HighlightOverlay
            position={highlightPosition}
            fretCount={fretCount}
            stringCount={stringCount}
          />
        </div>
      </div>
      {showBpm && (
        <div className="mt-3 flex flex-wrap items-center gap-3 px-2 sm:px-0">
          <label
            htmlFor={`bpm-input-${reactId}`}
            className="text-sm text-text-secondary min-h-[44px] flex items-center"
          >
            BPM
          </label>
          <input
            id={`bpm-slider-${reactId}`}
            data-testid="bpm-slider"
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={bpm}
            onChange={(e) => handleBpmChange(Number(e.target.value))}
            className="flex-1 min-w-[120px] min-h-[44px]"
            aria-label="Tempo (beats per minute)"
          />
          <input
            id={`bpm-input-${reactId}`}
            data-testid="bpm-input"
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={bpm}
            onChange={(e) => handleBpmChange(Number(e.target.value))}
            className="w-20 min-h-[44px] px-2 border border-border-subtle rounded bg-surface text-text-primary"
            aria-label="Tempo numeric input"
          />
          {showPlay && (
            <button
              type="button"
              data-testid="play-button"
              onClick={handlePlay}
              className="min-h-[44px] px-4 py-2 rounded bg-accent text-bg-primary font-medium hover:opacity-90 transition-opacity"
              aria-label={isPlaying ? 'Stop playback' : 'Play scale'}
            >
              {isPlaying ? '■ Stop' : '▶ Play'}
            </button>
          )}
        </div>
      )}
    </figure>
  )
}
