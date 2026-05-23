import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostCard } from '@/components/ui/PostCard'
import type { PostMeta } from '@/types/post'

const examplePost: PostMeta = {
  title: 'Example Post',
  subtitle: 'Testing pipeline',
  date: '2026-05-22',
  dateDisplay: 'May 22, 2026',
  author: 'KreskaDev',
  slug: 'example',
  summary: 'A short summary used by blog list cards.',
  tags: ['Bayes', 'AI'],
  language: 'en',
}

describe('PostCard', () => {
  it('renders title, summary, formatted date, and ISO dateTime attr', () => {
    render(<PostCard post={examplePost} />)
    expect(screen.getByText('Example Post')).toBeInTheDocument()
    expect(screen.getByText('A short summary used by blog list cards.')).toBeInTheDocument()
    const timeEl = screen.getByText('May 22, 2026')
    expect(timeEl.tagName).toBe('TIME')
    expect(timeEl).toHaveAttribute('dateTime', '2026-05-22')
  })

  it('renders all tags', () => {
    render(<PostCard post={examplePost} />)
    expect(screen.getByText('Bayes')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('omits tags block gdy tags pusta', () => {
    render(<PostCard post={{ ...examplePost, tags: [] }} />)
    expect(screen.queryByTestId('post-card-tags')).toBeNull()
  })

  it('link href używa slug', () => {
    // Next 16 Link normalizuje href w jsdom (trailingSlash:true z next.config aplikuje się
    // przy build/runtime routing, nie w RTL). Source ma `/posts/${slug}/` — regex akceptuje obie formy.
    render(<PostCard post={examplePost} />)
    const link = screen.getByRole('link', { name: /Read post: Example Post/i })
    expect(link.getAttribute('href')).toMatch(/^\/posts\/example\/?$/)
  })

  it('link ma aria-label z title (a11y)', () => {
    render(<PostCard post={examplePost} />)
    expect(screen.getByLabelText('Read post: Example Post')).toBeInTheDocument()
  })

  it('akceptuje variant prop bez crashu (future hook)', () => {
    expect(() => render(<PostCard post={examplePost} variant="blog" />)).not.toThrow()
  })
})
