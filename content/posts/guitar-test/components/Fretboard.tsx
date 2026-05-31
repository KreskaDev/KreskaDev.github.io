'use client'

// Fretboard — read-only base widget per design doc sekcja 6.
// Mobile-ready ≥360px viewport (ADR-035 + hard rule #6 CLAUDE.md): horizontal scroll,
// ≥44px tap target (invisible <rect> overlay), CSS-only mobile-first (zero JS viewport
// detection). Theme-aware przez useTheme + mounted guard (BayesAnalyzer precedent).

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import type {
  FretboardProps, FretPosition, PitchedNote,
} from './types'
import { MIN_FRET_COUNT, MAX_FRET_COUNT, DEFAULT_FRET_COUNT } from './types'
import { STANDARD_TUNING, noteAtPosition, intervalBetween } from './music-theory'

// MIRROR z ADR-037. Source of truth: adr/ADR-037-music-widget-color-palette.md.
// Update tam najpierw, tu replikuj.
// SVG `stroke`/`fill` attribute NIE supportuje CSS var reliably cross-browser → inline hex
// (precedens: BayesAnalyzer.tsx:47-64).
const COLORS = {
  light: {
    root:       '#8B2635',
    chordTone:  '#1A1A1A',
    scaleTone:  '#6B6B6B',
    extension:  '#3B6E47',
    muted:      '#9A9A9A',
    string:     '#1A1A1A',
    nut:        '#1A1A1A',
    fretMarker: '#9A9A9A',
    bg:         '#FAF7F2',
    label:      '#1A1A1A',
  },
  dark: {
    root:       '#D97785',
    chordTone:  '#F5F2EC',
    scaleTone:  '#B5B0A6',
    extension:  '#7BA887',
    muted:      '#6E6A62',
    string:     '#F5F2EC',
    nut:        '#F5F2EC',
    fretMarker: '#6E6A62',
    bg:         '#1A1816',
    label:      '#F5F2EC',
  },
} as const

// SVG geometry — design doc sekcja 6 (fret ~56px, struna ~28px).
const FRET_WIDTH = 56
const STRING_HEIGHT = 28
const NUT_WIDTH = 8
const FRET_MARKER_DOTS = new Set([3, 5, 7, 9, 15, 17, 19, 21])
const FRET_MARKER_DOUBLE = new Set([12, 24])

