'use client'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { PostMeta } from '@/types/post'
import { PostCard } from '@/components/ui/PostCard'

const INITIAL_BATCH = 10
const NEXT_BATCH = 10

function AllPostsButton() {
  return (
    <div className="mt-12 text-center">
      <Link
        href="/blog/"
        className="inline-block px-6 py-3 border border-burgundy text-burgundy rounded hover:bg-burgundy hover:text-bg-primary transition font-sans"
      >
        All posts →
      </Link>
    </div>
  )
}

export function LatestPosts({ allPosts }: { allPosts: PostMeta[] }) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH)
  const hasMore = visibleCount < allPosts.length

  // Callback ref (React 19) — observer tworzony WYŁĄCZNIE wewnątrz body callbacka,
  // żeby NIE referować window/IntersectionObserver na top-level (SSR safety).
  const setSentinel = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !hasMore) return
      const observer = new IntersectionObserver(
        entries => {
          if (entries[0]?.isIntersecting) {
            setVisibleCount(count => Math.min(count + NEXT_BATCH, allPosts.length))
          }
        },
        { rootMargin: '200px 0px' },
      )
      observer.observe(node)
      return () => observer.disconnect()
    },
    [hasMore, allPosts.length],
  )

  if (allPosts.length === 0) {
    return (
      <section className="container mx-auto max-w-5xl px-6 pb-24">
        <h2 className="font-display text-3xl text-text-primary mb-8">Latest posts</h2>
        <p className="text-text-secondary">No posts yet. Check back soon!</p>
        <AllPostsButton />
      </section>
    )
  }

  return (
    <section className="container mx-auto max-w-5xl px-6 pb-24">
      <h2 className="font-display text-3xl text-text-primary mb-8">Latest posts</h2>
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-6 list-none p-0 m-0">
        {allPosts.slice(0, visibleCount).map(post => (
          <li key={post.slug}>
            <PostCard post={post} variant="home" />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div ref={setSentinel} aria-hidden data-testid="endless-sentinel" className="h-1" />
      )}
      {!hasMore && allPosts.length > INITIAL_BATCH && (
        <p className="text-text-tertiary text-sm text-center mt-8">End of list. Check back soon!</p>
      )}
      <AllPostsButton />
    </section>
  )
}
