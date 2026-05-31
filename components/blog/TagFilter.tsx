'use client'
import Link from 'next/link'

interface TagFilterProps {
  uniqueTags: string[]
  activeTag: string | null
}

export function TagFilter({ uniqueTags, activeTag }: TagFilterProps) {
  // Compact tag link pattern — świadome ~32px tap target (poniżej WCAG AAA 44px)
  // per ADR-035 Consequences exception. Bumpowanie do 44px łamie density list.
  const chipBase =
    'px-3 py-2 sm:py-1 rounded text-sm font-sans focus-visible:ring-2 focus-visible:ring-burgundy focus-visible:outline-none'
  const chipActive = 'bg-burgundy text-bg-primary'
  const chipPassive =
    'bg-burgundy-soft text-burgundy hover:bg-burgundy hover:text-bg-primary transition-colors'

  return (
    <nav
      aria-label="Filter posts by tag"
      className="flex flex-wrap gap-2 mb-8"
      data-testid="tag-filter"
    >
      <Link
        href="/blog/"
        aria-current={activeTag === null ? 'page' : undefined}
        className={`${chipBase} ${activeTag === null ? chipActive : chipPassive}`}
      >
        All
      </Link>
      {uniqueTags.map(tag => {
        const isActive = activeTag === tag
        return (
          <Link
            key={tag}
            href={`/blog/?tag=${encodeURIComponent(tag)}`}
            aria-current={isActive ? 'page' : undefined}
            className={`${chipBase} ${isActive ? chipActive : chipPassive}`}
          >
            {tag}
          </Link>
        )
      })}
    </nav>
  )
}
