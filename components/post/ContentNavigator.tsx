'use client'

import { useEffect, useRef, useState } from 'react'
import { slugify } from '@/lib/slugify'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { ScrollProgress } from './ScrollProgress'

interface NavItem {
  id: string
  text: string
  level: 2 | 3 | 4
}

// `:not([data-toc-exclude] *)` excluduje wszystkie descendant heading'i wrappera
// oznaczonego `data-toc-exclude` (np. BayesAnalyzer `<h4>Sekwencja klinik</h4>` +
// `<h3 id="adv-modal-title">` w modal). `:not([data-toc-exclude])` excluduje
// wrapper jeśli ktoś dał atrybut bezpośrednio na headerze.
// CSS Selectors Level 4 supported w Chrome 88+, FF 84+, Safari 14+ (>99% market).
const HEADER_SELECTOR = [
  'article.prose h2:not([data-toc-exclude] *):not([data-toc-exclude])',
  'article.prose h3:not([data-toc-exclude] *):not([data-toc-exclude])',
  'article.prose h4:not([data-toc-exclude] *):not([data-toc-exclude])',
].join(', ')

// KaTeX renderuje math jako dwie reprezentacje DOM: `.katex-mathml`
// (MathML + LaTeX annotation źródło, dla screen readers) i `.katex-html`
// (visible HTML, aria-hidden="true"). `textContent` agreguje OBA →
// duplikowanie. Usuwamy `.katex-mathml` w klonie, zostawiamy `.katex-html`
// jako single canonical visible repr. Edge case: heading bez KaTeX →
// querySelectorAll zwraca pustą listę, no-op.
export function getHeadingText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.katex-mathml').forEach(n => n.remove())
  return clone.textContent?.trim() ?? ''
}

