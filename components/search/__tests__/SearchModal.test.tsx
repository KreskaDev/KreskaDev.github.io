import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchModal } from '@/components/search/SearchModal'

// jsdom NIE implementuje HTMLDialogElement.showModal/close — polyfill manual.
// Local per-file (NIE globalny w vitest.setup.ts) — minimal blast radius.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  // Stub fetch dla /search-index.json.
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            slug: 'example',
            title: 'Example Post',
            summary: 'Test summary',
            tags: ['Example'],
            headings: ['Plain heading'],
          },
        ]),
    } as Response),
  )
})

describe('SearchModal', () => {
  it('pokazuje dialog gdy isOpen=true', () => {
    render(<SearchModal isOpen={true} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('ukryty gdy isOpen=false', () => {
    const { container } = render(<SearchModal isOpen={false} onClose={() => {}} />)
    // Closed <dialog> (bez `open`) jest hidden — RTL queryByRole nie znajdzie go.
    // Querujemy bezpośrednio przez DOM żeby zweryfikować że atrybut `open` jest unset.
    const dialog = container.querySelector('dialog')
    expect(dialog).not.toHaveAttribute('open')
  })

  it('pokazuje search input po open', async () => {
    render(<SearchModal isOpen={true} onClose={() => {}} />)
    const input = await screen.findByPlaceholderText('Search posts...')
    expect(input).toBeInTheDocument()
  })

  it('woła onClose po kliknięciu X', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SearchModal isOpen={true} onClose={onClose} />)
    const closeBtn = screen.getByLabelText('Close search')
    await user.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('lazy-load index na first open + renderuje results dla query', async () => {
    const user = userEvent.setup()
    render(<SearchModal isOpen={true} onClose={() => {}} />)
    const input = await screen.findByPlaceholderText('Search posts...')
    await user.type(input, 'example')
    await waitFor(() => {
      expect(screen.getByText('Example Post')).toBeInTheDocument()
    })
  })

  it('pokazuje error UI gdy fetch fails', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response))
    render(<SearchModal isOpen={true} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
    })
  })
})
