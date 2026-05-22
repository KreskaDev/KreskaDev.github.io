import { promises as fs } from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { z } from 'zod'
import type { SearchEntry } from '@/types/post'

const postsDir = path.join(process.cwd(), 'content', 'posts')

// Loose schema — search może indeksować przyszłe posty bez wymogu kompletnego
// postFrontmatterSchema z lib/posts.ts. Wymaga tylko 4 pól pod SearchEntry.
const indexFrontmatterSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  slug: z.string(),
})

// Regex headings extraction. Match h2-h4 (`##`, `###`, `####`). Code-block stripping
// pre-regex eliminuje główny false-positive source (shebang `#!/bin/bash` etc.).
// Per ADR-030: brak `{#anchor}` syntax w MDX (remark-heading-id dropped), ale defensywnie
// trzymamy strip na wypadek gdyby ktoś zostawił. Jeśli kiedyś trzeba pełnej precyzji
// (np. heading w środku <Component>), port do remark AST walk — zob. Risks w planie.
const HEADING_RE = /^(#{2,4})\s+(.+?)\s*$/gm

function extractHeadings(content: string): string[] {
  const out: string[] = []
  const stripped = content.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '')
  let match: RegExpExecArray | null
  HEADING_RE.lastIndex = 0
  while ((match = HEADING_RE.exec(stripped)) !== null) {
    const raw = match[2] ?? ''
    const text = raw.replace(/\s*\{#[^}]+\}\s*$/, '').trim()
    if (text.length > 0) out.push(text)
  }
  return out
}

export async function buildSearchIndex(): Promise<SearchEntry[]> {
  let dirEntries: import('fs').Dirent[]
  try {
    dirEntries = await fs.readdir(postsDir, { withFileTypes: true })
  } catch {
    // content/posts/ nie istnieje (fresh clone / early dev) — graceful degradation.
    return []
  }
  const slugs = dirEntries.filter(e => e.isDirectory()).map(e => e.name)
  const entries = await Promise.all(
    slugs.map(async slug => {
      const raw = await fs.readFile(path.join(postsDir, slug, 'index.mdx'), 'utf8')
      const { data, content } = matter(raw)
      const fm = indexFrontmatterSchema.parse(data)
      const headings = extractHeadings(content)
      const entry: SearchEntry = {
        slug: fm.slug,
        title: fm.title,
        summary: fm.summary,
        tags: fm.tags,
        headings,
      }
      return entry
    }),
  )
  // Stabilne sortowanie — diff-friendly JSON gdy posty zmieniają content ale nie order.
  return entries.sort((a, b) => a.slug.localeCompare(b.slug))
}
