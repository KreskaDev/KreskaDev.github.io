import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostList } from '@/components/ui/PostList'
import type { PostMeta } from '@/types/post'

function makePost(slug: string, date: string): PostMeta {
  return {
    title: `Post ${slug}`,
    subtitle: 'sub',
    date,
    dateDisplay: 'May 22, 2026',
    author: 'KreskaDev',
    slug,
    summary: `Summary ${slug}`,
    tags: [],
    language: 'en',
  }
}

// jsdom nie ma IntersectionObserver — stub per-test (parallel z v5-03 LatestPosts.test).
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
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
})

describe('PostList', () => {
  it('renders default empty state gdy posts === []', () => {
    render(<PostList posts={[]} />)
    expect(screen.getByText(/No posts yet\./i)).toBeInTheDocument()
  })

  it('renders custom emptyState gdy podany', () => {
    render(<PostList posts={[]} emptyState={<p>Custom empty!</p>} />)
    expect(screen.getByText('Custom empty!')).toBeInTheDocument()
    expect(screen.queryByText(/No posts yet/i)).toBeNull()
  })

  it('dormant: renders wszystkie posty gdy ≤ initialCount, brak sentinel', () => {
    const posts = Array.from({ length: 3 }, (_, i) => makePost(`p${i}`, `2026-05-${20 + i}`))
    render(<PostList posts={posts} />)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.queryByTestId('endless-sentinel')).toBeNull()
  })

  it('active: renders pierwsze initialCount + sentinel gdy total > initialCount', () => {
    const posts = Array.from({ length: 15 }, (_, i) => makePost(`p${i}`, `2026-05-${10 + i}`))
    render(<PostList posts={posts} />)
    expect(screen.getAllByRole('article')).toHaveLength(10)
    expect(screen.getByTestId('endless-sentinel')).toBeInTheDocument()
  })

  it('respektuje custom initialCount', () => {
    const posts = Array.from({ length: 8 }, (_, i) => makePost(`p${i}`, `2026-05-${10 + i}`))
    render(<PostList posts={posts} initialCount={5} />)
    expect(screen.getAllByRole('article')).toHaveLength(5)
    expect(screen.getByTestId('endless-sentinel')).toBeInTheDocument()
  })

  it('"End of list" hidden gdy total ≤ initialCount', () => {
    render(<PostList posts={[makePost('p1', '2026-05-22')]} />)
    expect(screen.queryByText(/End of list/i)).toBeNull()
  })
})
