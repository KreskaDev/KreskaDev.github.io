'use client'

// Tablature widget — VexFlow TabStave SVG renderer (read-only, monophonic + chord-on-tab).
// Per ADR-060 (architecture) + ADR-058 (note-positions API, first non-STANDARD consumer)
// + ADR-061 (NotationCursorContext linked mode) + ADR-062 (multi-tuning convention).
//
// Lifecycle mirror Notation v5-15: per-instance Factory, useId render target, theme
// reactivity via rAF defer (one-palette-behind avoidance), AbortController Play/Stop.
// Audio: shipped playSequence + ensureAudio (third+fourth music vertical consumer).
//
// Linked mode (useContext(NotationCursorContext) non-null) → hide Play+BPM, read cursor
// z context. Standalone (default) — own BPM + Play, chord-aware buildPlaybackSchedule
// (mirror Notation, NOT ScaleOnFretboard monophonic-only).

import { useEffect, useId, useRef, useState, useContext, useMemo } from 'react'
import { useTheme } from 'next-themes'
import type {
  Duration as DurationType,
  KeySignature,
  Note as NoteData,
  NoteName,
  NotePitch,
  PitchedNote,
  TimeSignature,
  Tuning,
  FretPosition,
} from './types'
import { playSequence } from './audio-sequence'
import { ensureAudio, playPitchedNote } from './audio'
import { durationToMs } from './notation-timing'
import { resolveTuning, type TuningName } from './tunings'
import { STANDARD_TUNING } from './music-theory'
import { getPositions } from './note-positions'
import { NotationCursorContext } from './NotationCursorContext'
import { VexFlow } from 'vexflow/bravura'
import type { Factory, TabNote } from 'vexflow/bravura'

// VexFlow TabNote position shape (per `vexflow/build/types/src/tabnote.d.ts:5-8`).
// `str: 1` = top staff line = high E (Q2 LOCK plan §2.1 verified empirically).
type TabNotePosition = { str: number; fret: number | string }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const MIN_BPM = 40
const MAX_BPM = 240
const DEFAULT_BPM = 90
const DEFAULT_MAX_FRET = 24

// Duration mapping NotePitch.duration → VexFlow duration string (mirror Notation.tsx:64).
const VEX_DURATION: Record<DurationType, string> = {
  '1': 'w',
  '1/2': 'h',
  '1/4': 'q',
  '1/8': '8',
  '1/16': '16',
  '1/32': '32',
}

// NotePitch → PitchedNote conversion (audio domain). 'natural' dropped jako empty suffix.
function toPitchedNote(p: NotePitch): PitchedNote {
  const accSuffix = p.accidental === '#' ? '#' : p.accidental === 'b' ? 'b' : ''
  return { name: (p.letter + accSuffix) as NoteName, octave: p.octave }
}

type DerivedTabEntry = {
  note: NoteData
  origIdx: number
  vexPositions: TabNotePosition[]
  vexDuration: string
}

