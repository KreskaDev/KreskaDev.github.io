import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LatestPosts } from '@/components/home/LatestPosts'
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

// jsdom nie ma IntersectionObserver — stub na potrzeby testów.
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

describe('LatestPosts', () => {
  it('renders empty state gdy zero postów', () => {
    render(<LatestPosts allPosts={[]} />)
    expect(screen.getByText(/No posts yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /All posts/i })).toBeInTheDocument()
  })

  it('dormant: renders wszystkie posty gdy ≤ INITIAL_BATCH (10), brak sentinel', () => {
    const posts = Array.from({ length: 3 }, (_, i) => makePost(`p${i}`, `2026-05-${20 + i}`))
    render(<LatestPosts allPosts={posts} />)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.queryByTestId('endless-sentinel')).toBeNull()
  })

  it('active: renders pierwsze 10 + sentinel gdy total > 10', () => {
    const posts = Array.from({ length: 15 }, (_, i) => makePost(`p${i}`, `2026-05-${10 + i}`))
    render(<LatestPosts allPosts={posts} />)
    expect(screen.getAllByRole('article')).toHaveLength(10)
    expect(screen.getByTestId('endless-sentinel')).toBeInTheDocument()
  })

  it('"All posts" button zawsze widoczny (per ADR-018)', () => {
    // Next 16 Link strips trailing slash w jsdom; trailingSlash:true aplikuje się
    // przy build/runtime routing, nie w RTL. Regex akceptuje obie formy.
    const { unmount } = render(<LatestPosts allPosts={[]} />)
    expect(screen.getByRole('link', { name: /All posts/i }).getAttribute('href')).toMatch(
      /^\/blog\/?$/,
    )
    unmount()
    render(<LatestPosts allPosts={[makePost('p1', '2026-05-22')]} />)
    expect(screen.getByRole('link', { name: /All posts/i }).getAttribute('href')).toMatch(
      /^\/blog\/?$/,
    )
  })

  it('"End of list" hidden gdy total ≤ INITIAL_BATCH', () => {
    render(<LatestPosts allPosts={[makePost('p1', '2026-05-22')]} />)
    expect(screen.queryByText(/End of list/i)).toBeNull()
  })
})
