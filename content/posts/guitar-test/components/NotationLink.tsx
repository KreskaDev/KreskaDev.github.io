// NotationLink — generic multi-slot Pattern C cross-widget cursor wrapper (v5-17 per
// ADR-061, supersedes ADR-059 NotationScaleLink scoped).
//
// ARCHITECTURE: Server Component outer + Client Component inner split. SC walks children
// gdzie reference equality NA function refs przeżywa (mdx-components map → MDX render →
// NotationLink SC: jednorodne SC drzewo). CC inner odbiera serializable slot DATA (NIE
// JSX z function refs) i rekonstruuje children sam importując LazyNotation/LazyTablature/
// LazyScaleOnFretboard. Empirical discovery 2026-06-02 (Sesja 29): children walking w CC
// receiving from MDX (SC source) traci function-ref identity przez SC→CC boundary →
// "Found zero Notation" build failure. SC outer rozwiązuje, ponieważ walking happens
// PRZED SC→CC boundary encoding. Plan §6.1 LOCK amended (deviation udokumentowany).
//
// Wrapper-level chord-on-staff validation (carry-over Kolizja #2 mitigation z ADR-059):
// walk notes[] pre-render w SC, throw na pitch=NotePitch[]. Notation master w linked
// mode supports monophonic only; chord-on-tab demos używają standalone Tablature.
//
// Multi-instance guarantee: każdy wrapper Provider scope = osobny CC inner instance =
// osobny context state (zachowane carry-over).

import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import type { Note } from './types'
import NotationLinkInner, { type ChildSlot, type ChildRole } from './NotationLinkInner'
import LazyNotation from '@/components/lazy/LazyNotation'
import LazyTablature from '@/components/lazy/LazyTablature'
import LazyScaleOnFretboard from '@/components/lazy/LazyScaleOnFretboard'

export type NotationLinkProps = {
  id: string
  notes: Note[]
  children: ReactNode
  defaultBpm?: number
}

function detectRole(child: ReactElement<Record<string, unknown>>): ChildRole {
  if (child.type === LazyNotation) return 'notation'
  if (child.type === LazyTablature) return 'tablature'
  if (child.type === LazyScaleOnFretboard) return 'scale-on-fretboard'
  // displayName fallback dla MDX HOC wrap scenarios lub author direct-imports.
  const dn = (child.type as { displayName?: string }).displayName
  if (dn === 'Notation') return 'notation'
  if (dn === 'Tablature') return 'tablature'
  if (dn === 'ScaleOnFretboard') return 'scale-on-fretboard'
  return 'unknown'
}

export default function NotationLink(props: NotationLinkProps) {
  const { id, notes, children, defaultBpm } = props

  // Wrapper-level chord-on-staff validation (Kolizja #2 mitigation). Throw w SC =
  // visible w build/prerender output. Notation master w linked mode supports monophonic.
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!
    if (n.pitch && Array.isArray(n.pitch)) {
      throw new Error(
        `NotationLink "${id}": chord-on-staff Note at index ${i} rejected (pitch is array). ` +
          `Notation master in linked mode supports monophonic notes only. ` +
          `For chord-on-tab without Notation, use standalone <Tablature/>; ` +
          `or split chord across separate Note entries.`,
      )
    }
  }

  // Walk children w SC kontekście — function refs są real bo same-SC tree z MDX render.
  // Klasyfikacja do serializable slot data (role + props) przekazywane do CC inner.
  const childrenArr = Children.toArray(children).filter(isValidElement) as Array<
    ReactElement<Record<string, unknown>>
  >
  const slots: ChildSlot[] = childrenArr.map((child, idx) => ({
    role: detectRole(child),
    props: child.props,
    idx,
  }))

  const notationSlots = slots.filter((s) => s.role === 'notation')
  if (notationSlots.length === 0) {
    throw new Error(
      `NotationLink "${id}": requires exactly one Notation child as master. Found zero. ` +
        `Add <Notation/> to NotationLink children.`,
    )
  }
  if (notationSlots.length > 1) {
    throw new Error(
      `NotationLink "${id}": supports single Notation master (multi-notation linked mode out of scope v5-17). ` +
        `Found ${notationSlots.length}. Remove duplicate Notation children or split into separate NotationLink wrappers.`,
    )
  }

  return <NotationLinkInner id={id} notes={notes} slots={slots} defaultBpm={defaultBpm} />
}
