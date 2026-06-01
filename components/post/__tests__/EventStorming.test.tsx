import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EventStorming, {
  type StickyNote,
  type StickyType,
} from '../EventStorming'

const allTypes: StickyType[] = [
  'event',
  'command',
  'aggregate',
  'actor',
  'policy',
  'readmodel',
  'external',
  'hotspot',
]

describe('EventStorming', () => {
  it('(a) renders single event w timeline z event color class', () => {
    const { container } = render(
      <EventStorming notes={[{ type: 'event', label: 'Member registered' }]} />,
    )
    const sticky = screen.getByLabelText('Event: Member registered')
    expect(sticky).toBeTruthy()
    // Class string zawiera CSS var binding dla event bg/border per STYLE_MAP.
    expect(sticky.className).toContain('bg-[var(--es-event-bg)]')
    expect(sticky.className).toContain('border-[var(--es-event-border)]')
    // Smoke: tylko jedna sticky karta w outer figure.
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(1)
  })

  it('(b) wszystkie 8 typów renderują się bez crash', () => {
    const notes: StickyNote[] = allTypes.map((t) => ({ type: t, label: `${t} sample` }))
    render(<EventStorming notes={notes} />)
    for (const t of allTypes) {
      const labelPrefix = {
        event: 'Event',
        command: 'Command',
        aggregate: 'Aggregate',
        actor: 'Actor',
        policy: 'Policy',
        readmodel: 'Read Model',
        external: 'External',
        hotspot: 'Hot Spot',
      }[t]
      expect(screen.getByLabelText(`${labelPrefix}: ${t} sample`)).toBeTruthy()
    }
  })

  it('(c) grid layout z x/y → inline style.gridColumnStart i gridRowStart', () => {
    const { container } = render(
      <EventStorming
        layout="grid"
        notes={[
          { type: 'event', label: 'A', x: 2, y: 1 },
          { type: 'aggregate', label: 'B', x: 0, y: 3 },
        ]}
      />,
    )
    // Każda sticky żyje w cell-wrapper z inline style.
    const wrappers = container.querySelectorAll('.es-canvas .grid > div')
    expect(wrappers).toHaveLength(2)
    const first = wrappers[0] as HTMLElement
    const second = wrappers[1] as HTMLElement
    expect(first.style.gridColumnStart).toBe('3')
    expect(first.style.gridRowStart).toBe('2')
    expect(second.style.gridColumnStart).toBe('1')
    expect(second.style.gridRowStart).toBe('4')
    // Outer grid wrapper z gridTemplateColumns repeating po maxX+1.
    const gridRoot = container.querySelector('.es-canvas .grid') as HTMLElement
    expect(gridRoot.style.gridTemplateColumns).toBe('repeat(3, 160px)')
    expect(gridRoot.style.gridTemplateRows).toBe('repeat(4, 100px)')
  })

  it('(d) timeline grouping: events w events-row, commands w commands-row', () => {
    const { container } = render(
      <EventStorming
        notes={[
          { type: 'event', label: 'E1' },
          { type: 'command', label: 'C1' },
          { type: 'event', label: 'E2' },
        ]}
      />,
    )
    const eventsRow = container.querySelector('.es-row-events')
    const commandsRow = container.querySelector('.es-row-commands')
    expect(eventsRow).toBeTruthy()
    expect(commandsRow).toBeTruthy()
    expect(eventsRow!.textContent).toContain('E1')
    expect(eventsRow!.textContent).toContain('E2')
    expect(eventsRow!.textContent).not.toContain('C1')
    expect(commandsRow!.textContent).toContain('C1')
    expect(commandsRow!.textContent).not.toContain('E1')
  })

  it('(e) empty notes=[] + caption → figure z just caption (no rows rendered)', () => {
    const { container } = render(
      <EventStorming notes={[]} caption="Empty diagram" />,
    )
    expect(screen.getByText('Empty diagram')).toBeTruthy()
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(0)
    expect(container.querySelector('.es-row-events')).toBeNull()
    expect(container.querySelector('.es-row-commands')).toBeNull()
  })

  it('(f) aria-label synthesis matches sample format', () => {
    render(
      <EventStorming
        notes={[
          { type: 'event', label: 'Member registered' },
          { type: 'event', label: 'Book searched' },
          { type: 'command', label: 'Register member' },
        ]}
      />,
    )
    const fig = screen.getByRole('group')
    expect(fig.getAttribute('aria-label')).toBe(
      'EventStorming diagram. Events: Member registered, Book searched. Commands: Register member.',
    )
  })

  it('(g) caption override default ariaLabel synthesis', () => {
    render(
      <EventStorming
        caption="Library Big Picture"
        notes={[{ type: 'event', label: 'X' }]}
      />,
    )
    const fig = screen.getByRole('group')
    expect(fig.getAttribute('aria-label')).toBe('Library Big Picture')
  })

  it('(h) sticky aria-label zawiera type-prefix', () => {
    render(
      <EventStorming
        notes={[
          { type: 'event', label: 'Member registered' },
          { type: 'command', label: 'Register member' },
          { type: 'hotspot', label: 'What if no payment?' },
        ]}
      />,
    )
    expect(screen.getByLabelText('Event: Member registered')).toBeTruthy()
    expect(screen.getByLabelText('Command: Register member')).toBeTruthy()
    expect(screen.getByLabelText('Hot Spot: What if no payment?')).toBeTruthy()
  })

  it("(i) RSC compatibility — source file NIE zawiera 'use client'", () => {
    const source = readFileSync(
      resolve(__dirname, '..', 'EventStorming.tsx'),
      'utf8',
    )
    expect(source.includes("'use client'")).toBe(false)
    expect(source.includes('"use client"')).toBe(false)
  })

  it('(j) edge case notes=[] + brak caption → aria-label = "EventStorming diagram (empty)."', () => {
    render(<EventStorming notes={[]} />)
    const fig = screen.getByRole('group')
    expect(fig.getAttribute('aria-label')).toBe('EventStorming diagram (empty).')
  })
})
