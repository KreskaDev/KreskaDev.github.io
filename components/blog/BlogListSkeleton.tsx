export function BlogListSkeleton() {
  return (
    <div data-testid="blog-list-skeleton" aria-hidden>
      {/* Skeleton chipów (~3) — animate-pulse + szare placeholdery */}
      <div className="flex flex-wrap gap-2 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-7 w-16 rounded bg-bg-secondary animate-pulse" />
        ))}
      </div>
      {/* Skeleton 3 PostCard-shape placeholderów */}
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-6 list-none p-0 m-0">
        {[1, 2, 3].map(i => (
          <li key={i}>
            <div className="h-48 rounded-lg border border-border bg-bg-secondary animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  )
}
