import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TagFilter } from '@/components/blog/TagFilter'

describe('TagFilter', () => {
  it('renders "All" chip + N tag chips', () => {
    render(<TagFilter uniqueTags={['AI', 'Bayes', 'GameDev']} activeTag={null} />)
    expect(screen.getByRole('link', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bayes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'GameDev' })).toBeInTheDocument()
  })

  it('marks "All" as aria-current gdy activeTag === null', () => {
    render(<TagFilter uniqueTags={['AI']} activeTag={null} />)
    const allChip = screen.getByRole('link', { name: 'All' })
    expect(allChip).toHaveAttribute('aria-current', 'page')
    const aiChip = screen.getByRole('link', { name: 'AI' })
    expect(aiChip).not.toHaveAttribute('aria-current')
  })

  it('marks tag chip as aria-current gdy activeTag matches', () => {
    render(<TagFilter uniqueTags={['AI', 'Bayes']} activeTag="Bayes" />)
    expect(screen.getByRole('link', { name: 'All' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'AI' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Bayes' })).toHaveAttribute('aria-current', 'page')
  })

  it('href format: "All" → /blog/, tag → /blog/?tag=<encoded>', () => {
    render(<TagFilter uniqueTags={['C#']} activeTag={null} />)
    expect(screen.getByRole('link', { name: 'All' }).getAttribute('href')).toMatch(/^\/blog\/?$/)
    // encodeURIComponent('C#') = 'C%23' — Next 16 Link może normalizować trailing slash.
    const cSharpChip = screen.getByRole('link', { name: 'C#' })
    expect(cSharpChip.getAttribute('href')).toMatch(/^\/blog\/?\?tag=C%23$/)
  })

  it('nav landmark ma aria-label', () => {
    render(<TagFilter uniqueTags={['AI']} activeTag={null} />)
    expect(
      screen.getByRole('navigation', { name: /filter posts by tag/i }),
    ).toBeInTheDocument()
  })
})
