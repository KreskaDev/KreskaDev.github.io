import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AboutIdentity } from '@/components/about/AboutIdentity'
import LazyNotation from '@/components/lazy/LazyNotation'
import LazyScaleOnFretboard from '@/components/lazy/LazyScaleOnFretboard'

// rehype-slug + rehype-autolink-headings dodają id + anchor link icons w pipeline,
// tutaj tylko styling przez className.
const mdxComponents: MDXComponents = {
  // H1 = brand moment per ADR-038 (Instrument Serif). MDX-rendered `#` na subpage'ach
  // (math.mdx etc.) wymaga explicit font-display bo prose-headings:font-display dropped
  // z Prose wrapper. PostPage header H1 jest poza prose (not-prose) z własnym className.
  h1: ({ children, ...props }) => (
    <h1
      className="font-display text-3xl sm:text-4xl text-text-primary mt-0 mb-6"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="font-sans font-semibold text-2xl md:text-3xl text-text-primary mt-12 mb-4"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="font-sans font-semibold text-xl md:text-2xl text-text-primary mt-8 mb-3"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4
      className="font-sans font-semibold text-xl text-text-primary mt-6 mb-2"
      {...props}
    >
      {children}
    </h4>
  ),
  // Table wrapper: bleed-edge -mx-4 sm:-mx-6 daje tabeli pełną szerokość
  // container'a, scroll overflow w wrapperze. `not-prose` resetuje prose
  // typography styling (border-collapse + spacing per Tailwind base).
  table: ({ children, ...props }) => (
    <div className="not-prose my-6 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
      <table className="min-w-full text-sm font-sans border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  a: ({ href, children, ...props }) => {
    if (typeof href !== 'string' || href.length === 0) {
      return <a {...props}>{children}</a>
    }
    const isExternal = /^https?:\/\//.test(href)
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:text-accent-hover"
          {...props}
        >
          {children} <span aria-hidden>↗</span>
        </a>
      )
    }
    return (
      <Link href={href} className="text-accent underline underline-offset-2 hover:text-accent-hover">
        {children}
      </Link>
    )
  },
  code: ({ children, ...props }) => (
    <code
      className="font-mono text-sm bg-surface-elevated px-1.5 py-0.5 rounded"
      {...props}
    >
      {children}
    </code>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-4 border-burgundy pl-4 italic text-text-secondary my-6"
      {...props}
    >
      {children}
    </blockquote>
  ),
  // Wrapper aplikujący prose styling do markdown content w środku.
  // Używany na stronach gdzie część MDX leci jako visual layout, a część
  // jako markdown prose (np. /about/ — identity card + prose obok).
  Prose: ({ children }: { children: ReactNode }) => (
    <div className="prose dark:prose-invert lg:flex-1 min-w-0">
      {children}
    </div>
  ),
  AboutIdentity,
  Notation: LazyNotation,
  ScaleOnFretboard: LazyScaleOnFretboard,
}

export default mdxComponents
