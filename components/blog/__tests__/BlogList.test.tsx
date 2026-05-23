import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlogList } from '@/components/blog/BlogList'
import type { PostMeta } from '@/types/post'

// Mock next/navigation useSearchParams — kontrolujemy URL state per test.
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

// PostList może zamontować IntersectionObserver (active branch). Bezpiecznie mock per-test
// (parallel z v5-03 LatestPosts + PostList.test).
class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = []
  constructor(..._args: [IntersectionObserverCallback, IntersectionObserverInit?]) {
    void _args
  }
}

beforeEach(() => {
  mockSearchParams = new URLSearchParams()
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
})

function makePost(slug: string, tags: string[]): PostMeta {
  return {
    title: `Post ${slug}`,
    subtitle: 'sub',
    date: '2026-05-22',
    dateDisplay: 'May 22, 2026',
    author: 'KreskaDev',
    slug,
    summary: `Summary ${slug}`,
    tags,
    language: 'en',
  }
}

describe('BlogList', () => {
  it('renders all posts default (no tag filter)', () => {
    const posts = [
      makePost('a', ['AI']),
      makePost('b', ['Bayes']),
      makePost('c', ['AI', 'GameDev']),
    ]
    render(<BlogList allPosts={posts} />)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'GameDev' })).toBeInTheDocument()
  })

  it('filters by ?tag=AI — only AI posts visible', () => {
    mockSearchParams = new URLSearchParams('tag=AI')
    const posts = [
      makePost('a', ['AI']),
      makePost('b', ['Bayes']),
      makePost('c', ['AI', 'GameDev']),
    ]
    render(<BlogList allPosts={posts} />)
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'AI' })).toHaveAttribute('aria-current', 'page')
  })

  it('empty top-level: allPosts === [] → just EmptyState, no filter bar', () => {
    render(<BlogList allPosts={[]} />)
    expect(screen.getByText(/No posts yet\. Check back soon\./i)).toBeInTheDocument()
    expect(screen.queryByTestId('tag-filter')).toBeNull()
  })

  it('empty filter result: ?tag=Garbage → EmptyState + Clear filter CTA + TagFilter visible', () => {
    mockSearchParams = new URLSearchParams('tag=Garbage')
    const posts = [makePost('a', ['AI']), makePost('b', ['Bayes'])]
    render(<BlogList allPosts={posts} />)
    expect(screen.getByText(/No posts found with tag "Garbage"\./i)).toBeInTheDocument()
    const clearLink = screen.getByRole('link', { name: 'Clear filter' })
    expect(clearLink.getAttribute('href')).toMatch(/^\/blog\/?$/)
    expect(screen.getByTestId('tag-filter')).toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })

  it('posts bez tagów (uniqueTags === []) — TagFilter suppressed', () => {
    const posts = [makePost('a', []), makePost('b', [])]
    render(<BlogList allPosts={posts} />)
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.queryByTestId('tag-filter')).toBeNull()
  })
})
