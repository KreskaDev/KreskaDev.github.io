import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tabs, TabItem } from '../Tabs'
import type { TabDescriptor } from '../Tabs'

// jsdom NIE implementuje HTMLElement.scrollIntoView — Tabs `useEffect [active]`
// (v5-08 scrollIntoView dla mobile scrollable tablist) by crashował testy.
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

const SAMPLE_TABS: TabDescriptor[] = [
  { id: 'a', title: 'Tab A', tagline: 'Alpha' },
  { id: 'b', title: 'Tab B', tagline: 'Beta' },
]

afterEach(() => {
  window.history.replaceState(null, '', '#')
})

function setup(extraProps?: { hashSync?: boolean }) {
  return render(
    <Tabs tabs={SAMPLE_TABS} ariaLabel="Test tabs" {...(extraProps ?? {})}>
      <TabItem id="a">
        <p>Content A</p>
      </TabItem>
      <TabItem id="b">
        <p>Content B</p>
      </TabItem>
    </Tabs>,
  )
}

describe('Tabs', () => {
  it('renderuje tablist z jedną zakładką per descriptor', () => {
    setup()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: /Tab A/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Tab B/ })).toBeInTheDocument()
  })

  it('pierwsza zakładka jest aktywna domyślnie', () => {
    setup()
    expect(screen.getByRole('tab', { name: /Tab A/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Content A')).toBeInTheDocument()
    expect(screen.queryByText('Content B')).not.toBeInTheDocument()
  })

  it('klik przełącza aktywny panel', () => {
    setup()
    fireEvent.click(screen.getByRole('tab', { name: /Tab B/ }))
    expect(screen.getByRole('tab', { name: /Tab B/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Content B')).toBeInTheDocument()
    expect(screen.queryByText('Content A')).not.toBeInTheDocument()
  })

  it('TabItem poza Tabs zwraca null', () => {
    const { container } = render(
      <TabItem id="a">
        <p>standalone</p>
      </TabItem>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('hashSync: URL hash aktywuje pasujący tab przy mount', () => {
    window.history.replaceState(null, '', '#b')
    setup({ hashSync: true })
    expect(screen.getByRole('tab', { name: /Tab B/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Content B')).toBeInTheDocument()
  })

  it('hashSync=false: URL hash jest ignorowany', () => {
    window.history.replaceState(null, '', '#b')
    setup({ hashSync: false })
    expect(screen.getByRole('tab', { name: /Tab A/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Content A')).toBeInTheDocument()
  })

  it('TabItem z id który nie ma odpowiednika w tabs nie renderuje się', () => {
    // Defensywne: gdy author zostawi orphan TabItem (typo w id), nie renderuje content.
    render(
      <Tabs tabs={SAMPLE_TABS} ariaLabel="Test">
        <TabItem id="orphan">
          <p>Orphan content</p>
        </TabItem>
      </Tabs>,
    )
    expect(screen.queryByText('Orphan content')).not.toBeInTheDocument()
  })
})