// Position derivation (Q3 hybrid + Q7 chord-on-tab LOCK per plan §7).
// Explicit Note.position wygrywa (single-pitch only); chord-on-tab → per-pitch
// independent getPositions first-match. Validation: throw na out-of-range explicit
// position; throw na chord-Note z explicit position (chord wymaga per-pitch derivation).
function deriveTabPositions(
  notes: NoteData[],
  tuning: Tuning,
  maxFret: number,
  widgetId: string,
): DerivedTabEntry[] {
  return notes.map((n, origIdx) => {
    if (n.rest) {
      const vexDur = VEX_DURATION[n.duration] + 'r'
      return {
        note: n,
        origIdx,
        vexPositions: [{ str: 1, fret: '' }],
        vexDuration: vexDur,
      }
    }
    if (!n.pitch) {
      throw new Error(
        `Tablature "${widgetId}": Note ${origIdx} missing pitch (not rest, no pitch field).`,
      )
    }
    const isChord = Array.isArray(n.pitch)
    if (isChord && n.position) {
      throw new Error(
        `Tablature "${widgetId}": chord Note at index ${origIdx} has explicit position field. ` +
          `Chord-on-tab requires per-pitch position derivation (use only pitch[] without position). ` +
          `Note.positions: FretPosition[] additive field deferred to future iter.`,
      )
    }
    const pitches: NotePitch[] = isChord ? (n.pitch as NotePitch[]) : [n.pitch as NotePitch]
    const vexPositions: TabNotePosition[] = pitches.map((p) => {
      // Explicit position (single-pitch case): validate range + convert to VexFlow str.
      if (n.position && !isChord) {
        if (n.position.string < 0 || n.position.string > tuning.strings.length - 1) {
          throw new Error(
            `Tablature "${widgetId}": Note ${origIdx} explicit position.string=${n.position.string} ` +
              `out of range for tuning "${tuning.name}" (strings 0..${tuning.strings.length - 1}).`,
          )
        }
        if (n.position.fret < 0 || n.position.fret > maxFret) {
          throw new Error(
            `Tablature "${widgetId}": Note ${origIdx} explicit position.fret=${n.position.fret} ` +
              `out of range (0..${maxFret}). Adjust position or pass maxFret prop.`,
          )
        }
        return { str: tuning.strings.length - n.position.string, fret: n.position.fret }
      }
      // Fallback: getPositions first-match (lowest-fret bias per ADR-058).
      const candidates: FretPosition[] = getPositions(p, { tuning, maxFret })
      if (candidates.length === 0) {
        const accStr = p.accidental === '#' ? '#' : p.accidental === 'b' ? 'b' : ''
        throw new Error(
          `Tablature "${widgetId}": Note ${origIdx} pitch ${p.letter}${accStr}${p.octave} ` +
            `unreachable in tuning "${tuning.name}" within fret range 0..${maxFret}. ` +
            `Lower the octave or expand maxFret prop.`,
        )
      }
      const first = candidates[0]!
      // tuning.strings[0] = low E (idx 0) author convention; VexFlow str:6 = bottom = low E.
      return { str: tuning.strings.length - first.string, fret: first.fret }
    })
    let vexDuration = VEX_DURATION[n.duration]
    if (n.dotted) vexDuration += 'd'
    return { note: n, origIdx, vexPositions, vexDuration }
  })
}

type ScheduledEntry = {
  origIdx: number
  pitches: PitchedNote[]
  startMs: number
  sustainSec: number
}

// Build absolute playback schedule — MIRROR Notation.tsx:105-166 chord-aware logic
// (NOT ScaleOnFretboard monophonic-only). Tablature wspiera chord-on-tab audio: primary
// pitch via playSequence melodic line + extras via playPitchedNote synchronicznie z ctx.
function buildTabSchedule(allNotes: NoteData[], bpm: number): ScheduledEntry[] {
  const schedule: ScheduledEntry[] = []
  let cursorMs = 0
  for (let origIdx = 0; origIdx < allNotes.length; origIdx++) {
    const n = allNotes[origIdx]!
    if (n.rest) {
      cursorMs += durationToMs(n.duration, n.dotted, bpm, n.tuplet)
      continue
    }
    if (!n.pitch) continue
    const pitches = Array.isArray(n.pitch)
      ? n.pitch.map(toPitchedNote)
      : [toPitchedNote(n.pitch)]
    const sustainMs = durationToMs(n.duration, n.dotted, bpm, n.tuplet)
    schedule.push({
      origIdx,
      pitches,
      startMs: cursorMs,
      sustainSec: sustainMs / 1000,
    })
    cursorMs += sustainMs
  }
  return schedule
}

// MIRROR Notation.tsx:171-190. Extract gated do v5-21 shared lib milestone per plan §8.2.
// Reads :root CSS vars resolved per palette/mode (ADR-041 dual-palette).
function readNotationColors(): {
  noteFill: string
  stemColor: string
  staveLineColor: string
  textColor: string
} {
  if (typeof document === 'undefined') {
    return { noteFill: '#000', stemColor: '#000', staveLineColor: '#888', textColor: '#000' }
  }
  const css = getComputedStyle(document.documentElement)
  const read = (n: string) => css.getPropertyValue(n).trim()
  const textPrimary = read('--color-text-primary') || '#000'
  const textSecondary = read('--color-text-secondary') || '#666'
  return {
    noteFill: textPrimary,
    stemColor: textPrimary,
    staveLineColor: textSecondary,
    textColor: textPrimary,
  }
}

export type TablatureProps = {
  id: string
  notes: NoteData[]
  // MDX-friendly union: TuningName string lookup OR Tuning literal pass-through (ADR-062).
  tuning?: Tuning | TuningName
  maxFret?: number
  defaultBpm?: number
  enableAudio?: boolean
  showBpmControl?: boolean
  timeSignature?: TimeSignature
  // Unused w tab (kept for NotationLink shared API consistency).
  keySignature?: KeySignature
}

