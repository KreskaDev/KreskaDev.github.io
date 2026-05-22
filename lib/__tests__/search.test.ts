import { describe, it, expect } from 'vitest'
import { buildSearchIndex } from '@/lib/search'

describe('buildSearchIndex', () => {
  it('zwraca SearchEntry array dla placeholder example post', async () => {
    const entries = await buildSearchIndex()
    expect(entries.length).toBeGreaterThan(0)
    const example = entries.find(e => e.slug === 'example')
    expect(example).toBeDefined()
    expect(example?.title).toBe('Example Post')
    expect(example?.tags).toEqual(['Example'])
    // Headings z prod/content/posts/example/index.mdx (post-ADR-030):
    // h2: "Plain heading", "Heading drugi poziom"; h3: "Trzeci poziom", "Code".
    expect(example?.headings).toContain('Plain heading')
    expect(example?.headings).toContain('Heading drugi poziom')
    expect(example?.headings).toContain('Trzeci poziom')
  })

  it('ekstraktuje h2 + h3 headings (sanity ≥ 4 w placeholder content)', async () => {
    const entries = await buildSearchIndex()
    const example = entries.find(e => e.slug === 'example')
    expect(example?.headings.length).toBeGreaterThanOrEqual(4)
  })

  it('sortuje entries po slug', async () => {
    const entries = await buildSearchIndex()
    const slugs = entries.map(e => e.slug)
    const sorted = [...slugs].sort()
    expect(slugs).toEqual(sorted)
  })
})
