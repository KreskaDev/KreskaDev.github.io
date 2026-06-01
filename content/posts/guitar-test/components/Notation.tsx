'use client'

// Notation widget — VexFlow-rendered 5-line staff + BPM-driven playback + per-note
// highlight visual via onNoteStart callback. Per ADR-053 (VexFlow runtime dep) + ADR-054
// (onNoteStart callback evolution z first-consumer advance v5-18+ → v5-15).
//
// Theme reactivity pattern = analog Mermaid Sesja 22: useEffect + rAF defer + cancelled
// flag + getComputedStyle CSS var resolver. Bez rAF defer = one-palette-behind bug bo
// child useEffect fires PRZED next-themes ThemeProvider useEffect (html class stale).
//
// Multi-instance safety = per-instance Factory (NIE shared module state); useId() unique
// render target id; AbortController per-instance dla Play→Stop cancellation.

import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import type {
  Duration as DurationType,
  KeySignature,
  Note as NoteData,
  NoteName,
  NotePitch,
  PitchedNote,
  TimeSignature,
} from './types'
import { playSequence } from './audio-sequence'
import { ensureAudio, playPitchedNote } from './audio'
import { notesToDurations } from './notation-timing'
// VexFlow lazy import OK at module top — Notation.tsx samo jest behind LazyNotation HOC
// (dynamic({ssr:false})). Per ADR-043: SSR boundary established w HOC, base widget free
// to import browser-only libs at module top. Bravura entry = core + SMuFL Bravura font
// pre-bundled (per ADR-053 §0.3 spike: 378 KB gz lazy chunk).
import { VexFlow } from 'vexflow/bravura'
import type { Factory, StaveNote } from 'vexflow/bravura'

