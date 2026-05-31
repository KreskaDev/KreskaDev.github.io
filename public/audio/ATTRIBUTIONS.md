# Audio Sample Attributions

This blog uses pre-rendered MIDI.js soundfont samples for the Guitar Fretboard widget
(`<FretboardVisualizer />`), loaded at runtime from a public CDN.

## Samples

**acoustic_guitar_nylon-mp3** (GM Program 25 — Acoustic Guitar (Nylon))

- **Source:** https://github.com/gleitz/midi-js-soundfonts/tree/master/FatBoy
- **Kit:** FatBoy
- **Origin:** Generated from FatBoy soundfont (community pre-rendering pipeline)
- **Author:** Benjamin Gleitzman (pre-rendering pipeline) + FatBoy soundfont contributors
- **License:** Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0)
- **License URL:** https://creativecommons.org/licenses/by-sa/3.0/

## Player

Custom mini-player (~140 LOC raw Web Audio API) lives w
`prod/content/posts/guitar-test/components/audio.ts`. No third-party library —
implementacja consumes Gleitzman MIDI.js sample format directly (base64-encoded MP3
data URLs per chromatic note, decoded via `AudioContext.decodeAudioData`, played via
`AudioBufferSourceNode`).

## How loading works

`audio.ts` `ensureAudio()` lazy injects `<script src="https://gleitz.github.io/midi-js-soundfonts/FatBoy/acoustic_guitar_nylon-mp3.js">`
on first user click (autoplay policy compliance). Sample file ~1.9 MB; browser cache
reduces subsequent loads to ~0ms. Per-note `AudioBuffer` decoded lazy on first request
and cached for session.

See `adr/ADR-042-audio-playback-architecture.md` for vehicle decision rationale.