export function ContentNavigator() {
  const [items, setItems] = useState<NavItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [scrollPercent, setScrollPercent] = useState(0)
  const headersRef = useRef<HTMLElement[]>([])
  const reducedMotion = useReducedMotion()


  // Phase 1 — DOM query + MutationObserver dla dynamic content (Tabs swap,
  // BayesAnalyzer hydration). queryAndIndex jest idempotent: `el.id = candidate`
  // tylko gdy `!el.id` → mutation jednorazowa per element → MO callback restful
  // gdy nic się nie zmienia. rAF-debounce konsoliduje burst callbacków
  // z Recharts SVG animation ticks (review C1 mitigation).
  useEffect(() => {
    const queryAndIndex = () => {
      const headers = Array.from(
        document.querySelectorAll<HTMLElement>(HEADER_SELECTOR),
      )

      const seenIds = new Set<string>()
      const next: NavItem[] = []
      for (const el of headers) {
        if (!el.id) {
          const text = getHeadingText(el)
          if (!text) continue
          const base = slugify(text)
          if (!base) continue
          // Dedupe — jeśli candidate kolizja z istniejącym DOM id lub lokalnym
          // seenIds, append `-N` suffix. Hard cap 1000 jako safety net,
          // pętla i tak skończy się natychmiast w realnych przypadkach.
          let candidate = base
          let suffix = 0
          while (
            (seenIds.has(candidate) || document.getElementById(candidate)) &&
            suffix < 1000
          ) {
            suffix += 1
            candidate = `${base}-${suffix}`
          }
          el.id = candidate
        }
        if (seenIds.has(el.id)) continue
        seenIds.add(el.id)
        // Selector zapewnia h2/h3/h4 — narrowing przez tagName check, NIE
        // unsafe cast (review M7 mitigation).
        const tag = el.tagName
        const level: 2 | 3 | 4 =
          tag === 'H2' ? 2 : tag === 'H3' ? 3 : 4
        next.push({
          id: el.id,
          text: getHeadingText(el),
          level,
        })
      }
      headersRef.current = headers
      setItems(next)
    }

    queryAndIndex()

    const article = document.querySelector('article.prose')
    if (!article) return

    // rAF-debounce — Recharts SVG hydration + animation może emitować
    // 10+ MO callbacków per frame. Konsolidacja przez rAF gwarantuje max
    // 1 queryAndIndex per frame (review C1 mitigation).
    let raf: number | null = null
    const mutationObserver = new MutationObserver(() => {
      if (raf !== null) return
      raf = requestAnimationFrame(() => {
        raf = null
        queryAndIndex()
      })
    })
    mutationObserver.observe(article, { childList: true, subtree: true })
    return () => {
      mutationObserver.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  // Phase 2 — Shared rAF scroll handler obsługuje TRZY update'y:
  //   1. `scrollPercent` → ScrollProgress fill width
  //   2. `activeId` → highlight currently-active TOC link
  //   3. ResizeObserver na document.body — BayesAnalyzer Recharts hydration
  //      zmienia body height po initial paint (~100-300px SVG), bez tego
  //      scrollPercent stale + activeId stale dla deep-link landings
  //
  // Active highlight — **scroll-position-based**, NIE IntersectionObserver
  // Map-strategy (plan §"Active highlight" deviation D5, post-shipping user
  // feedback). Algorithm: activeId = ostatni header którego top edge zsunął
  // się NA LUB POWYŻEJ `TOP_NAV_OFFSET`. To eliminuje IO "gap problem" —
  // gdy user scrolluje przez treść między dwoma h2 sekcjami i żaden header
  // nie jest w IO hot zone [20%, 30%], poprzednio activeId=null
  // (cleaner-UX-decision per plan, ale empirycznie zła ciągłość).
  // Scroll-based daje continuous active: aktualna sekcja zawsze podświetlona.
  // Cost: O(headers) `getBoundingClientRect` per rAF tick — dla 25 headers
  // ~1-2ms na typowych devices, negligible. Early break gdy header jeszcze
  // poniżej offset (DOM order = visual order).
  useEffect(() => {
    // Single source of truth = `--top-nav-height` w globals.css. Czytamy
    // raz na mount przez getComputedStyle — jeśli CSS var się zmieni
    // (theme switch, future responsive TopNav), trzeba będzie re-read,
    // ale obecnie static value (ADR-017 h-16 = 64px + 16px breathing).
    // Fallback 80 dla jsdom (CSS NIE applied w testach) + SSR safety.
    const readTopNavOffset = (): number => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--top-nav-height')
        .trim()
      const parsed = parseFloat(raw)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 80
    }
    const topNavOffset = readTopNavOffset()

    let scheduled = false
    const recompute = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false

        const scrollable =
          document.documentElement.scrollHeight - window.innerHeight
        // Krótka strona (scrollHeight <= innerHeight) → 100% (graceful degrade).
        const pct =
          scrollable <= 0
            ? 100
            : Math.min(
                100,
                Math.max(
                  0,
                  Math.round((window.scrollY / scrollable) * 100),
                ),
              )
        setScrollPercent(pct)

        // Active = ostatni header passed offset. Iteracja DOM order; break
        // gdy header jeszcze poniżej offset (sorted by visual position).
        // +1 px tolerance bo `<=` z dokładnie offset bywa flaky przy
        // sub-pixel devicePixelRatio scaling.
        const headers = headersRef.current
        let nextActive: string | null = null
        for (const h of headers) {
          if (h.getBoundingClientRect().top <= topNavOffset + 1) {
            nextActive = h.id
          } else {
            break
          }
        }
        setActiveId(nextActive)
      })
    }
    window.addEventListener('scroll', recompute, { passive: true })
    const resizeObserver = new ResizeObserver(recompute)
    resizeObserver.observe(document.body)
    recompute() // initial sync — deep-link może wylądować w środku strony
    return () => {
      window.removeEventListener('scroll', recompute)
      resizeObserver.disconnect()
    }
  }, [items])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const anchor = e.currentTarget
    const href = anchor.getAttribute('href')
    if (!href?.startsWith('#')) return
    const id = href.slice(1)
    const target = document.getElementById(id)
    if (!target) return

    // KRYTYCZNE: preventDefault — bez tego browser-native anchor jump robi
    // instant scroll, racuje z naszym smooth scrollIntoView (double-scroll
    // glitch, v4 prompt iteration learning).
    e.preventDefault()
    // pushState nie scrolluje sam — synchronizuje URL hash bez triggering
    // native scroll. Brak popstate handler (task.md anti-deliverable) —
    // browser back/forward dla hash używa default behavior.
    history.pushState(null, '', '#' + id)
    target.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
    // A11y — keyboard user po smooth scroll powinien mieć focus w target
    // sekcji, nie zostać w nav (inaczej screen reader czyta dalej z TOC).
    // `tabindex=-1` programowo focusable bez tab-stop; `preventScroll`
    // żeby nie konkurować z naszym scrollIntoView. Headings są domyślnie
    // non-focusable — set tabindex tylko jeśli brak (zachowuje
    // pre-existing `tabindex="0"` jeśli ktoś go ustawił).
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1')
    }
    target.focus({ preventScroll: true })
  }

  // Mobile: pomijamy inline <details> oraz top bar gdy brak headerów (zero noise dla
  // short post). Desktop sticky sidebar zachowuje empty-state render (parity z existing
  // tests — `renderuje empty nav gdy article.prose nie ma headerów`).
  const hasItems = items.length > 0

  return (
    <>
      {/* Mobile thin top bar ScrollProgress — ambient signal pod TopNav (z-40 < dialog z-50+).
          h-0.5 = 2px niewidoczna gdy 0%, nie wpływa na layout. */}
      {hasItems && (
        <div
          className="min-[1100px]:hidden fixed top-16 left-0 right-0 h-0.5 z-40 bg-border pointer-events-none"
          aria-hidden
        >
          <div
            className={[
              'h-full bg-accent',
              reducedMotion ? '' : 'transition-[width] duration-100 ease-out',
            ].join(' ')}
            style={{ width: `${scrollPercent}%` }}
          />
        </div>
      )}

      {/* Mobile inline <details> TOC — pre-prose pozycja, collapsed default.
          Native a11y `aria-expanded` przez <summary>; zero JS overhead. */}
      {hasItems && (
        <details
          aria-label="Mobile table of contents"
          className="min-[1100px]:hidden not-prose my-6 border border-border rounded-lg bg-bg-secondary"
        >
          <summary className="cursor-pointer list-none px-4 py-3 font-sans text-sm font-medium text-text-primary flex items-center justify-between min-h-11">
            <span>Spis treści</span>
            <span aria-hidden className="text-text-tertiary">▾</span>
          </summary>
          <ol className="list-none p-0 m-0 px-4 pb-4 space-y-1 text-sm font-sans">
            {items.map(item => {
              const isActive = item.id === activeId
              const indent =
                item.level === 2 ? 'pl-0' : item.level === 3 ? 'pl-3' : 'pl-6'
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={handleClick}
                    aria-current={isActive ? 'location' : undefined}
                    className={[
                      'block py-2 transition-colors min-h-11',
                      indent,
                      isActive
                        ? 'text-accent font-medium'
                        : 'text-text-secondary hover:text-text-primary',
                    ].join(' ')}
                  >
                    {item.text}
                  </a>
                </li>
              )
            })}
          </ol>
        </details>
      )}

      {/* Desktop sticky sidebar — existing rendering, niezmienione semantycznie. */}
      <nav
        aria-label="Table of contents"
        className={[
          // Tailwind 4 arbitrary breakpoint — 1100px nie pasuje do default
          // sm/md/lg/xl/2xl. Plan §"Layout & breakpointy" + ADR-014.
          'hidden min-[1100px]:flex',
          'fixed top-24 right-8',
          'w-60 max-h-[calc(100vh-160px)]',
          'overflow-y-auto',
          'text-sm font-sans',
          'border-l border-border pl-4',
          'flex-col gap-2',
        ].join(' ')}
      >
        <ol className="space-y-1 list-none p-0 m-0 flex-1">
          {items.map(item => {
            const isActive = item.id === activeId
            const indent =
              item.level === 2 ? 'pl-3' : item.level === 3 ? 'pl-6' : 'pl-9'
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={handleClick}
                  aria-current={isActive ? 'location' : undefined}
                  className={[
                    'block py-1 transition-colors',
                    indent,
                    isActive
                      ? 'text-accent font-medium border-l-2 border-accent -ml-px'
                      : 'text-text-secondary hover:text-text-primary border-l-2 border-transparent -ml-px',
                  ].join(' ')}
                >
                  {item.text}
                </a>
              </li>
            )
          })}
        </ol>
        <ScrollProgress percent={scrollPercent} reducedMotion={reducedMotion} />
      </nav>
    </>
  )
}
