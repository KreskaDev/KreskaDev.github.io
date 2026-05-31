'use client'
import Link from 'next/link'

interface TagFilterProps {
  uniqueTags: string[]
  activeTag: string | null
}

export function TagFilter({ uniqueTags, activeTag }: TagFilterProps) {
  // Compact tag link pattern — świadome ~32px tap target (poniżej WCAG AAA 44px)
  // per ADR-035 Consequences exception. Bumpowanie do 44px łamie density list.
  // .tag-pill outline pattern per task spec — bg-bg-secondary baseline,
  // active = accent-soft + accent text, hover = surface-elevated + text-primary.
  const chipBase =
    'px-3 sm:px-3.5 py-2 sm:py-1 rounded-full text-xs sm:text-[13px] font-sans border focus-visible:outline-none transition-colors'
  const chipActive =
    'bg-accent-soft text-accent border-accent-soft'
  const chipPassive =
    'bg-bg-secondary text-text-secondary border-border hover:bg-surface-elevated hover:text-text-primary hover:border-border-strong'

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
