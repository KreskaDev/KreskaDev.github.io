'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { EventStormingCanvas as CanvasType } from '@/content/posts/eventstorming-workshop/components/EventStormingCanvas'
import fullWall from '@/content/posts/eventstorming-workshop/components/initial-model.json'
import basicPattern from '@/content/posts/eventstorming-workshop/components/preset-basic-pattern.json'
import sagaChain from '@/content/posts/eventstorming-workshop/components/preset-saga-chain.json'
import type { InitialModel } from '@/content/posts/eventstorming-workshop/components/types'

// Sandbox PoC. compileMDX nie procesuje import statements w MDX (ADR-022/033),
// więc wrapper bake'uje wszystkie modele i exposuje przez `preset` prop.
const PRESETS: Record<string, InitialModel> = {
  'full-wall': fullWall as InitialModel,
  'basic-pattern': basicPattern as InitialModel,
  'saga-chain': sagaChain as InitialModel,
}

// Per-preset default heights — basic ma mniej lanes do pokazania, saga jest węższe.
const PRESET_HEIGHTS: Record<string, number> = {
  'full-wall': 720,
  'basic-pattern': 640, // rules lane (y=540) musi się zmieścić w viewport
  'saga-chain': 480, // tylko events + policies + ribbon, brak rules/aggregates
}

const CanvasInner = dynamic(
  () =>
    import('@/content/posts/eventstorming-workshop/components/EventStormingCanvas').then(
      m => m.EventStormingCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="my-6 h-[480px] animate-pulse rounded-lg bg-stone-100 dark:bg-stone-900" />
    ),
  }
)

type Props = Omit<ComponentProps<typeof CanvasType>, 'initial'> & {
  preset?: keyof typeof PRESETS
}

export default function LazyEventStormingCanvas({
  preset = 'full-wall',
  height,
  ...rest
}: Props) {
  const model = PRESETS[preset] ?? PRESETS['full-wall']!
  const resolvedHeight = height ?? PRESET_HEIGHTS[preset] ?? 600
  return <CanvasInner initial={model} height={resolvedHeight} {...rest} />
}
