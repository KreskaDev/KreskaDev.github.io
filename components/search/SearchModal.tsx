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
      <div className="p-6 w-full max-w-2xl bg-bg-primary text-text-primary rounded-lg shadow-xl">
        <h2 id="search-modal-title" className="sr-only">
          Search posts
        </h2>
        <div className="flex items-center gap-3 mb-4">
          <SearchInput ref={inputRef} value={query} onChange={setQuery} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="text-text-secondary hover:text-text-primary p-1"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {error ? (
          <p className="text-text-secondary text-sm py-4">Search temporarily unavailable.</p>
        ) : (
          <SearchResults results={results} query={deferredQuery} onSelect={onClose} />
        )}
      </div>
    </dialog>
  )
}
