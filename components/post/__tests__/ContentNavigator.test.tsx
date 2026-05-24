import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentNavigator, getHeadingText } from '../ContentNavigator'

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

  it('click handler — preventDefault + history.pushState + scrollIntoView + focus target', async () => {
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
    // A11y focus management — tabindex=-1 ustawiony, target ma focus
    expect(target?.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(target)
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

  it('getHeadingText — plain text heading unchanged (regression check)', () => {
    const h2 = document.createElement('h2')
    h2.textContent = '1. Cztery zmienne losowe'
    expect(getHeadingText(h2)).toBe('1. Cztery zmienne losowe')
  })

  it('getHeadingText — KaTeX heading deduplicates do single repr', () => {
    // Minimalna replikacja KaTeX DOM (z `rehype-katex` build-time output).
    // `.katex-mathml` ma MathML symboles + LaTeX annotation source ("P(E=1)"
    // dwa razy w tym poddrzewie) — całe poddrzewo do usunięcia. Zostaje
    // `.katex-html` jako single visible repr.
    const h2 = document.createElement('h2')
    h2.innerHTML =
      '5. Marginalne ' +
      '<span class="katex">' +
      '<span class="katex-mathml">' +
      '<math><semantics><annotation encoding="application/x-tex">P(E=1)</annotation></semantics></math>' +
      '</span>' +
      '<span class="katex-html" aria-hidden="true"><span class="base">P(E=1)</span></span>' +
      '</span>'
    expect(getHeadingText(h2)).toBe('5. Marginalne P(E=1)')
  })

  it('active highlight follows scroll position — ostatni header above offset jest active', () => {
    mountArticle(
      '<h2 id="first">First</h2><h2 id="second">Second</h2><h2 id="third">Third</h2>',
    )
    // Stub per-heading getBoundingClientRect — jsdom domyślnie zwraca
    // zera dla wszystkich. Offset w komponencie = 80 + 1 = 81.
    // First/Second passed (top <= 81), Third NIE → active = Second.
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>('article.prose h2'),
    )
    const tops = [10, 50, 200]
    headings.forEach((h, i) => {
      h.getBoundingClientRect = () =>
        ({ top: tops[i], left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    })

    render(<ContentNavigator />)

    // Sync rAF stub powoduje że initial recompute() w useEffect odpaliło się
    // synchronously już podczas render — activeId jest set.
    const nav = getNav()
    expect(within(nav).getByText('Second').closest('a')).toHaveAttribute(
      'aria-current',
      'location',
    )
    expect(within(nav).getByText('First').closest('a')).not.toHaveAttribute(
      'aria-current',
    )
    expect(within(nav).getByText('Third').closest('a')).not.toHaveAttribute(
      'aria-current',
    )
  })
})