export default function Fretboard(props: FretboardProps) {
  // D11.4 — id is REQUIRED prop. v5-13 może dodać runtime duplicate check
  // (URL hash collision). W v5-09 author responsibility — React `key` warning
  // powie jeśli duplicate w MDX.
  const {
    id,
    tuning = STANDARD_TUNING,
    fretCount = DEFAULT_FRET_COUNT,
    notes,
    showFretNumbers = true,
    showStringLabels = true,
    showDegrees = false,
    rootNote,
    onPlayNote = () => {},
    // editable, onFretClick — accept w typach, ignored w v5-09 (v5-13)
  } = props

  // D11.6 — runtime throw. Loud failure symmetric z required `id` TS error.
  // Build-time signal w SSR/npm run build; propaguje do app/error.tsx boundary.
  if (fretCount < MIN_FRET_COUNT || fretCount > MAX_FRET_COUNT) {
    throw new Error(
      `Fretboard "${id}": fretCount=${fretCount} out of range ` +
      `[${MIN_FRET_COUNT}, ${MAX_FRET_COUNT}]. Adjust prop in MDX.`,
    )
  }

  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // Canonical next-themes mount-safe pattern — bez tego SSR/CSR mismatch (resolvedTheme
  // undefined w SSR). React 19/Next 16 react-hooks/set-state-in-effect flaguje domyślnie;
  // setState jednorazowy on mount, NIE cascading. Spójność z BayesAnalyzer:561.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  const palette = mounted && resolvedTheme === 'dark' ? COLORS.dark : COLORS.light

  const stringCount = tuning.strings.length
  const innerWidth = NUT_WIDTH + FRET_WIDTH * fretCount
  const innerHeight = STRING_HEIGHT * (stringCount - 1)
  // padding.left ≥36 by open-string circle (x = padding.left - 12) + 48px tap target
  // (x_tap = x - 24 = padding.left - 36) nie clipowało SVG viewBox.
  const padding = {
    top: 28,
    right: 16,
    bottom: showFretNumbers ? 28 : 16,
    left: showStringLabels ? 40 : 36,
  }
  const svgWidth = innerWidth + padding.left + padding.right
  const svgHeight = innerHeight + padding.top + padding.bottom

  // FretPosition → SVG center. String 0 (low E) rendered AT BOTTOM (design doc sekcja 6
  // "low na dole, wysoka na górze") — flip y przez (stringCount - 1 - stringIdx).
  const noteCenter = (pos: FretPosition) => ({
    x: pos.fret === 0
      ? padding.left + NUT_WIDTH / 2 - 16  // open string circle LEFT of nut
      : padding.left + NUT_WIDTH + (pos.fret - 0.5) * FRET_WIDTH,
    y: padding.top + (stringCount - 1 - pos.string) * STRING_HEIGHT,
  })

  const renderedNotes = notes.map(n => {
    const pitched: PitchedNote = noteAtPosition(tuning, n)
    const displayLabel = n.label ?? (
      showDegrees && rootNote
        ? intervalBetween(rootNote, pitched.name)
        : pitched.name
    )
    const colorToken = n.color ?? 'chord-tone'
    return { n, pitched, displayLabel, colorToken, ...noteCenter(n) }
  })

  // D11.3 — count, not full list (verbose dla screen reader). v5-13 evolution: aria-live
  // dla edit mode changes.
  const ariaLabel =
    `Guitar fretboard: ${tuning.name} tuning, ${fretCount} frets, ` +
    `${notes.length} note${notes.length === 1 ? '' : 's'} shown`

  return (
    <div className="my-6 -mx-4 sm:mx-0 overflow-x-auto" data-fretboard-id={id}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="block min-w-[640px] mx-auto font-mono"
        style={{ background: palette.bg }}
      >
        {/* Strings — lower string thicker (bass progression) */}
        {tuning.strings.map((_, stringIdx) => {
          const y = padding.top + (stringCount - 1 - stringIdx) * STRING_HEIGHT
          const strokeWidth = 1 + (stringCount - 1 - stringIdx) * 0.3
          return (
            <line
              key={`string-${stringIdx}`}
              x1={padding.left} y1={y}
              x2={padding.left + innerWidth} y2={y}
              stroke={palette.string}
              strokeWidth={strokeWidth}
            />
          )
        })}

        {/* Nut */}
        <rect
          x={padding.left} y={padding.top - 4}
          width={NUT_WIDTH} height={innerHeight + 8}
          fill={palette.nut}
        />

        {/* Fret wires */}
        {Array.from({ length: fretCount }, (_, i) => i + 1).map(fretNum => {
          const x = padding.left + NUT_WIDTH + fretNum * FRET_WIDTH
          return (
            <line
              key={`fret-${fretNum}`}
              x1={x} y1={padding.top}
              x2={x} y2={padding.top + innerHeight}
              stroke={palette.string}
              strokeWidth={1}
            />
          )
        })}

        {/* Fret markers (single + double dots na 12/24) */}
        {Array.from({ length: fretCount }, (_, i) => i + 1).map(fretNum => {
          const x = padding.left + NUT_WIDTH + (fretNum - 0.5) * FRET_WIDTH
          const midY = padding.top + innerHeight / 2
          if (FRET_MARKER_DOUBLE.has(fretNum)) {
            return (
              <g key={`marker-${fretNum}`}>
                <circle cx={x} cy={midY - STRING_HEIGHT * 0.9} r={3.5} fill={palette.fretMarker} />
                <circle cx={x} cy={midY + STRING_HEIGHT * 0.9} r={3.5} fill={palette.fretMarker} />
              </g>
            )
          }
          if (FRET_MARKER_DOTS.has(fretNum)) {
            return (
              <circle
                key={`marker-${fretNum}`}
                cx={x} cy={midY} r={3.5}
                fill={palette.fretMarker}
              />
            )
          }
          return null
        })}

        {/* String labels (open string note name na lewo) */}
        {showStringLabels && tuning.strings.map((openNote, stringIdx) => {
          const y = padding.top + (stringCount - 1 - stringIdx) * STRING_HEIGHT
          return (
            <text
              key={`label-${stringIdx}`}
              x={padding.left - 8} y={y}
              textAnchor="end" dominantBaseline="middle"
              fontSize={11} fill={palette.label}
            >
              {openNote}
            </text>
          )
        })}

        {/* Fret numbers (pod gryfem) */}
        {showFretNumbers && Array.from({ length: fretCount }, (_, i) => i + 1).map(fretNum => {
          const x = padding.left + NUT_WIDTH + (fretNum - 0.5) * FRET_WIDTH
          return (
            <text
              key={`fretnum-${fretNum}`}
              x={x} y={padding.top + innerHeight + 16}
              textAnchor="middle"
              fontSize={10} fill={palette.label}
            >
              {fretNum}
            </text>
          )
        })}

        {/* Active notes — invisible 48×48 rect tap target (hard rule #6) + visible 21px circle */}
        {renderedNotes.map((rn, idx) => {
          const colorMap = {
            'root': palette.root,
            'chord-tone': palette.chordTone,
            'scale-tone': palette.scaleTone,
            'extension': palette.extension,
            'muted': palette.muted,
          } as const
          const fill = colorMap[rn.colorToken]
          return (
            <g
              key={`note-${idx}-${rn.n.string}-${rn.n.fret}`}
              onClick={() => onPlayNote(rn.pitched)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={rn.x - 24} y={rn.y - 24}
                width={48} height={48}
                fill="transparent"
              />
              <circle
                cx={rn.x} cy={rn.y} r={10.5}
                fill={fill} stroke={fill} strokeWidth={1.5}
              />
              <text
                x={rn.x} y={rn.y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={9}
                fontWeight={rn.colorToken === 'root' ? 700 : 500}
                fill={palette.bg}
              >
                {rn.displayLabel}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
