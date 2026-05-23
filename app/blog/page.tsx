import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllPosts } from '@/lib/posts'
import { BlogList } from '@/components/blog/BlogList'
import { BlogListSkeleton } from '@/components/blog/BlogListSkeleton'

// alternates.canonical jest **względny** — Next.js resolves z metadataBase z layout.tsx
// (https://kreskadev.github.io). Final canonical = https://kreskadev.github.io/blog/.
// ?tag=X URL permutations canonicalized do /blog/ — zero duplicate content penalty.
export const metadata: Metadata = {
  title: 'Blog',
  description: 'All essays, latest first.',
  alternates: { canonical: '/blog/' },
}

export default async function BlogPage() {
  const posts = await getAllPosts()
  return (
    <section className="container mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <h1 className="font-display text-5xl text-text-primary mb-3">Blog</h1>
        <p className="font-sans text-lg text-text-secondary">All essays, latest first.</p>
      </header>
      {/* Suspense wymagany dla useSearchParams w static export (output: 'export'). */}
      <Suspense fallback={<BlogListSkeleton />}>
        <BlogList allPosts={posts} />
      </Suspense>
    </section>
  )
}
