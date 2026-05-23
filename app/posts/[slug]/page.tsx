import { compileMDX } from 'next-mdx-remote/rsc'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllPosts, getPostBySlug } from '@/lib/posts'
import mdxComponents from '@/mdx-components'
import { mdxOptions } from '@/lib/mdx-options'
import type { PostFrontmatter } from '@/types/post'
import BayesAnalyzer from '@/content/posts/pozytywny-wynik/components/BayesAnalyzer'
import { Tabs, TabItem } from '@/components/ui/Tabs'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map(p => ({ slug: p.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const posts = await getAllPosts()
  const post = posts.find(p => p.slug === slug)
  if (!post) return { title: 'Post not found' }
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/posts/${slug}/` },
  }
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
    components: { ...mdxComponents, BayesAnalyzer, Tabs, TabItem },
    // blockJS:false — next-mdx-remote@6 domyślnie stripuje JSX expression attribute
    // values (`prop={expr}`), zostawia tylko stringi i boolean shorthand. To blokuje
    // np. `<BayesAnalyzer editable={false} clinics={[...]} />` w MDX. Treść posta
    // żyje w `content/posts/` (nasza), nie user-submitted — security nie jest aktualne.
    // `blockDangerousJS: true` (default) chroni przed eval/Function calls.
    options: { mdxOptions, parseFrontmatter: false, blockJS: false },
  })

  // ADR-023: <html lang="en"> globalnie + <article lang="pl"> lokalnie dla PL posta.
  // Undefined dziedziczy z <html lang="en"> — brak nadpisywania tym samym.
  const articleLang =
    loaded.frontmatter.language && loaded.frontmatter.language !== 'en'
      ? loaded.frontmatter.language
      : undefined

  const dateDisplay = dateFormatter.format(new Date(loaded.frontmatter.date + 'T00:00:00Z'))

  return (
    <div className="container mx-auto max-w-3xl px-6 py-12">
      <article lang={articleLang} className="prose dark:prose-invert">
        <header className="not-prose mb-8">
          <h1 className="font-display text-4xl text-text-primary">
            {loaded.frontmatter.title}
          </h1>
          {loaded.frontmatter.subtitle && (
            <p className="text-text-secondary text-xl mt-2 font-display italic">
              {loaded.frontmatter.subtitle}
            </p>
          )}
          <div className="flex items-baseline gap-3 mt-4 text-text-tertiary text-sm font-sans">
            <time dateTime={loaded.frontmatter.date}>{dateDisplay}</time>
            <span aria-hidden>·</span>
            <span>{loaded.frontmatter.author}</span>
          </div>
        </header>
        {content}
      </article>
    </div>
  )
}
