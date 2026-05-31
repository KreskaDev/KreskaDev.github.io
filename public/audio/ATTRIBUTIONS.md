# Audio Sample Attributions

This blog uses pre-rendered MIDI.js soundfont samples for the Guitar Fretboard widget
(`<FretboardVisualizer />`), loaded at runtime from a public CDN.

## Samples

**acoustic_guitar_nylon-mp3** (GM Program 25 — Acoustic Guitar (Nylon))

- **Source:** https://github.com/gleitz/midi-js-soundfonts/tree/master/FluidR3_GM
- **Kit:** FluidR3_GM
- **Origin:** Generated from `FluidR3_GM.sf2` (FluidSynth project)
- **Author:** Benjamin Gleitzman (pre-rendering pipeline) + FluidR3_GM.sf2 community contributors
- **License:** Creative Commons Attribution 3.0 (CC-BY 3.0)
- **License URL:** https://creativecommons.org/licenses/by/3.0/

## Player

Custom mini-player (~80-110 LOC raw Web Audio API) lives w
`prod/content/posts/guitar-test/components/audio.ts`. No third-party library —
implementacja consumes Gleitzman MIDI.js sample format directly (base64-encoded MP3
data URLs per chromatic note, decoded via `AudioContext.decodeAudioData`, played via
`AudioBufferSourceNode`).

## How loading works

`audio.ts` `ensureAudio()` lazy injects `<script src="https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3.js">`
on first user click (autoplay policy compliance). Sample file ~1.84 MB; browser cache
reduces subsequent loads to ~0ms. Per-note `AudioBuffer` decoded lazy on first request
and cached for session.

See `adr/ADR-042-audio-playback-architecture.md` for vehicle decision rationale.