export type NotationProps = {
  id: string
  notes: NoteData[]
  timeSignature?: TimeSignature
  keySignature?: KeySignature
  defaultBpm?: number
  enableAudio?: boolean
  showBpmControl?: boolean
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const MIN_BPM = 40
const MAX_BPM = 240
const DEFAULT_BPM = 90

// Duration mapping NotePitch.duration → VexFlow duration string. Rest dodaje 'r' suffix.
const VEX_DURATION: Record<DurationType, string> = {
  '1': 'w',
  '1/2': 'h',
  '1/4': 'q',
  '1/8': '8',
  '1/16': '16',
  '1/32': '32',
}

// Map NotePitch → VexFlow key string ("c/4", "f#/5", "bb/3"). Accidental 'natural'
// dropped jako empty suffix (key signature decides whether explicit natural sign needed).
function pitchToVexKey(p: NotePitch): string {
  const letter = p.letter.toLowerCase()
  const acc = p.accidental === '#' ? '#' : p.accidental === 'b' ? 'b' : ''
  return `${letter}${acc}/${p.octave}`
}

// NotePitch → PitchedNote conversion (notation domain → audio domain). 'natural' accidental
// dropped (default chromatic spelling assumes no accidental). Chord-on-staff (`pitch[]`)
// handled przez caller — to function NIE accepts arrays.
function toPitchedNote(p: NotePitch): PitchedNote {
  const accSuffix = p.accidental === '#' ? '#' : p.accidental === 'b' ? 'b' : ''
  return { name: (p.letter + accSuffix) as NoteName, octave: p.octave }
}

// Read CSS vars from :root (resolved per palette/mode per ADR-041 dual-palette).
// Reads happen INSIDE rAF callback (post next-themes ThemeProvider useEffect) — see
// useEffect comment dla "one-palette-behind" rationale.
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

export default function Notation({
  id,
  notes,
  timeSignature,
  keySignature,
  defaultBpm,
  enableAudio,
  showBpmControl,
}: NotationProps) {
  const reactId = useId()
  const hostRef = useRef<HTMLDivElement>(null)
  const factoryRef = useRef<Factory | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [mounted, setMounted] = useState(false)
  const [bpm, setBpm] = useState(() => clamp(defaultBpm ?? DEFAULT_BPM, MIN_BPM, MAX_BPM))
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentNoteIdx, setCurrentNoteIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  const ts = timeSignature ?? { numerator: 4, denominator: 4 }
  const keySig = keySignature ?? 'C'
  const audioEnabled = enableAudio !== false
  const showBpm = showBpmControl !== false

  // Canonical next-themes mount-safe pattern. Bez tego SSR/CSR mismatch dla resolvedTheme
  // (undefined w SSR). Analog BayesAnalyzer + Mermaid Sesja 22.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // Render staff lifecycle. CRITICAL: rAF defer per Mermaid Sesja 22 lesson — bez tego
  // getComputedStyle czyta CSS vars z STAREJ palety (html className jeszcze nie zsync'owany
  // gdy effect fires) → notation renderuje się z one-palette-behind colors.
  useEffect(() => {
    if (!mounted) return
    if (typeof window === 'undefined') return
    let cancelled = false
    const targetId = `notation-${reactId.replace(/:/g, '')}`

    const rafId = requestAnimationFrame(() => {
      if (cancelled) return
      try {
        // Dispose previous factory render (innerHTML clear). Per-instance state — multi-
        // instance safety bo każdy widget ma własny targetId via useId().
        if (hostRef.current) hostRef.current.innerHTML = ''

        const colors = readNotationColors()

        // Group notes by voice (Decyzja #4 implicit single-voice + opt-in `voice` field).
        const voicesData = new Map<number, NoteData[]>()
        for (const n of notes) {
          const v = n.voice ?? 1
          if (!voicesData.has(v)) voicesData.set(v, [])
          voicesData.get(v)!.push(n)
        }
        const voicesEntries = Array.from(voicesData.entries()).sort((a, b) => a[0] - b[0])

        // Stave width — empirycznie dobrane: stała pre-stave (clef+key+time) + per-note slot.
        const maxNotesPerVoice = Math.max(...voicesEntries.map(([, ns]) => ns.length), 1)
        const staveWidth = Math.max(360, 80 + maxNotesPerVoice * 55)

        const setupHost = hostRef.current
        if (!setupHost) return
        setupHost.innerHTML = `<div id="${targetId}"></div>`

        const factory = new VexFlow.Factory({
          renderer: {
            elementId: targetId,
            width: staveWidth,
            height: 180,
            background: 'transparent',
          },
        })
        factoryRef.current = factory

        const stave = factory
          .Stave({ x: 10, y: 20, width: staveWidth - 20 })
          .addTimeSignature(`${ts.numerator}/${ts.denominator}`)
          .addKeySignature(keySig)
        stave.setContext(factory.getContext())

        // Per-voice StaveNote construction. Per-voice tuplet grouping. Maintains a global
        // origIdxList[voiceIdx][noteIdx] dla post-render data-vf-note-index assignment.
        const voiceObjs: ReturnType<typeof factory.Voice>[] = []
        const allStaveNotes: Array<{ origIdx: number; staveNote: StaveNote }> = []

        for (const [, voiceNotes] of voicesEntries) {
          const staveNotes: StaveNote[] = []
          const tupletGroups = new Map<string, StaveNote[]>()

          for (const n of voiceNotes) {
            // Resolve global original index w `notes` (NIE per-voice). Multi-voice case:
            // notes.map index preserves original ordering; data-vf-note-index uses original.
            const origIdx = notes.indexOf(n)
            const isRest = n.rest === true
            const pitches: NotePitch[] = isRest
              ? [{ letter: 'B', octave: 4 }] // rest keys placeholder (VexFlow needs key string)
              : Array.isArray(n.pitch)
                ? n.pitch
                : n.pitch
                  ? [n.pitch]
                  : [{ letter: 'C', octave: 4 }]

            const keys = pitches.map(pitchToVexKey)
            let durationStr = VEX_DURATION[n.duration]
            if (n.dotted) durationStr += 'd'
            if (isRest) durationStr += 'r'

            const staveNote = factory.StaveNote({ keys, duration: durationStr })

            // Apply per-pitch accidentals explicit. VexFlow auto-handles key sig matching
            // ale explicit modifier zapewnia że pochylenie pojawi się gdy NotePitch.accidental
            // jest set i NIE pasuje do key sig.
            if (!isRest) {
              pitches.forEach((p, kIdx) => {
                if (p.accidental === '#' || p.accidental === 'b' || p.accidental === 'natural') {
                  const typeMap: Record<string, string> = { '#': '#', 'b': 'b', 'natural': 'n' }
                  const acc = factory.Accidental({ type: typeMap[p.accidental]! })
                  staveNote.addModifier(acc, kIdx)
                }
              })
            }

            // Articulation
            if (n.articulation && !isRest) {
              const artMap: Record<string, string> = {
                staccato: 'a.', accent: 'a>', tenuto: 'a-', marcato: 'a^',
              }
              const code = artMap[n.articulation]
              if (code) staveNote.addModifier(factory.Articulation({ type: code }), 0)
            }

            // Ornament
            if (n.ornament && !isRest) {
              const ornMap: Record<string, string> = {
                trill: 'tr', mordent: 'mordent', turn: 'turn', fermata: 'a@a',
              }
              const code = ornMap[n.ornament]
              if (code) staveNote.addModifier(factory.Ornament(code), 0)
            }

            // Group dla tuplet — explicit `group` ID lub implicit (consecutive same ratio).
            if (n.tuplet) {
              const groupKey = n.tuplet.group
                ?? `implicit-${n.tuplet.ratio[0]}-${n.tuplet.ratio[1]}-${voiceNotes.indexOf(n)}`
              const existing = tupletGroups.get(groupKey)
              if (existing) {
                existing.push(staveNote)
              } else {
                tupletGroups.set(groupKey, [staveNote])
              }
            }

            staveNotes.push(staveNote)
            allStaveNotes.push({ origIdx, staveNote })

            // Per-element coloring (Decyzja #3 pre-render via setStyle). Stem + note head color
            // = textPrimary; rests też przyjmują tę barwę przez setStyle.
            staveNote.setStyle({ fillStyle: colors.noteFill, strokeStyle: colors.stemColor })
          }

          // Tuplets — instantiate per group. VexFlow Tuplet groups MUST be created PRZED
          // formatter.format() (modifies note tickContexts).
          for (const [, groupNotes] of tupletGroups) {
            if (groupNotes.length < 2) continue // tuplet needs ≥2 notes
            const firstNote = groupNotes[0]
            const ratio = (notes.find(n => allStaveNotes.find(asn => asn.staveNote === firstNote)?.origIdx === notes.indexOf(n)))?.tuplet?.ratio
            if (!ratio) continue
            factory.Tuplet({
              notes: groupNotes,
              options: { numNotes: ratio[0], notesOccupied: ratio[1] },
            })
          }

          const voice = factory
            .Voice({ time: `${ts.numerator}/${ts.denominator}` })
            .addTickables(staveNotes)
          voiceObjs.push(voice)
        }

        // Format + draw. joinVoices when ≥2 voices for multi-voice alignment.
        const formatter = factory.Formatter()
        if (voiceObjs.length > 1) {
          formatter.joinVoices(voiceObjs)
        }
        formatter.format(voiceObjs, staveWidth - 120)

        factory.draw()

        // Post-render: stave line color override (VexFlow default = black; reactive z palette).
        // Workaround dla Stave.setStyle nie kolorując ledger lines reliably — direct SVG mutate.
        const svgEl = setupHost.querySelector('svg')
        if (svgEl) {
          // Style stave lines via attribute (VexFlow renders stave lines jako <line> elements).
          // Note glyphs already colored via per-StaveNote setStyle.
          const svgRoot = svgEl as SVGSVGElement
          svgRoot.style.color = colors.textColor
          // Make sure SVG inherits text color for stave clef/time sig glyphs which may
          // use `currentColor` lub default fill.
        }

        // Assign data-vf-note-index na rendered SVG `g.vf-stavenote` elements w document order.
        // Multi-voice quirk: SVG order = voice 1 (n=0..k-1) then voice 2 (n=k..) — same jak
        // allStaveNotes.push order. data-vf-note-index = origIdx (original notes.map index)
        // → highlight visual matches notes.map order regardless of voice.
        const noteGroups = setupHost.querySelectorAll('g.vf-stavenote')
        noteGroups.forEach((g, gIdx) => {
          const entry = allStaveNotes[gIdx]
          if (entry) g.setAttribute('data-vf-note-index', String(entry.origIdx))
        })

        if (cancelled) return
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('[Notation] render failed:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, resolvedTheme, notes, bpm, timeSignature, keySignature, reactId])

  // Cleanup pending playback on unmount — abort current AbortController.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const handlePlay = async () => {
    if (isPlaying) {
      // Stop toggle — abort signal triggers audio-sequence cleanup (clearTimeout pending,
      // resolve hanging promises). UI reset synchronous.
      abortControllerRef.current?.abort()
      setIsPlaying(false)
      setCurrentNoteIdx(null)
      return
    }
    if (!audioEnabled) return

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsPlaying(true)
    setCurrentNoteIdx(null)

    // Index mapping (Fix #2 reviewer Round 2): build playable entries z explicit origIdx.
    // onNoteStart callback receives filtered index → map to original notes index dla
    // highlight visual (data-vf-note-index targets original Note positions includes rests).
    type PlayableEntry = { origIdx: number; group: PitchedNote[] }
    const playable: PlayableEntry[] = []
    for (let origIdx = 0; origIdx < notes.length; origIdx++) {
      const n = notes[origIdx]!
      if (n.rest) continue
      if (!n.pitch) continue
      const group = Array.isArray(n.pitch)
        ? n.pitch.map(p => toPitchedNote(p))
        : [toPitchedNote(n.pitch)]
      playable.push({ origIdx, group })
    }
    if (playable.length === 0) {
      setIsPlaying(false)
      return
    }
    const melodicNotes = playable.map(e => e.group[0]!)
    const durationsSec = notesToDurations(notes, bpm).map(ms => ms / 1000)

    // Pre-resolve ctx ONCE (Fix #2 reviewer Round 2) — eliminates ensureAudio().then(...)
    // async race w onNoteStart callback. Chord extras fire synchronously at melodic note
    // start timestamp z pre-resolved ctx, no microtask drift / flam attack.
    let ctx: AudioContext
    try {
      ctx = await ensureAudio()
    } catch (err) {
      console.error('[Notation] ensureAudio failed:', err)
      setIsPlaying(false)
      setCurrentNoteIdx(null)
      return
    }

    playSequence(melodicNotes, {
      interval: 0,
      durations: durationsSec,
      signal: controller.signal,
      onNoteStart: (playIdx, scheduledMs) => {
        // scheduledMs unused obecnie — przyszli konsumenci (v5-18+ cross-widget cursor)
        // mogą używać dla precision sync. void-suppress per Mermaid Sesja 22 pattern.
        void scheduledMs
        try {
          const entry = playable[playIdx]
          if (!entry) return
          setCurrentNoteIdx(entry.origIdx)
          // Chord extras fire SYNCHRONOUSLY z pre-resolved ctx — no async drift.
          const extras = entry.group.slice(1)
          if (extras.length > 0 && !controller.signal.aborted) {
            const dur = durationsSec[playIdx] ?? 0.6
            for (const extra of extras) {
              playPitchedNote(ctx, extra, dur).catch(() => {})
            }
          }
        } catch (err) {
          console.error('[Notation] highlight/chord-extra failed:', err)
        }
      },
    })
      .then(() => {
        if (!controller.signal.aborted) {
          setIsPlaying(false)
          setCurrentNoteIdx(null)
        }
      })
      .catch((err: unknown) => {
        console.error('[Notation] playback failed:', err)
        setIsPlaying(false)
        setCurrentNoteIdx(null)
      })
  }

  const handleBpmChange = (raw: number) => {
    if (Number.isNaN(raw)) return
    setBpm(clamp(Math.round(raw), MIN_BPM, MAX_BPM))
  }

  return (
    <figure
      className="my-8 -mx-4 sm:mx-0"
      data-notation-id={id}
    >
      <div className="overflow-x-auto">
        <div
          ref={hostRef}
          className="notation-host"
          data-current-note={currentNoteIdx ?? ''}
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
          {audioEnabled && (
            <button
              type="button"
              data-testid="play-button"
              onClick={handlePlay}
              className="min-h-[44px] px-4 py-2 rounded bg-accent text-bg-primary font-medium hover:opacity-90 transition-opacity"
              aria-label={isPlaying ? 'Stop playback' : 'Play notation'}
            >
              {isPlaying ? '■ Stop' : '▶ Play'}
            </button>
          )}
        </div>
      )}
      {error && (
        <pre className="mt-2 text-burgundy text-sm p-3 border border-burgundy-soft rounded overflow-x-auto">
          Notation render error: {error}
        </pre>
      )}
    </figure>
  )
}
