'use client'
import { useCallback, useState, type ReactNode } from 'react'
import type { PostMeta } from '@/types/post'
import { PostCard } from '@/components/ui/PostCard'

interface PostListProps {
  posts: PostMeta[]
  initialCount?: number
  emptyState?: ReactNode
}

const DEFAULT_INITIAL = 10
const NEXT_BATCH = 10

// PostCard variant="blog" jest no-op per v5-03 + task prompt 04 (PostCard kontrakt
// stable); konsumenci PostList (Home + Blog) dostają identyczny render. Kontrakt
// jednoznaczny: "PostList renders blog-flavor cards".
export function PostList({ posts, initialCount = DEFAULT_INITIAL, emptyState }: PostListProps) {
  const [visibleCount, setVisibleCount] = useState(initialCount)
  const hasMore = visibleCount < posts.length

  // Callback ref (React 19) — observer tworzony WYŁĄCZNIE wewnątrz body callbacka,
  // żeby NIE referować window/IntersectionObserver na top-level (SSR safety).
  const setSentinel = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !hasMore) return
      const observer = new IntersectionObserver(
        entries => {
          if (entries[0]?.isIntersecting) {
            setVisibleCount(count => Math.min(count + NEXT_BATCH, posts.length))
          }
        },
        { rootMargin: '200px 0px' },
      )
      observer.observe(node)
      return () => observer.disconnect()
    },
    [hasMore, posts.length],
  )

  if (posts.length === 0) {
    return <>{emptyState ?? <p className="text-text-secondary font-sans">No posts yet.</p>}</>
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 sm:gap-6 list-none p-0 m-0">
        {posts.slice(0, visibleCount).map(post => (
          <li key={post.slug}>
            <PostCard post={post} variant="blog" />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div ref={setSentinel} aria-hidden data-testid="endless-sentinel" className="h-1" />
      )}
      {!hasMore && posts.length > initialCount && (
        <p className="text-text-tertiary text-sm text-center mt-8 font-sans">
          End of list. Check back soon!
        </p>
      )}
    </>
  )
}
