import { promises as fs } from 'node:fs'
import path from 'node:path'
import { compileMDX } from 'next-mdx-remote/rsc'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllPosts, getSubpage } from '@/lib/posts'
import mdxComponents from '@/mdx-components'
import { mdxOptions } from '@/lib/mdx-options'
import type { SubpageFrontmatter } from '@/types/post'
import BayesAnalyzer from '@/content/posts/pozytywny-wynik/components/BayesAnalyzer'
import { Tabs, TabItem } from '@/components/ui/Tabs'
import { PostBreadcrumb } from '@/components/post/PostBreadcrumb'
import { ContentNavigator } from '@/components/post/ContentNavigator'
import { BackToTop } from '@/components/post/BackToTop'

export async function generateStaticParams() {
  // Enumerate <slug, subpage> pairs przez filesystem. Bez tego `output: 'export'`
  // wybuchnie "Page is missing param" błędem dla dynamic segment.
  const posts = await getAllPosts()
  const postsDir = path.join(process.cwd(), 'content', 'posts')
  const params: { slug: string; subpage: string }[] = []
  for (const post of posts) {
    let files: string[] = []
    try {
      files = await fs.readdir(path.join(postsDir, post.slug))
    } catch {
      continue
    }
    for (const file of files) {
      if (file.endsWith('.mdx') && file !== 'index.mdx') {
        params.push({ slug: post.slug, subpage: file.replace(/\.mdx$/, '') })
      }
    }
  }
  return params
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; subpage: string }> },
): Promise<Metadata> {
  const { slug, subpage } = await params
  try {
    const { frontmatter } = await getSubpage(slug, subpage)
    return {
      title: frontmatter.title,
      alternates: { canonical: `/posts/${slug}/${subpage}/` },
    }
  } catch {
    return { title: 'Page not found' }
  }
}

export default async function SubpagePage(
  { params }: { params: Promise<{ slug: string; subpage: string }> },
) {
  const { slug, subpage } = await params

  let loaded: { source: string; frontmatter: SubpageFrontmatter }
  try {
    loaded = await getSubpage(slug, subpage)
  } catch {
    notFound()
  }

  const { content } = await compileMDX({
    source: loaded.source,
    components: { ...mdxComponents, BayesAnalyzer, Tabs, TabItem },
    // blockJS:false — patrz ADR-033 + komentarz w `app/posts/[slug]/page.tsx`.
    // JSX expressions w MDX wymagają wyłączenia tego domyślnego stripowania
    // w next-mdx-remote@6.
    options: { mdxOptions, parseFrontmatter: false, blockJS: false },
  })

  // Parent post title dla breadcrumb label.
  const parentPost = (await getAllPosts()).find(p => p.slug === slug)
  const parentTitle = parentPost?.title ?? slug

  const articleLang =
    loaded.frontmatter.language && loaded.frontmatter.language !== 'en'
      ? loaded.frontmatter.language
      : undefined

  return (
    <div className="container mx-auto max-w-3xl px-6 py-12">
      <PostBreadcrumb parentSlug={slug} parentTitle={parentTitle} />
      <article lang={articleLang} className="prose dark:prose-invert">
        {content}
      </article>
      <ContentNavigator />
      <BackToTop />
    </div>
  )
}
