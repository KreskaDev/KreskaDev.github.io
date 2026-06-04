import type { StickyNode, RawNode, BoundedContext, SagaRibbon } from './types'

// Layout canonical EventStorming Big Picture (Brandolini "Introducing EventStorming" §3+§5):
// X-axis = chronologia events. Y-axis = kind lane. Backbone events tworzy podświetloną
// pomarańczową taśmę środkową; commands/actors nad nią, policies/aggregates/rules pod.
// Bounded contexts = wertykalne dashed dividery nakładające się na timeline (NIE kolumny).
const LANE_Y = {
  actor: 0,
  command: 90,
  event: 200, // backbone — wizualnie wyróżnione (orange spine border w canvas styling)
  policy: 310,
  aggregate: 420,
  rule: 540,
} as const

const STEP_X = 110 // pixele per timelineStep — 11 events mieści się w 1280px viewport @ zoom 0.85
const TIMELINE_OFFSET_X = 60 // margines od lewej (dla context label etc.)

export const STEP_X_GAP = STEP_X
export const TIMELINE_OFFSET = TIMELINE_OFFSET_X
export const LANES = LANE_Y

// Wysokość pełnego canvasu — od top actor lane do bottom rule lane + space na karty.
const CHART_HEIGHT = 660

function stepToX(step: number): number {
  return TIMELINE_OFFSET_X + step * STEP_X
}

// Sticky cards — pozycje deterministycznie z timelineStep + kind lane.
export function layoutNodes(raw: RawNode[]): StickyNode[] {
  return raw.map(n => ({
    id: n.id,
    type: n.kind,
    position: {
      x: stepToX(n.timelineStep),
      y: LANE_Y[n.kind],
    },
    data: { kind: n.kind, label: n.label },
  }))
}

// Vertical dashed dividery — między kontekstami. Pozycja x = midpoint między endStep
// poprzedniego kontekstu a startStep następnego. NIE rysujemy dividera przed pierwszym
// ani po ostatnim kontekście.
export function buildContextDividers(contexts: BoundedContext[]): StickyNode[] {
  const sorted = [...contexts].sort((a, b) => a.startStep - b.startStep)
  const out: StickyNode[] = []

  // Label dla każdego kontekstu — placed na top, centered nad event range
  for (const ctx of sorted) {
    const centerStep = (ctx.startStep + ctx.endStep) / 2
    out.push({
      id: `ctx-label-${ctx.id}`,
      type: 'context-label',
      position: { x: stepToX(centerStep) - 70, y: -40 },
      data: {
        label: ctx.label,
        kind: 'event',
      } as unknown as StickyNode['data'],
      selectable: false,
      draggable: false,
    })
  }

  // Dividery — pomiędzy kolejnymi kontekstami
  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i]
    const right = sorted[i + 1]
    if (!left || !right) continue
    const dividerStep = (left.endStep + right.startStep) / 2
    out.push({
      id: `ctx-divider-${left.id}-${right.id}`,
      type: 'context-divider',
      position: { x: stepToX(dividerStep) - 1, y: -50 },
      data: {
        kind: 'event',
        height: CHART_HEIGHT,
      } as unknown as StickyNode['data'],
      selectable: false,
      draggable: false,
    })
  }

  return out
}

// Backbone spine — pomarańczowe pasmo pod event lane spanned across całą timeline.
// Wizualna dominacja eventów (Brandolini "the spine") + sygnał że to JEDEN ciągły flow,
// nie pojedyncze izolowane events.
export function buildBackboneSpine(contexts: BoundedContext[]): StickyNode[] {
  if (contexts.length === 0) return []
  const sorted = [...contexts].sort((a, b) => a.startStep - b.startStep)
  const firstStep = sorted[0]!.startStep
  const lastStep = sorted[sorted.length - 1]!.endStep
  const x = stepToX(firstStep) - 40
  const width = stepToX(lastStep) + 140 - x
  return [
    {
      id: 'backbone-spine',
      type: 'backbone-spine',
      position: { x, y: LANE_Y.event - 28 },
      data: {
        kind: 'event',
        width,
      } as unknown as StickyNode['data'],
      selectable: false,
      draggable: false,
    },
  ]
}

// Saga ribbons — horyzontalne tinted pasma pod backbone events spinające zakres jednej saga.
// Renderowane jako pierwsze (na samym dnie z-order) żeby leżały pod stickies.
export function buildSagaRibbons(sagas: SagaRibbon[] | undefined): StickyNode[] {
  if (!sagas) return []
  return sagas.map((s, idx) => {
    const x = stepToX(s.startStep) - 30
    const width = stepToX(s.endStep) + 130 - x // +130 covers width of last event card
    return {
      id: `saga-ribbon-${s.id}`,
      type: 'saga-ribbon',
      // Ribbon BELOW backbone spine — w gap między events (y=200, h=70) a policies (y=310).
      // Reviewer iter: "ribbon at LANE_Y.event + 50, in the gap between events and policies".
      position: { x, y: LANE_Y.event + 80 + idx * 8 }, // stack lekko gdy multiple sagas
      data: {
        kind: 'event',
        label: s.label,
        width,
        hueClass: s.hueClass,
      } as unknown as StickyNode['data'],
      selectable: false,
      draggable: false,
    }
  })
}
