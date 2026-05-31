'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

// Generic tabs widget — używany w MDX dla case studies (z hashSync), w przyszłości
// może obsługiwać code snippet language switcher itp.
//
// Pattern: explicit metadata via `tabs` prop + per-panel `<TabItem id>` declarations.
// Powód (zamiast extracting metadata z children): MDX/RSC owijają client component
// children w React.lazy boundaries — `el.type === TabItem` nigdy nie matchuje, bo
// `el.type` to lazy reference, nie funkcja TabItem. Industry standard (Radix, Headless UI)
// też używa explicit declarations (TabsList + TabsContent) dla tego samego powodu.

export interface TabDescriptor {
  id: string
  title: string
  tagline?: string
}

interface TabsContextValue {
  active: string
  activate: (id: string) => void
  panelIdFor: (tabId: string) => string
  triggerIdFor: (tabId: string) => string
}

const TabsContext = createContext<TabsContextValue | null>(null)

interface TabsProps {
  /**
   * Lista zakładek (id, title, tagline). Kolejność = kolejność tab buttons.
   * Każdy id musi mieć odpowiadający `<TabItem id="...">` w children.
   */
  tabs: TabDescriptor[]
  children: ReactNode
  /**
   * Aktywny tab synchronizowany z URL hash (#id). Włącz dla case studies
   * (jedna instancja per strona, deep-linkable). Wyłącz dla code snippet langs.
   */
  hashSync?: boolean
  /** Label dla tablist landmark (a11y). */
  ariaLabel?: string
}

export function Tabs({ tabs, children, hashSync = false, ariaLabel }: TabsProps) {
  const reactId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const tablistRef = useRef<HTMLDivElement>(null)

  const firstId = tabs[0]?.id ?? ''
  const [active, setActive] = useState<string>(firstId)

  // Hash sync: czyta `#id` z URL przy mount + reaguje na hashchange.
  // Anchor link `[X](#id)` z innego miejsca w treści natywnie aktywuje tab.
  const tabIdsKey = tabs.map(t => t.id).join(',')
  useEffect(() => {
    if (!hashSync) return

    const sync = () => {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      if (tabs.some(t => t.id === hash)) {
        setActive(hash)
        requestAnimationFrame(() => {
          containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }

    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashSync, tabIdsKey])

  const activate = useCallback(
    (id: string) => {
      setActive(id)
      if (hashSync && typeof window !== 'undefined') {
        // replaceState — bez nowego history entry, bez triggera hashchange.
        history.replaceState(null, '', `#${id}`)
      }
      // Mobile horizontal scrollable tablist — przybliż wybrany button.
      // Wywoływane tylko z user-initiated handlera (click/keyboard) — wcześniejszy
      // useEffect[active] + isInitialMount ref nie działał w React 19 Strict Mode
      // (double-invoke unmount→remount zachowuje ref `false`, skrol palił przy
      // każdym wejściu na post, bo Tabs głęboko w treści przyciągał browsera).
      requestAnimationFrame(() => {
        const btn = tablistRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${id}"]`)
        btn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      })
    },
    [hashSync],
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx
    if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length
    else if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = tabs.length - 1
    else return
    e.preventDefault()
    const nextId = tabs[nextIdx]?.id
    if (!nextId) return
    activate(nextId)
    const nextBtn = tablistRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab-id="${nextId}"]`,
    )
    nextBtn?.focus()
  }

  if (tabs.length === 0) return null

  const ctxValue: TabsContextValue = {
    active,
    activate,
    panelIdFor: (tabId: string) => `${reactId}-panel-${tabId}`,
    triggerIdFor: (tabId: string) => `${reactId}-tab-${tabId}`,
  }

  return (
    <TabsContext.Provider value={ctxValue}>
      <div ref={containerRef} className="my-8 scroll-mt-24">
        <div
          ref={tablistRef}
          role="tablist"
          aria-label={ariaLabel ?? 'Tabs'}
          className="not-prose flex gap-1 overflow-x-auto no-scrollbar snap-x snap-mandatory sm:flex-wrap sm:overflow-x-visible border-b border-border mb-6 font-sans"
        >
          {tabs.map((t, idx) => {
            const isActive = t.id === active
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                data-tab-id={t.id}
                aria-selected={isActive}
                aria-controls={ctxValue.panelIdFor(t.id)}
                id={ctxValue.triggerIdFor(t.id)}
                tabIndex={isActive ? 0 : -1}
                onClick={() => activate(t.id)}
                onKeyDown={e => handleKeyDown(e, idx)}
                className={
                  'shrink-0 sm:shrink snap-start px-4 py-2 text-left text-sm transition-colors rounded-t -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                  (isActive
                    ? 'text-text-primary border-b-2 border-accent font-semibold'
                    : 'text-text-secondary border-b-2 border-transparent hover:text-text-primary')
                }
              >
                <span className="block">{t.title}</span>
                {t.tagline && (
                  <span className="hidden sm:block text-xs text-text-tertiary mt-0.5 font-normal">
                    {t.tagline}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabItemProps {
  id: string
  children: ReactNode
}

// Renderuje children jako tabpanel TYLKO jeśli ctx.active === id. Inaczej null.
// Pattern: matching po id z TabsContext zamiast filtering children w Tabs (RSC lazy
// boundary blokuje type-check children).
export function TabItem({ id, children }: TabItemProps) {
  const ctx = useContext(TabsContext)
  if (!ctx) return null
  if (ctx.active !== id) return null
  return (
    <div role="tabpanel" id={ctx.panelIdFor(id)} aria-labelledby={ctx.triggerIdFor(id)}>
      {children}
    </div>
  )
}
TabItem.displayName = 'TabItem'