export default function Tablature(props: TablatureProps) {
  const {
    id,
    notes,
    tuning: tuningInput,
    maxFret = DEFAULT_MAX_FRET,
    defaultBpm,
    enableAudio = true,
    showBpmControl = true,
    timeSignature,
  } = props

  // Resolve tuning union per ADR-062 §4.2.1 LOCK. resolveTuning throw'uje na unknown
  // TuningName string → escapes do React error boundary (visible runtime/build error).
  const tuning = resolveTuning(tuningInput)

  // Pre-render validation (Smoke #7). deriveTabPositions throws on:
  //   - chord Note z explicit position field
  //   - explicit position out of range (string/fret)
  //   - missing pitch (not rest)
  //   - pitch unreachable w tuning + maxFret
  // useMemo bo notes/tuning/maxFret stable per re-render (avoid re-derivation cost).
  const derived = useMemo(
    () => deriveTabPositions(notes, tuning, maxFret, id),
    [notes, tuning, maxFret, id],
  )

  // Linked mode detection (mirror ScaleOnFretboard.tsx:332). Non-null context → linked.
  const linkedCtx = useContext(NotationCursorContext)
  const isLinked = linkedCtx !== null

  const reactId = useId()
  const hostRef = useRef<HTMLDivElement>(null)
  const factoryRef = useRef<Factory | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [mounted, setMounted] = useState(false)
  const [bpm, setBpm] = useState(() => clamp(defaultBpm ?? DEFAULT_BPM, MIN_BPM, MAX_BPM))
  const [isPlaying, setIsPlaying] = useState(false)
  const [internalCurrentNoteIdx, setInternalCurrentNoteIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  const ts = timeSignature ?? { numerator: 4, denominator: 4 }
  const effectiveCurrentIdx = isLinked ? linkedCtx.currentNoteIdx : internalCurrentNoteIdx
  const showBpm = !isLinked && showBpmControl
  const showPlay = !isLinked && enableAudio

  // Canonical next-themes mount-safe pattern.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // Render lifecycle — rAF defer mirror Notation.tsx:226-494 (theme reactivity).
  useEffect(() => {
    if (!mounted) return
    if (typeof window === 'undefined') return
    let cancelled = false
    const targetId = `tab-${reactId.replace(/:/g, '')}`

    const rafId = requestAnimationFrame(() => {
      if (cancelled) return
      try {
        if (hostRef.current) hostRef.current.innerHTML = ''
        const colors = readNotationColors()

        const maxNotes = derived.length
        const staveWidth = Math.max(360, 80 + maxNotes * 55)

        const setupHost = hostRef.current
        if (!setupHost) return
        setupHost.innerHTML = `<div id="${targetId}"></div>`

        const factory = new VexFlow.Factory({
          renderer: {
            elementId: targetId,
            width: staveWidth,
            height: 160,
            background: 'transparent',
          },
        })
        factoryRef.current = factory

        const stave = factory.TabStave({ x: 10, y: 10, width: staveWidth - 20 })
        stave.addTabGlyph()
        stave.addTimeSignature(`${ts.numerator}/${ts.denominator}`)
        stave.setContext(factory.getContext())

        const tabNotes: TabNote[] = []
        const allTabNotes: Array<{ origIdx: number; tabNote: TabNote }> = []
        for (const entry of derived) {
          const tn = factory.TabNote({
            positions: entry.vexPositions,
            duration: entry.vexDuration,
          })
          tabNotes.push(tn)
          allTabNotes.push({ origIdx: entry.origIdx, tabNote: tn })
        }

        const voice = factory.Voice({ time: `${ts.numerator}/${ts.denominator}` })
        voice.setStrict(false)
        voice.addTickables(tabNotes)
        factory.Formatter().format([voice], staveWidth - 80)
        factory.draw()

        // Post-render color override (Risk §12.1 mitigation). Leave fill UNSET na text
        // inside g.vf-tabnote → CSS rule controls (theme-reactive base + accent highlight
        // gdy current). Outside vf-tabnote: tab clef + time sig → textColor.
        const svgEl = setupHost.querySelector('svg')
        if (svgEl) {
          svgEl.querySelectorAll('text').forEach((el) => {
            if (!el.closest('g.vf-tabnote')) {
              el.setAttribute('fill', colors.textColor)
            }
          })
          svgEl.querySelectorAll('path').forEach((el) => {
            if (!el.closest('g.vf-tabnote')) {
              el.setAttribute('fill', colors.textColor)
              if (el.hasAttribute('stroke')) {
                el.setAttribute('stroke', colors.textColor)
              }
            }
          })
          svgEl.querySelectorAll('line').forEach((el) => {
            el.setAttribute('stroke', colors.staveLineColor)
          })
        }

        // Assign data-vf-note-index dla cursor highlight CSS rule matching (plan §3.2).
        const noteGroups = setupHost.querySelectorAll('g.vf-tabnote')
        noteGroups.forEach((g, gIdx) => {
          const entry = allTabNotes[gIdx]
          if (entry) g.setAttribute('data-vf-note-index', String(entry.origIdx))
        })

        if (cancelled) return
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('[Tablature] render failed:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, resolvedTheme, derived, bpm, timeSignature, tuning, reactId])

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
      setInternalCurrentNoteIdx(null)
      return
    }
    if (!enableAudio) return

    const schedule = buildTabSchedule(notes, bpm)
    if (schedule.length === 0) {
      setIsPlaying(false)
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsPlaying(true)
    setInternalCurrentNoteIdx(null)

    const melodicNotes = schedule.map((e) => e.pitches[0]!)
    const startTimes = schedule.map((e) => e.startMs / 1000)
    const sustainDurations = schedule.map((e) => e.sustainSec)

    // Pre-resolve ctx ONCE — eliminates ensureAudio race w chord extras (mirror Notation:537).
    let ctx: AudioContext
    try {
      ctx = await ensureAudio()
    } catch (err) {
      console.error('[Tablature] ensureAudio failed:', err)
      setIsPlaying(false)
      setInternalCurrentNoteIdx(null)
      return
    }

    playSequence(melodicNotes, {
      interval: 0,
      durations: sustainDurations,
      startTimes,
      signal: controller.signal,
      onNoteStart: (playIdx, scheduledMsCb) => {
        void scheduledMsCb
        try {
          const entry = schedule[playIdx]
          if (!entry) return
          setInternalCurrentNoteIdx(entry.origIdx)
          // Chord-on-tab extras fire SYNCHRONOUSLY z pre-resolved ctx (mirror Notation:563).
          const extras = entry.pitches.slice(1)
          if (extras.length > 0 && !controller.signal.aborted) {
            for (const extra of extras) {
              playPitchedNote(ctx, extra, entry.sustainSec).catch(() => {})
            }
          }
        } catch (err) {
          console.error('[Tablature] highlight/chord-extra failed:', err)
        }
      },
    })
      .then(() => {
        if (controller.signal.aborted) return
        // playSequence resolves po notach scheduled, NIE po sustain. Hold cursor + isPlaying
        // do końca sustain ostatniej nuty (mirror Notation.tsx — last-note blink fix).
        const lastSustainMs = (sustainDurations[sustainDurations.length - 1] ?? 0) * 1000
        setTimeout(() => {
          if (controller.signal.aborted) return
          setIsPlaying(false)
          setInternalCurrentNoteIdx(null)
        }, lastSustainMs)
      })
      .catch((err: unknown) => {
        console.error('[Tablature] playback failed:', err)
        setIsPlaying(false)
        setInternalCurrentNoteIdx(null)
      })
  }

  const handleBpmChange = (raw: number) => {
    if (Number.isNaN(raw)) return
    setBpm(clamp(Math.round(raw), MIN_BPM, MAX_BPM))
  }

  return (
    <figure className="my-8 -mx-4 sm:mx-0" data-tablature-id={id}>
      {tuning.name !== STANDARD_TUNING.name && (
        <div className="mb-1 px-2 text-xs text-text-secondary">Tuning: {tuning.name}</div>
      )}
      <div className="overflow-x-auto">
        <div
          ref={hostRef}
          className="tablature-host"
          data-current-note={effectiveCurrentIdx ?? ''}
        />
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
              aria-label={isPlaying ? 'Stop playback' : 'Play tablature'}
            >
              {isPlaying ? '■ Stop' : '▶ Play'}
            </button>
          )}
        </div>
      )}
      {error && (
        <pre className="mt-2 text-burgundy text-sm p-3 border border-burgundy-soft rounded overflow-x-auto">
          Tablature render error: {error}
        </pre>
      )}
    </figure>
  )
}
