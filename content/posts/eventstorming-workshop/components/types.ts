import type { Node, Edge } from '@xyflow/react'

export type StickyKind =
  | 'event' // pomarańczowy — Domain Event (past tense). Backbone timeline.
  | 'command' // niebieski — Command (imperative). Above its resulting event.
  | 'actor' // beige — User / Actor. Top row, above commands they invoke.
  | 'policy' // fioletowy — Reactive policy / Saga step. Between trigger event and resulting command.
  | 'aggregate' // BIG amber — Aggregate root. Below the events it owns.
  | 'rule' // pale yellow — Business rule / invariant. Below its aggregate.

// Decoration kinds — wizualne chrome (backbone, ribbon, dividers, labels) NIE są
// częścią modelu domenowego. Pre-promotion task (ADR-064): split na osobny DecorationNode
// discriminated union żeby Data shapes były type-safe. Sandbox: union string types tu starcza.
export type DecorationKind =
  | 'backbone-spine'
  | 'saga-ribbon'
  | 'context-divider'
  | 'context-label'

export type NodeKind = StickyKind | DecorationKind

export type StickyData = {
  label: string
  kind: StickyKind
}

export type StickyNode = Node<StickyData, NodeKind>
export type StickyEdge = Edge

export type ContextId = string

// timelineStep = pozycja na wspólnej oś czasu (events ↑1, rest dziedziczy ↑ lub jest fractional
// dla policies/aggregates pomiędzy events). Pojedynczy x-axis = całość czytania left-to-right.
export type RawNode = {
  id: string
  kind: StickyKind
  label: string
  timelineStep: number
}

export type RawEdge = {
  source: string
  target: string
  label?: string
}

// Bounded context = wertykalna pasmo nakładające się na timeline. Wyznaczone przez
// `boundaryAfterStep` — divider rysowany po tym timelineStep (lub przed startem dla pierwszego).
export type BoundedContext = {
  id: ContextId
  label: string
  startStep: number // pierwszy timelineStep tego kontekstu (inclusive)
  endStep: number // ostatni timelineStep (inclusive); używane do centrowania labela
}

// Saga ribbon — wizualne pasmo pod events spinające zakres jednej saga, opcjonalne.
export type SagaRibbon = {
  id: string
  label: string
  startStep: number
  endStep: number
  hueClass: string // Tailwind bg-* class do delikatnego tła (np. 'bg-purple-500/5')
}

export type InitialModel = {
  contexts: BoundedContext[]
  sagas?: SagaRibbon[]
  nodes: RawNode[]
  edges: RawEdge[]
}
