import type { Pluggable } from 'unified'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeKatex from 'rehype-katex'

// Pipeline order:
//   remark:  gfm  →  math
//   rehype:  slug →  autolink-headings  →  katex
//
// UWAGA — remark-heading-id (Plan v5-01 Step 14, ADR-003) DROPPED w v5-01:
// składnia `## Heading {#anchor}` konfliktuje z MDX 3 expression parsing (`{...}` =
// JSX expression → acorn syntax error). Wszystkie ID auto-generowane przez rehype-slug
// z tekstu heading (polskie diakrytyki → ASCII transliterate).
// Dla manualnych anchorów w przyszłych postach (port v4 ma ~10+ `{#...}`) używaj
// HTML syntax w MDX: <h2 id="custom-anchor">My Heading</h2> (mdx-components h2 styling
// nie zaaplikuje się — wymaga klasy inline). Pełne rozwiązanie + ADR-030 — Prompt 05.
export const mdxOptions = {
  remarkPlugins: [remarkGfm, remarkMath] as Pluggable[],
  rehypePlugins: [
    rehypeSlug,
    [
      rehypeAutolinkHeadings,
      {
        behavior: 'append',
        properties: { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 },
      },
    ],
    rehypeKatex,
  ] as Pluggable[],
}
