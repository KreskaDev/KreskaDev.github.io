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
import { durationToMs } from './notation-timing'
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

// Scheduled playback entry — absolute startMs offset + sustain duration + pitches (chord)
// + origIdx dla highlight visual data-vf-note-index mapping. Built per voice (independent
// cursor), then flattened + sorted by startMs.
type ScheduledEntry = {
  origIdx: number
  pitches: PitchedNote[]
  startMs: number
  sustainSec: number
}

// Build absolute playback schedule from Note[]. Handles:
// - Rests (advance voice cursor by rest duration; no playback entry)
// - Tied chains (merge consecutive same-pitch notes into single sustained entry)
// - Chord-on-staff (Note.pitch: NotePitch[] → multi-pitch entry, fired as melodic+extras)
// - Multi-voice (each voice has independent cursor starting at 0; flat schedule sorted
//   by startMs → parallel-voiced notes play simultaneously)
function buildPlaybackSchedule(allNotes: NoteData[], bpm: number): ScheduledEntry[] {
  const schedule: ScheduledEntry[] = []

  // Group notes per voice z preserved original index
  const voiceMap = new Map<number, Array<{ note: NoteData; origIdx: number }>>()
  for (let origIdx = 0; origIdx < allNotes.length; origIdx++) {
    const n = allNotes[origIdx]!
    const v = n.voice ?? 1
    if (!voiceMap.has(v)) voiceMap.set(v, [])
    voiceMap.get(v)!.push({ note: n, origIdx })
  }

  // Schedule per voice independently. Each voice cursor starts at 0 → voices play parallel.
  for (const [, voiceNotes] of voiceMap) {
    let cursorMs = 0
    let i = 0
    while (i < voiceNotes.length) {
      const entry = voiceNotes[i]!
      const n = entry.note
      if (n.rest) {
        cursorMs += durationToMs(n.duration, n.dotted, bpm, n.tuplet)
        i += 1
        continue
      }
      if (!n.pitch) { i += 1; continue }
      const pitches = Array.isArray(n.pitch)
        ? n.pitch.map(p => toPitchedNote(p))
        : [toPitchedNote(n.pitch)]
      // Walk tied chain — same single pitch required (chord-on-staff ties NOT v5-15)
      let j = i
      let sustainMs = durationToMs(n.duration, n.dotted, bpm, n.tuplet)
      while (j < voiceNotes.length - 1 && voiceNotes[j]!.note.tied) {
        const nextN = voiceNotes[j + 1]!.note
        if (nextN.rest) break
        const currPitch = voiceNotes[j]!.note.pitch
        const nextPitch = nextN.pitch
        if (Array.isArray(currPitch) || Array.isArray(nextPitch)) break
        if (!currPitch || !nextPitch) break
        if (
          currPitch.letter !== nextPitch.letter
          || (currPitch.accidental ?? null) !== (nextPitch.accidental ?? null)
          || currPitch.octave !== nextPitch.octave
        ) break
        sustainMs += durationToMs(nextN.duration, nextN.dotted, bpm, nextN.tuplet)
        j += 1
      }
      schedule.push({
        origIdx: entry.origIdx,
        pitches,
        startMs: cursorMs,
        sustainSec: sustainMs / 1000,
      })
      cursorMs += sustainMs
      i = j + 1
    }
  }

  // Sort by startMs — multi-voice parallel notes co-occur; ordering w playable[] match
  // temporal scheduling. Stable sort: notes na same startMs preserve voice-insertion order.
  schedule.sort((a, b) => a.startMs - b.startMs)
  return schedule
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
          // Per-note ratio dla each tuplet group key (potrzebne dla factory.Tuplet options).
          const tupletGroupRatio = new Map<string, [number, number]>()
          // Tie pairs — gdy poprzednia nuta ma tied:true, łączymy ją z bieżącą via
          // factory.StaveTie({from, to}). Track prevTied → connect przy następnej StaveNote.
          const tiePairs: Array<[StaveNote, StaveNote]> = []
          let prevTied: StaveNote | null = null

          // Pre-compute implicit tuplet group keys via consecutive-same-ratio walker.
          // Naive `indexOf`-as-key produced unique per-note keys → wszystkie implicit
          // tuplets pozostawały jako single-note groups (length<2 skip downstream).
          // Reset group state na non-tuplet note OR explicit-group note OR ratio change.
          const implicitGroupIds = new Map<NoteData, string>()
          let currentImplicitGroup: string | null = null
          let currentImplicitRatio: [number, number] | null = null
          let implicitGroupCounter = 0
          for (const n of voiceNotes) {
            if (!n.tuplet || n.tuplet.group) {
              currentImplicitGroup = null
              currentImplicitRatio = null
              continue
            }
            const r = n.tuplet.ratio
            if (
              !currentImplicitGroup
              || !currentImplicitRatio
              || currentImplicitRatio[0] !== r[0]
              || currentImplicitRatio[1] !== r[1]
            ) {
              currentImplicitGroup = `implicit-${implicitGroupCounter++}-${r[0]}-${r[1]}`
              currentImplicitRatio = r
            }
            implicitGroupIds.set(n, currentImplicitGroup)
          }

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

            // Tie connection: jeśli poprzednia nuta miała tied:true, łączymy ją z bieżącą.
            // VexFlow StaveTie rysuje łuk legato między dwoma StaveNote. Reset prevTied
            // po użyciu — chain ties (3× tied notes) generuje sekwencję par (n0-n1, n1-n2)
            // w wielokrotnych iteracjach.
            if (prevTied && !isRest) {
              tiePairs.push([prevTied, staveNote])
            }
            prevTied = n.tied && !isRest ? staveNote : null

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

            // Group dla tuplet — explicit `group` ID lub implicit (consecutive same ratio
            // per pre-computed implicitGroupIds map). Ratio zapisany per groupKey dla
            // downstream factory.Tuplet({ options: { numNotes, notesOccupied } }) call.
            if (n.tuplet) {
              const groupKey = n.tuplet.group ?? implicitGroupIds.get(n)
              if (groupKey) {
                const existing = tupletGroups.get(groupKey)
                if (existing) {
                  existing.push(staveNote)
                } else {
                  tupletGroups.set(groupKey, [staveNote])
                  tupletGroupRatio.set(groupKey, n.tuplet.ratio)
                }
              }
            }

            staveNotes.push(staveNote)
            allStaveNotes.push({ origIdx, staveNote })

            // Per-element coloring (Decyzja #3 pre-render via setStyle). Stem + note head color
            // = textPrimary; rests też przyjmują tę barwę przez setStyle.
            staveNote.setStyle({ fillStyle: colors.noteFill, strokeStyle: colors.stemColor })
          }

          // Tuplets — instantiate per group. VexFlow Tuplet groups MUST be created PRZED
          // formatter.format() (modifies note tickContexts). Ratio z tupletGroupRatio map
          // (recorded gdy group key first encountered) — direct O(1) lookup zamiast O(n²)
          // walk through notes array.
          for (const [groupKey, groupNotes] of tupletGroups) {
            if (groupNotes.length < 2) continue // tuplet needs ≥2 notes
            const ratio = tupletGroupRatio.get(groupKey)
            if (!ratio) continue
            factory.Tuplet({
              notes: groupNotes,
              options: { numNotes: ratio[0], notesOccupied: ratio[1] },
            })
          }

          // Ties — instantiate StaveTie per pair. VexFlow renderuje łuk legato między
          // dwoma StaveNote. factory.StaveTie() dodaje element do renderQ → auto-draw
          // przy factory.draw(). Multi-tie chain (3× tied notes) = 2 par (n0-n1, n1-n2).
          for (const [from, to] of tiePairs) {
            factory.StaveTie({ from, to })
          }

          // setStrict(false) — Voice domyślnie strict: total ticks MUST equal exactly
          // one bar of time signature. Empirycznie ujawnione przy live dev smoke:
          // D1/D2 (8 quarters w 4/4 = 2 bars) + D5 (triplet+quarter = 2 beats) hit
          // "Too many ticks"/"Too few ticks". v5-15 demos są edukacyjnie krótkie sekwencje
          // które NIE zawsze fit jednego bar → soft mode tolerable; downside: brak runtime
          // validation autorskich błędów. Plan §10.1 deferred do implementer empirical.
          const voice = factory.Voice({ time: `${ts.numerator}/${ts.denominator}` })
          voice.setStrict(false)
          voice.addTickables(staveNotes)
          voiceObjs.push(voice)
        }

        // Format + draw. joinVoices when ≥2 voices for multi-voice alignment.
        const formatter = factory.Formatter()
        if (voiceObjs.length > 1) {
          formatter.joinVoices(voiceObjs)
        }
        formatter.format(voiceObjs, staveWidth - 120)

        factory.draw()

        // Post-render: stave frame color override (VexFlow default = black hard-coded
        // dla clef/time-sig/key-sig glyphs + stave lines). StaveNote.setStyle pokrywa
        // tylko note glyphs (vf-stavenote groups). Workaround: walk SVG + set fill/stroke
        // na elementach POZA vf-stavenote groups. Empirical lesson z live dev smoke
        // 2026-06-01 — dark theme + default black = nieczytelne.
        const svgEl = setupHost.querySelector('svg')
        if (svgEl) {
          // Paths/text/rects outside note groups = stave frame (clef, time sig, key sig,
          // stave lines, barlines). Color textColor dla full contrast.
          svgEl.querySelectorAll('path, text').forEach((el) => {
            if (!el.closest('g.vf-stavenote')) {
              el.setAttribute('fill', colors.textColor)
              // stroke only for stave lines (path z stroke attribute); zostaw bez stroke
              // gdy inline fill-only (text glyphs).
              if (el.tagName === 'path' && el.hasAttribute('stroke')) {
                el.setAttribute('stroke', colors.textColor)
              }
            }
          })
          // <line> elements = stave lines (5 horizontal) — VexFlow uses lines OR paths
          // dependent on renderer version. Cover both.
          svgEl.querySelectorAll('line').forEach((el) => {
            if (!el.closest('g.vf-stavenote')) {
              el.setAttribute('stroke', colors.staveLineColor)
            }
          })
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

    // Build absolute playback schedule (per voice independent cursor + tied chain merge
    // + rest gap accounting + chord-on-staff multi-pitch + sorted flat timeline).
    // Plays multi-voice notes PARALLEL gdy startTimes coincide; rests jako audio silence
    // (note's sustainSec NIE extends into rest period); tied chains as single sustained
    // entry. Single sequence of {melodic primary pitch, startMs, sustainSec} per entry.
    const schedule = buildPlaybackSchedule(notes, bpm)
    if (schedule.length === 0) {
      setIsPlaying(false)
      return
    }
    const melodicNotes = schedule.map(e => e.pitches[0]!)
    const startTimes = schedule.map(e => e.startMs / 1000)
    const sustainDurations = schedule.map(e => e.sustainSec)

    // Pre-resolve ctx ONCE — eliminates ensureAudio().then(...) async race w onNoteStart
    // callback. Chord extras fire synchronously z pre-resolved ctx, no microtask drift.
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
      durations: sustainDurations,
      startTimes,
      signal: controller.signal,
      onNoteStart: (playIdx, scheduledMs) => {
        // scheduledMs unused obecnie — przyszli konsumenci (v5-18+ cross-widget cursor)
        // mogą używać dla precision sync. void-suppress per Mermaid Sesja 22 pattern.
        void scheduledMs
        try {
          const entry = schedule[playIdx]
          if (!entry) return
          setCurrentNoteIdx(entry.origIdx)
          // Chord-on-staff extras fire SYNCHRONOUSLY z pre-resolved ctx — primary
          // pitch via playSequence melodic line + extras via direct playPitchedNote.
          const extras = entry.pitches.slice(1)
          if (extras.length > 0 && !controller.signal.aborted) {
            for (const extra of extras) {
              playPitchedNote(ctx, extra, entry.sustainSec).catch(() => {})
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
