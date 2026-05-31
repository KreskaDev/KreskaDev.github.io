'use client'
import Fuse, { type IFuseOptions } from 'fuse.js'
import { X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { SearchEntry } from '@/types/post'
import { SearchInput } from './SearchInput'
import { SearchResults } from './SearchResults'

const fuseOptions: IFuseOptions<SearchEntry> = {
  keys: ['title', 'summary', 'tags', 'headings'],
  threshold: 0.3,
  includeMatches: false,
}

export function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [index, setIndex] = useState<SearchEntry[] | null>(null)
  const [error, setError] = useState(false)

  // Sync isOpen prop z imperatywnym API <dialog> + manual focus po showModal
  // (autoFocus na <input> bywa niereliable z native dialog'iem).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      dialog.close()
      // Reset query po zamknięciu — sync z external state (dialog closed = clean slate dla nast. open).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
    }
  }, [isOpen])

  // Body scroll lock — Safari <dialog> może nie blokować body scroll natywnie.
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [isOpen])

  // Lazy fetch index na first open. `.catch` na promise — NIE try/catch z JSX w body
  // (ESLint react-hooks/error-boundaries Next 16, Sesja 5 deviation #1).
  useEffect(() => {
    if (!isOpen || index || error) return
    fetch('/search-index.json')
      .then(r => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((data: SearchEntry[]) => setIndex(data))
      .catch(() => setError(true))
  }, [isOpen, index, error])

  const fuse = useMemo(() => (index ? new Fuse(index, fuseOptions) : null), [index])

  const results: SearchEntry[] = useMemo(() => {
    if (!fuse || deferredQuery.trim().length === 0) return []
    return fuse.search(deferredQuery, { limit: 10 }).map(r => r.item)
  }, [fuse, deferredQuery])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={e => {
        if (e.target === dialogRef.current) onClose()
      }}
      aria-labelledby="search-modal-title"
      className="search-dialog"
    >
      <div className="flex flex-col w-full h-full md:h-auto max-w-none md:max-w-2xl mx-auto bg-bg-primary text-text-primary rounded-none md:rounded-lg md:shadow-xl">
        <h2 id="search-modal-title" className="sr-only">
          Search posts
        </h2>
        <div className="shrink-0 flex items-center gap-3 p-4 md:p-6 md:pb-4 border-b border-border md:border-b-0">
          <SearchInput ref={inputRef} value={query} onChange={setQuery} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-2">
          {error ? (
            <p className="text-text-secondary text-sm py-4">Search temporarily unavailable.</p>
          ) : (
            <SearchResults results={results} query={deferredQuery} onSelect={onClose} />
          )}
        </div>
      </div>
    </dialog>
  )
}
