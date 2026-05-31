// audio.ts — custom Web Audio mini-player + Gleitzman MIDI.js FluidR3_GM acoustic_guitar_nylon.
// Per ADR-042. Vehicle: ZERO npm deps. Custom playback consuming CC-BY 3.0 samples.
// AudioContext singleton (Decyzja planisty #5 — module-scoped, browser limit ~6 contexts).
// Lazy init na first user gesture (autoplay policy + bundle budget — sample file ~1.84 MB
// loaded TYLKO gdy user kliknie pierwszą nutę).

import type { PitchedNote, NoteName } from './types'

// === Sample source metadata (matches ADR-042) ===
export const SAMPLE_INSTRUMENT = 'acoustic_guitar_nylon' as const
const SAMPLE_KIT = 'FluidR3_GM' as const
// Gleitzman CDN URL. Kit pivot path (FluidR3_GM → MusyngKite / FatBoy) = single-line edit.
const SAMPLE_URL =
  `https://gleitz.github.io/midi-js-soundfonts/${SAMPLE_KIT}/${SAMPLE_INSTRUMENT}-mp3.js`
// License: CC-BY 3.0 — attribution w prod/public/audio/ATTRIBUTIONS.md.

// === MIDI.js global shape (after script load) ===
type MidiSoundfontMap = Record<string, string>  // note name → data URL
declare global {
  interface Window {
    MIDI?: {
      Soundfont?: Record<string, MidiSoundfontMap>
    }
    webkitAudioContext?: typeof AudioContext
  }
}

// === Module-scoped singletons (Decyzja #5) ===
let _ctx: AudioContext | null = null
let _samples: MidiSoundfontMap | null = null  // raw data URL map
const _buffers = new Map<string, AudioBuffer>()  // decoded cache per note
// _bufferPromises memoize in-flight decodes — prevents double-decode race
// gdy user szybko clicknie tę samą nutę 2× przed pierwszym decode complete.
const _bufferPromises = new Map<string, Promise<AudioBuffer | null>>()
let _loadPromise: Promise<void> | null = null

// === PitchedNote → MIDI.js note name "C4" / "Eb3" etc. ===
// Gleitzman FluidR3_GM uses FLATS ONLY (Bb, Db, Eb, Gb, Ab) — empirycznie verified
// 2026-05-31 via Object.keys(window.MIDI.Soundfont.acoustic_guitar_nylon): 88 keys,
// all sharps absent. Plan §0.2 dokumentowane "sharps only" było błędne.
// Normalize defensively: sharps → flats; B#→C(+1oct); Cb→B(-1oct); E#→F; Fb→E.
function pitchedNoteToMidiKey(note: PitchedNote): string {
  if (note.name === 'B#') return `C${note.octave + 1}`
  if (note.name === 'Cb') return `B${note.octave - 1}`
  if (note.name === 'E#') return `F${note.octave}`
  if (note.name === 'Fb') return `E${note.octave}`
  const SHARP_TO_FLAT: Partial<Record<NoteName, string>> = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
  }
  const normalized = SHARP_TO_FLAT[note.name] ?? note.name
  return `${normalized}${note.octave}`
}

// === Script loader (idempotent) ===
function loadScript(url: string): Promise<void> {
  if (document.querySelector(`script[src="${url}"]`)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`[audio] failed to load script: ${url}`))
    document.head.appendChild(script)
  })
}

// === Base64 data URL → ArrayBuffer ===
function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// === Lazy ensure: AudioContext + script load (sample map populated, NOT decoded) ===
export async function ensureAudio(): Promise<AudioContext> {
  if (_loadPromise) {
    await _loadPromise
    // _ctx assigned w trakcie _loadPromise; po await jest non-null lub poprzedni catch je zresetował.
    if (!_ctx) throw new Error('[audio] context unavailable after load')
    return _ctx
  }
  const promise = (async () => {
    if (!_ctx) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext
      if (!Ctor) throw new Error('[audio] Web Audio API unavailable')
      _ctx = new Ctor()
    }
    if (_ctx.state === 'suspended') await _ctx.resume()  // iOS Safari autoplay gating
    if (!_samples) {
      await loadScript(SAMPLE_URL)
      const map = window.MIDI?.Soundfont?.[SAMPLE_INSTRUMENT]
      if (!map) throw new Error(`[audio] MIDI.Soundfont.${SAMPLE_INSTRUMENT} missing after script load`)
      _samples = map
    }
  })()
  _loadPromise = promise
  // Reset on catch dla retry next click (Risk #1 + #7 mitigation).
  promise.catch(() => { _loadPromise = null })
  await promise
  if (!_ctx) throw new Error('[audio] context unavailable after load')
  return _ctx
}

// === Lazy decode per note (cached + memoized in-flight) ===
async function getBuffer(ctx: AudioContext, noteKey: string): Promise<AudioBuffer | null> {
  const cached = _buffers.get(noteKey)
  if (cached) return cached
  // In-flight memoize — concurrent clicks na tę samą nutę share single decode.
  const pending = _bufferPromises.get(noteKey)
  if (pending) return pending
  const promise = (async () => {
    const dataUrl = _samples?.[noteKey]
    if (!dataUrl) {
      // Note out of sample range (e.g., outside A0-C8). For guitar E2-E5 shouldn't happen.
      console.error(`[audio] no sample for note "${noteKey}"`)
      return null
    }
    const ab = dataUrlToArrayBuffer(dataUrl)
    const buffer = await ctx.decodeAudioData(ab)
    _buffers.set(noteKey, buffer)
    return buffer
  })()
  _bufferPromises.set(noteKey, promise)
  // Cleanup po success/fail — re-fetch dla unknown notes nie zostaje na zawsze zalokowane.
  promise.finally(() => { _bufferPromises.delete(noteKey) })
  return promise
}

// === Pure playback function ===
export async function playPitchedNote(
  ctx: AudioContext,
  pitched: PitchedNote,
  duration = 0.6,    // 600ms default (acoustic guitar pluck natural decay)
): Promise<void> {
  const noteKey = pitchedNoteToMidiKey(pitched)
  const buffer = await getBuffer(ctx, noteKey)
  if (!buffer) return  // silent fail dla missing sample (logged w getBuffer)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  const startTime = ctx.currentTime
  source.start(startTime)
  source.stop(startTime + duration)
}
