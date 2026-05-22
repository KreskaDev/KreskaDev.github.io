import { promises as fs } from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { z } from 'zod'
import type { PostFrontmatter, SubpageFrontmatter, PostMeta } from '@/types/post'

const postsDir = path.join(process.cwd(), 'content', 'posts')

// YAML 1.1 parsuje `date: 2026-05-22` jako Date — coerce z powrotem do ISO YYYY-MM-DD
// (lub akceptuj string jeśli ktoś zacytuje w MDX: `date: "2026-05-22"`).
const dateField = z.preprocess(
  v => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
)

const postFrontmatterSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  date: dateField,
  author: z.string(),
  slug: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  language: z.enum(['pl', 'en']).optional(),
})

const subpageFrontmatterSchema = z.object({
  title: z.string(),
  parent: z.string(),
  language: z.enum(['pl', 'en']).optional(),
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function formatDateDisplay(isoDate: string): string {
  // timeZone:'UTC' — bez tego server-side w non-UTC strefie formatuje "May 21" zamiast "May 22" off-by-one.
  return dateFormatter.format(new Date(isoDate + 'T00:00:00Z'))
}

export async function getAllPosts(): Promise<PostMeta[]> {
  const entries = await fs.readdir(postsDir, { withFileTypes: true })
  const slugs = entries.filter(e => e.isDirectory()).map(e => e.name)
  const posts = await Promise.all(
    slugs.map(async slug => {
      const raw = await fs.readFile(path.join(postsDir, slug, 'index.mdx'), 'utf8')
      const { data } = matter(raw)
      const frontmatter = postFrontmatterSchema.parse(data)
      return { ...frontmatter, dateDisplay: formatDateDisplay(frontmatter.date) }
    }),
  )
  return posts.sort((a, b) => b.date.localeCompare(a.date))
}

export async function getPostBySlug(
  slug: string,
): Promise<{ source: string; frontmatter: PostFrontmatter }> {
  const raw = await fs.readFile(path.join(postsDir, slug, 'index.mdx'), 'utf8')
  const { data, content } = matter(raw)
  const frontmatter = postFrontmatterSchema.parse(data)
  return { source: content, frontmatter }
}

export async function getSubpage(
  slug: string,
  subpage: string,
): Promise<{ source: string; frontmatter: SubpageFrontmatter }> {
  const raw = await fs.readFile(path.join(postsDir, slug, `${subpage}.mdx`), 'utf8')
  const { data, content } = matter(raw)
  const frontmatter = subpageFrontmatterSchema.parse(data)
  return { source: content, frontmatter }
}
