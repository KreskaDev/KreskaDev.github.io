import { compileMDX } from 'next-mdx-remote/rsc'
import { notFound } from 'next/navigation'
import { getAllPosts, getPostBySlug } from '@/lib/posts'
import mdxComponents from '@/mdx-components'
import { mdxOptions } from '@/lib/mdx-options'
import type { PostFrontmatter } from '@/types/post'

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map(p => ({ slug: p.slug }))
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // try wokół wyłącznie load — file-not-found / zod parse fail → notFound().
  // Błędy z compileMDX i renderingu propagują do app/error.tsx boundary (React 19/Next 16 rule).
  let loaded: { source: string; frontmatter: PostFrontmatter }
  try {
    loaded = await getPostBySlug(slug)
  } catch {
    notFound()
  }

  const { content } = await compileMDX({
    source: loaded.source,
    components: mdxComponents,
    options: { mdxOptions, parseFrontmatter: false },
  })

  return (
    <article
      lang={loaded.frontmatter.language ?? 'en'}
      className="prose dark:prose-invert container mx-auto max-w-2xl px-6 py-12"
    >
      <h1 className="font-display text-4xl text-text-primary">{loaded.frontmatter.title}</h1>
      <p className="text-text-secondary italic">{loaded.frontmatter.subtitle}</p>
      {content}
    </article>
  )
}
