import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AboutIdentity } from '@/components/about/AboutIdentity'

// rehype-slug + rehype-autolink-headings dodają id + anchor link icons w pipeline,
// tutaj tylko styling przez className.
const mdxComponents: MDXComponents = {
  h2: ({ children, ...props }) => (
    <h2
      className="font-display text-3xl text-text-primary mt-12 mb-4"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="font-display text-2xl text-text-primary mt-8 mb-3"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4
      className="font-display text-xl text-text-primary mt-6 mb-2"
      {...props}
    >
      {children}
    </h4>
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
          className="text-burgundy underline underline-offset-2"
          {...props}
        >
          {children} <span aria-hidden>↗</span>
        </a>
      )
    }
    return (
      <Link href={href} className="text-burgundy underline underline-offset-2">
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
    <div className="prose dark:prose-invert prose-headings:font-display lg:flex-1 min-w-0">
      {children}
    </div>
  ),
  AboutIdentity,
}

export default mdxComponents
