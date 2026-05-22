import type { SearchEntry } from '@/types/post'

// Stub — Prompt 02 implementuje real buildSearchIndex używając `gray-matter` + remark AST
// extraction dla headings. Single source of truth dla frontmatter parsing = `gray-matter`
// (ADR-028, ADR-029) — spójne z lib/posts.ts. Plan v5-02 owns full implementation.
export async function buildSearchIndex(): Promise<SearchEntry[]> {
  return []
}
