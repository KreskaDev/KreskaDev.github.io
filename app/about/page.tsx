import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Metadata } from 'next'
import matter from 'gray-matter'
import { compileMDX } from 'next-mdx-remote/rsc'
import mdxComponents from '@/mdx-components'
import { mdxOptions } from '@/lib/mdx-options'

export const metadata: Metadata = {
  title: 'About',
  description: 'About me — coming soon.',
  alternates: { canonical: '/about/' },
}

export default async function AboutPage() {
  // Pattern spójny z (przyszłym) app/posts/[slug]/page.tsx — ADR-029 single MDX pipeline:
  // gray-matter pre-strippa frontmatter (compileMDX z parseFrontmatter:false NIE strippa,
  // tylko nie ekstraktuje), inaczej `---/---` renderuje się jako visible HTML.
  const raw = await readFile(
    path.join(process.cwd(), 'content/pages/about/index.mdx'),
    'utf8',
  )
  const { content: source } = matter(raw)
  // Loose validation — brak zod schema (single static file, frontmatter informacyjny).

  const { content } = await compileMDX({
    source,
    components: mdxComponents,
    options: { mdxOptions, parseFrontmatter: false },
  })

  return (
    <article
      className="container mx-auto max-w-3xl px-6 py-16 prose dark:prose-invert prose-headings:font-display"
      lang="en"
    >
      {content}
    </article>
  )
}
