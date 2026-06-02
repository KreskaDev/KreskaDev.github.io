'use client'

// NotationScaleLink — @deprecated since v5-17 (ADR-061 supersedes ADR-059).
// Backward-compat adapter wrapper. Maps shipped v5-16.2 flat-prop API → new NotationLink
// multi-slot children API. Zero-break invariant dla v5-16.2 demos D9-D10.
//
// MDX migration recommendation:
//   v5-16.2: <NotationScaleLink id="x" notes={n} rootNote="C" tuning={DROP_D}/>
//   v5-17+:  <NotationLink id="x" notes={n}>
//              <Notation/>
//              <ScaleOnFretboard rootNote="C" tuning="Drop D"/>
//            </NotationLink>
// Oba style działają; v5-17+ generic, multi-passive ready.
//
// Outer `<div data-notation-scale-link-id={id}>` zachowane dla zero-break:
// v5-16.2 demos D9-D10 + shipped NotationScaleLink.test.tsx asercje na ten attribute.
// NotationLink.tsx rootuje własne `<div data-notation-link-id={id}>` — adapter
// owija je extra div'em (acceptable cost dla backward-compat invariant).

import type { ReactElement } from 'react'
import LazyNotation from '@/components/lazy/LazyNotation'
import LazyScaleOnFretboard from '@/components/lazy/LazyScaleOnFretboard'
import NotationLink from './NotationLink'
import type { Note, NoteName, Tuning, TimeSignature, KeySignature } from './types'
import { resolveTuning, type TuningName } from './tunings'

export type NotationScaleLinkProps = {
  id: string
  notes: Note[]
  timeSignature?: TimeSignature
  keySignature?: KeySignature
  rootNote?: NoteName
  tuning?: Tuning | TuningName
  fretCount?: number
  showArrows?: boolean
  showDegrees?: boolean
  defaultBpm?: number
  enableAudio?: boolean
}

/** @deprecated since v5-17 (ADR-061). Use NotationLink z multi-slot children API. */
export default function NotationScaleLink(props: NotationScaleLinkProps): ReactElement {
  const {
    id,
    notes,
    timeSignature,
    keySignature,
    rootNote,
    tuning,
    fretCount,
    showArrows,
    showDegrees,
    defaultBpm,
    enableAudio,
  } = props
  // Resolve tuning union → Tuning literal dla ScaleOnFretboard (które accepts tylko Tuning).
  // v5-16.2 demos D9-D10 NIE używają tuning → undefined → pass-through. Future author
  // writing `<NotationScaleLink tuning="Drop D"/>` ok via resolveTuning ADR-062 path.
  const resolvedTuning = tuning !== undefined ? resolveTuning(tuning) : undefined
  return (
    <div data-notation-scale-link-id={id}>
      <NotationLink id={id} notes={notes} defaultBpm={defaultBpm}>
        <LazyNotation
          id={`${id}-notation`}
          notes={notes}
          timeSignature={timeSignature}
          keySignature={keySignature}
          enableAudio={enableAudio}
        />
        <LazyScaleOnFretboard
          id={`${id}-fretboard`}
          notes={notes}
          rootNote={rootNote}
          tuning={resolvedTuning}
          fretCount={fretCount}
          showArrows={showArrows}
          showDegrees={showDegrees}
        />
      </NotationLink>
    </div>
  )
}
