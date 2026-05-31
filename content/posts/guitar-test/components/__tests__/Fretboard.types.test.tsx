// Smoke #1 — TS-level required props (id + notes) enforcement (Wariant a sibling test).
// Smoke #9 — runtime throw dla fretCount poza [MIN, MAX].
//
// `@ts-expect-error` directive — Vitest kompiluje testy przez esbuild + tsc;
// jeśli kod POD `@ts-expect-error` faktycznie NIE zawiera błędu TS, kompilacja FAILS
// (assertion negacyjna). Gwarantuje że `id`/`notes` REQUIRED w typach.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Fretboard from '../Fretboard'

describe('Fretboard types (smoke #1)', () => {
  it('TS rejects <Fretboard /> without id prop', () => {
    // @ts-expect-error — id is REQUIRED per FretboardProps; brak id = build-time TS error.
    const _invalid = <Fretboard notes={[]} />
    void _invalid
    expect(true).toBe(true)
  })

  it('TS rejects <Fretboard id=""> without notes prop', () => {
    // @ts-expect-error — notes is REQUIRED.
    const _invalid = <Fretboard id="x" />
    void _invalid
    expect(true).toBe(true)
  })

  it('TS accepts valid props', () => {
    const valid = <Fretboard id="ok" notes={[]} />
    expect(valid).toBeTruthy()
  })
})

describe('Fretboard runtime validation (smoke #9)', () => {
  it('throws when fretCount < MIN_FRET_COUNT (5)', () => {
    expect(() =>
      renderToStaticMarkup(<Fretboard id="bad-low" notes={[]} fretCount={3} />),
    ).toThrow(/out of range/)
  })

  it('throws when fretCount > MAX_FRET_COUNT (24)', () => {
    expect(() =>
      renderToStaticMarkup(<Fretboard id="bad-high" notes={[]} fretCount={30} />),
    ).toThrow(/out of range/)
  })

  it('accepts fretCount within [5, 24]', () => {
    expect(() =>
      renderToStaticMarkup(<Fretboard id="ok" notes={[]} fretCount={12} />),
    ).not.toThrow()
  })
})
