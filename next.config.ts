import type { NextConfig } from 'next'

// output:'export' = static export do out/ (GH Pages target, ADR-001).
// pageExtensions = ['ts','tsx'] (default) — MDX nie jest pages-em, ładowane przez compileMDX
// z next-mdx-remote/rsc (ADR-029, supersedes ADR-022 partial). @next/mdx wrapper dropped.
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '',
  images: { unoptimized: true },
}

export default config
