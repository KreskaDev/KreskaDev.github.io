'use client'
import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import type { PostMeta } from '@/types/post'
import { PostList } from '@/components/ui/PostList'
import { EmptyState } from '@/components/ui/EmptyState'
import { TagFilter } from '@/components/blog/TagFilter'

interface BlogListProps {
  allPosts: PostMeta[]
}

export function BlogList({ allPosts }: BlogListProps) {
  const searchParams = useSearchParams()
  const activeTag = searchParams.get('tag') ?? null

  // Tagi unikalne — alfabetyczne. useMemo bo allPosts stable per page (static export).
  const uniqueTags = useMemo(
    () => Array.from(new Set(allPosts.flatMap(p => p.tags))).sort(),
    [allPosts],
  )

  // Filter — pure derive. Bez useMemo (nie hot path, allPosts.length małe per MVP).
  const filtered = activeTag
    ? allPosts.filter(p => p.tags.includes(activeTag))
    : allPosts

  // Empty top-level — brak postów w ogóle. Filter bar suppressed.
  if (allPosts.length === 0) {
    return <EmptyState message="No posts yet. Check back soon." />
  }

  // Filter empty — active filter z 0 wynikami (lub invalid tag). CTA "Clear filter" → /blog/.
  if (activeTag && filtered.length === 0) {
    return (
      <>
        {uniqueTags.length > 0 && (
          <TagFilter uniqueTags={uniqueTags} activeTag={activeTag} />
        )}
        <EmptyState
          message={`No posts found with tag "${activeTag}".`}
          cta={{ label: 'Clear filter', href: '/blog/' }}
        />
      </>
    )
  }

  return (
    <>
      {uniqueTags.length > 0 && (
        <TagFilter uniqueTags={uniqueTags} activeTag={activeTag} />
      )}
      <PostList posts={filtered} />
    </>
  )
}
