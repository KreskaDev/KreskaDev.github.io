'use client'
import Link from 'next/link'
import type { SearchEntry } from '@/types/post'

interface Props {
  results: SearchEntry[]
  query: string
  onSelect: () => void
}

export function SearchResults({ results, query, onSelect }: Props) {
  if (query.trim().length === 0) {
    return <p className="text-text-tertiary text-sm py-2">Start typing to search.</p>
  }
  if (results.length === 0) {
    return <p className="text-text-secondary text-sm py-2">No results for &ldquo;{query}&rdquo;.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {results.map(r => (
        <li key={r.slug}>
          <Link
            href={`/posts/${r.slug}/`}
            onClick={onSelect}
            className="block p-3 rounded hover:bg-surface-elevated border border-transparent hover:border-border transition"
          >
            <h3 className="font-sans font-semibold text-lg text-text-primary">{r.title}</h3>
            <p className="text-text-secondary text-sm mt-1 line-clamp-2">{r.summary}</p>
            {r.tags.length > 0 && (
              <p className="text-text-tertiary text-xs mt-1 font-mono">
                {r.tags.map(t => `#${t}`).join(' ')}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
