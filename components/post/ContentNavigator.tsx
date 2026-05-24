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

export function ContentNavigator() {
  const [items, setItems] = useState<NavItem[]>([])
  const [observedActiveId, setObservedActiveId] = useState<string | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const [scrollPercent, setScrollPercent] = useState(0)
  const headersRef = useRef<HTMLElement[]>([])
  const visibleRef = useRef(new Map<Element, boolean>())
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
          const text = el.textContent?.trim() ?? ''
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
          text: el.textContent?.trim() ?? '',
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

  // Phase 2 — IntersectionObserver Map-strategy. Powód iteracji w DOM-order
  // i wyboru LAST visible (nie naiwnego `entries.filter(...).pop()`): czytelnik
  // scrolluje top→bottom; ostatni visible header w DOM-order jest tym, który
  // JEST w tej chwili najgłębiej w viewport. Naiwny pop flickeruje przy szybkim
  // scrollu (task.md §"IntersectionObserver entries semantics").
  useEffect(() => {
    const headers = headersRef.current
    if (headers.length === 0) return

    // Wyczyść stale Element references + reset observedActiveId — Tabs swap
    // wymienia headery, stara Map zachowywała keys do unmount'owanych nodes
    // (memory leak po wielu tab swap'ach). Plus jeśli wcześniejszy IO miał
    // pending microtask które wpłyną na visibleRef po clear(), reset
    // observedActiveId zapobiega briefnemu stale active-link state (race
    // window 1 frame, post-review iter 2 polish).
    visibleRef.current.clear()
    setObservedActiveId(null)

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          visibleRef.current.set(entry.target, entry.isIntersecting)
        }
        let active: HTMLElement | null = null
        for (const h of headers) {
          if (visibleRef.current.get(h)) active = h
        }
        setObservedActiveId(active?.id ?? null)
      },
      {
        // Aktywacja gdy header dotknie ~20% od top viewport;
        // deaktywacja gdy schodzi do ~30% od top. Net: zone [20%, 30%].
        rootMargin: '-20% 0px -70% 0px',
      },
    )
    headers.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [items])

  // Phase 3 — Shared rAF scroll handler. Jeden listener obsługuje
  // scrollPercent (→ ScrollProgress) + isAtBottom (→ derived activeId).
  // ResizeObserver na document.body kompensuje BayesAnalyzer Recharts hydration
  // (SVG renderuje się async, dodaje ~100-300px do scrollHeight po initial paint).
  useEffect(() => {
    let scheduled = false
    const recompute = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight
        // Krótka strona (scrollHeight <= innerHeight) → 100% (graceful degrade).
        const pct =
          scrollable <= 0
            ? 100
            : Math.min(
                100,
                Math.max(0, Math.round((window.scrollY / scrollable) * 100)),
              )
        setScrollPercent(pct)
        // 10px tolerance dla sub-pixel rounding artifacts.
        setIsAtBottom(
          window.scrollY + window.innerHeight >=
            document.documentElement.scrollHeight - 10,
        )
        scheduled = false
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
  }, [])

  // Derived state — eliminacja race condition między IO i scroll listener.
  // Storage state dla `activeId` z dwóch źródeł (IO + scroll) flickeruje 1-2
  // frame przy bottom. Derived = pure recompute per render, no race.
  // Czytamy z `items` (state), nie `headersRef.current` — React 19
  // `react-hooks/refs` zabrania refs access during render; semantycznie
  // identyczne, bo items[last].id pochodzi z tego samego headers array.
  const lastItemId = items[items.length - 1]?.id ?? null
  const activeId = isAtBottom && lastItemId ? lastItemId : observedActiveId

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

  return (
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
            item.level === 2 ? 'pl-0' : item.level === 3 ? 'pl-3' : 'pl-6'
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
                    ? 'text-burgundy font-medium border-l-2 border-burgundy -ml-px'
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
  )
}
