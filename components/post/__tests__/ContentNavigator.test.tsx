import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentNavigator } from '../ContentNavigator'

// Sync rAF — żeby scroll-handler initial sync był obserwowalny w tym samym
// micro-tasku co render.
function stubRafSync() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    cb(0)
    return 0
  })
}

// jsdom nie implementuje scrollIntoView na HTMLElement — wymagany dla click
// handler test (Test 4). Stub per-test.
function stubScrollIntoView() {
  HTMLElement.prototype.scrollIntoView = vi.fn()
}

beforeEach(() => {
  stubRafSync()
  stubScrollIntoView()
  vi.stubGlobal('scrollTo', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function mountArticle(html: string) {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = `<article class="prose">${html}</article>`
  document.body.appendChild(wrapper)
}

function getNav() {
  return screen.getByRole('navigation', { name: 'Table of contents' })
}

describe('ContentNavigator', () => {
  it('renderuje empty nav gdy article.prose nie ma headerów', () => {
    mountArticle('<p>No headings here.</p>')
    render(<ContentNavigator />)
    const nav = getNav()
    expect(nav).toBeInTheDocument()
    const items = nav.querySelectorAll('li')
    expect(items.length).toBe(0)
  })

  it('renderuje h2/h3 z correct indent levels', () => {
    mountArticle('<h2 id="alpha">Alpha</h2><h3 id="beta">Beta</h3>')
    render(<ContentNavigator />)
    const nav = getNav()
    const alpha = within(nav).getByText('Alpha').closest('a')
    const beta = within(nav).getByText('Beta').closest('a')
    expect(alpha?.getAttribute('href')).toBe('#alpha')
    expect(beta?.getAttribute('href')).toBe('#beta')
    // h2 = pl-0, h3 = pl-3, h4 = pl-6
    expect(alpha?.className).toContain('pl-0')
    expect(beta?.className).toContain('pl-3')
  })

  it('fallback id generator slugify dla heading bez id', () => {
    mountArticle('<h2>No id heading</h2>')
    render(<ContentNavigator />)
    const nav = getNav()
    const link = within(nav).getByText('No id heading').closest('a')
    // slugify('No id heading') = 'no-id-heading'
    expect(link?.getAttribute('href')).toBe('#no-id-heading')
    // Runtime mutation — DOM element ma teraz id
    const heading = document.querySelector('article.prose h2')
    expect(heading?.id).toBe('no-id-heading')
  })

  it('click handler — preventDefault + history.pushState + scrollIntoView', async () => {
    mountArticle('<h2 id="target-section">Target</h2>')
    const pushStateSpy = vi.spyOn(history, 'pushState')
    const user = userEvent.setup()
    render(<ContentNavigator />)
    const nav = getNav()
    const link = within(nav).getByText('Target').closest('a') as HTMLAnchorElement
    await user.click(link)
    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '#target-section')
    const target = document.getElementById('target-section')
    expect(target?.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })
    pushStateSpy.mockRestore()
  })

  it('[data-toc-exclude] excluduje descendant headers', () => {
    mountArticle(
      '<h2 id="visible">Visible</h2>' +
        '<div data-toc-exclude><h3 id="hidden">Hidden</h3></div>',
    )
    render(<ContentNavigator />)
    const nav = getNav()
    expect(within(nav).queryByText('Visible')).toBeInTheDocument()
    expect(within(nav).queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('active highlight via IntersectionObserver callback', () => {
    let ioCallback: IntersectionObserverCallback | null = null
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          ioCallback = cb
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
      },
    )

    mountArticle('<h2 id="first">First</h2><h2 id="second">Second</h2>')
    render(<ContentNavigator />)

    const secondHeader = document.getElementById('second') as HTMLElement
    act(() => {
      ioCallback?.(
        [
          {
            target: secondHeader,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })

    const nav = getNav()
    const secondLink = within(nav).getByText('Second').closest('a')
    expect(secondLink).toHaveAttribute('aria-current', 'location')
    const firstLink = within(nav).getByText('First').closest('a')
    expect(firstLink).not.toHaveAttribute('aria-current')
  })
})
