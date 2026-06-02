'use client'

// GeneratedTablature — cienki wrapper aplikujący `generateTabPositions` na input notes
// przed delegacją do Tablature. Pure pass-through dla wszystkich pozostałych props.
// Ma sens jako MDX-friendly demo path: autor pisze pitch-only Note[], wrapper uruchamia
// CSP solver przy render, Tablature dostaje Note[] z derived positions = consumer
// kontrakt z v5-17 unchanged (per ADR-060 + ADR-063 idempotency invariant).
//
// useMemo na generator output bo Note[] reference może oscylować przy parent re-render,
// a generator output jest deterministyczny per input — memo eliminuje redundant work.

import { useMemo } from 'react'
import Tablature, { type TablatureProps } from './Tablature'
import { generateTabPositions, type TabGeneratorOptions } from './tab-generator'

export type GeneratedTablatureProps = TablatureProps & {
  generatorOptions?: Omit<TabGeneratorOptions, 'tuning' | 'maxFret'>
}

export default function GeneratedTablature(props: GeneratedTablatureProps) {
  const { notes, tuning, maxFret, generatorOptions, ...rest } = props

  const derivedNotes = useMemo(
    () => generateTabPositions(notes, { tuning, maxFret, ...generatorOptions }),
    [notes, tuning, maxFret, generatorOptions],
  )

  return <Tablature {...rest} notes={derivedNotes} tuning={tuning} maxFret={maxFret} />
}
