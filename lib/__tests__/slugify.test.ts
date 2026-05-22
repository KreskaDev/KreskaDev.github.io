import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/slugify'

describe('slugify', () => {
  it('strips PL diacritics', () => {
    expect(slugify('niepoczytalność')).toBe('niepoczytalnosc')
  })
  it('handles ł explicitly', () => {
    expect(slugify('Łoś')).toBe('los')
  })
  it('collapses non-alphanumeric to hyphens', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })
})
