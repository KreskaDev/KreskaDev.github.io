// Single source of truth dla shape — synchroniczne z zod schemas w lib/posts.ts.
// Schemas zostają w lib/posts.ts (jak Step 15), typy tutaj dla cleaner imports.
export interface PostFrontmatter {
  title: string
  subtitle: string
  date: string // YYYY-MM-DD
  author: string
  slug: string
  summary: string
  tags: string[]
  language?: 'pl' | 'en'
}

export interface SubpageFrontmatter {
  title: string
  parent: string
  language?: 'pl' | 'en'
}
