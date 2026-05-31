'use client'
import Link from 'next/link'
import type { PostMeta } from '@/types/post'
import { PostList } from '@/components/ui/PostList'

function AllPostsButton() {
  return (
    <div className="mt-12 text-center">
      <Link
        href="/blog/"
        className="inline-block px-6 py-3 border border-accent text-accent rounded hover:bg-accent hover:text-bg-primary transition font-sans"
      >
        All posts →
      </Link>
    </div>
  )
}

export function LatestPosts({ allPosts }: { allPosts: PostMeta[] }) {
  return (
    <section className="container mx-auto max-w-5xl px-4 sm:px-6 pb-16 sm:pb-24">
      <h2 className="font-sans font-semibold text-3xl text-text-primary mb-8">Latest posts</h2>
      <PostList
        posts={allPosts}
        emptyState={
          <p className="text-text-secondary font-sans">No posts yet. Check back soon!</p>
        }
      />
      <AllPostsButton />
    </section>
  )
}
