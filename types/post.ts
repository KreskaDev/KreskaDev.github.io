import type { PostFrontmatter, SubpageFrontmatter } from './frontmatter'

export type { PostFrontmatter, SubpageFrontmatter }

export interface PostMeta extends PostFrontmatter {
  dateDisplay: string // pre-formatted "May 22, 2026" (Intl.DateTimeFormat, timeZone:'UTC')
}

export type Subpage = SubpageFrontmatter

export interface SearchEntry {
  slug: string
  title: string
  summary: string
  tags: string[]
  headings: string[]
}
