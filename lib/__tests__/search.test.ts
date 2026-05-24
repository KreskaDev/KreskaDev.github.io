import { describe, it, expect } from 'vitest'
import { buildSearchIndex } from '@/lib/search'

describe('buildSearchIndex', () => {
  it('zwraca SearchEntry array dla example playbook post', async () => {
    const entries = await buildSearchIndex()
    expect(entries.length).toBeGreaterThan(0)
    const example = entries.find(e => e.slug === 'example')
    expect(example).toBeDefined()
    expect(example?.title).toBe('Example Post — MDX Playbook')
    expect(example?.tags).toEqual(['Example', 'Playbook'])
    // Stable headings z playbook content (v5-06 expansion).
    expect(example?.headings).toContain('Introduction')
    expect(example?.headings).toContain('Frontmatter')
    expect(example?.headings).toContain('Polish diacritics')
  })

  it('ekstraktuje h2 + h3 headings (playbook ma ≥ 10 sekcji)', async () => {
    const entries = await buildSearchIndex()
    const example = entries.find(e => e.slug === 'example')
    expect(example?.headings.length).toBeGreaterThanOrEqual(10)
  })

  it('sortuje entries po slug', async () => {
    const entries = await buildSearchIndex()
    const slugs = entries.map(e => e.slug)
    const sorted = [...slugs].sort()
    expect(slugs).toEqual(sorted)
  })
})
