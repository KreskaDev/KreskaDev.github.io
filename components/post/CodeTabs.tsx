'use client'

import { Highlight, Prism } from 'prism-react-renderer'
import type { PrismTheme } from 'prism-react-renderer'
import { Tabs, TabItem, type TabDescriptor } from '@/components/ui/Tabs'

// Shared MDX widget — code samples z syntax highlighting + opcjonalnymi zakładkami
// per-language. Patrz ADR-048 + ADR-051. Compose nad istniejącym <Tabs> z components/ui
// (zero modyfikacji Tabs.tsx, pełen ARIA + keyboard inherited).
//
// prism-react-renderer v2 default bundle pokrywa ~30 languages ale NIE csharp ani
// powershell — wymagają side-effect import z prismjs/components/* używających global
// Prism reference. Setup MUSI być na top-level (przed function CodeBlock), z global
// assignment przed require() — kanoniczny Prism extension pattern.
;(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('prismjs/components/prism-csharp')
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('prismjs/components/prism-powershell')

export type SnippetLang = 'csharp' | 'typescript' | 'python' | 'powershell'

export interface Snippet {
  lang: SnippetLang
  code: string
  filename?: string
}

export interface CodeTabsProps {
  snippets: Snippet[]
  caption?: string
  className?: string
}

const LANG_LABELS: Record<SnippetLang, { title: string; tagline: string }> = {
  csharp: { title: 'C#', tagline: '.NET' },
  typescript: { title: 'TypeScript', tagline: 'Web / Node' },
  python: { title: 'Python', tagline: 'Data / LLM' },
  powershell: { title: 'PowerShell', tagline: 'Scripts' },
}

// prism-react-renderer 'tsx' = TypeScript + JSX support, lepsze niż 'typescript' alone.
const PRISM_LANG_MAP: Record<SnippetLang, string> = {
  csharp: 'csharp',
  typescript: 'tsx',
  python: 'python',
  powershell: 'powershell',
}

// Custom theme z `var(--color-*)` references — CSS vars handle dual-palette flip live,
// zero JS re-render dla colors (ADR-041 dual-palette + ADR-051 theme strategy).
const blogPrismTheme: PrismTheme = {
  plain: {
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-surface-elevated)',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: 'var(--color-text-tertiary)', fontStyle: 'italic' },
    },
    {
      types: ['punctuation'],
      style: { color: 'var(--color-text-secondary)' },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'],
      style: { color: 'var(--color-burgundy)' },
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: { color: 'var(--color-green)' },
    },
    {
      types: ['operator', 'entity', 'url', 'variable'],
      style: { color: 'var(--color-text-primary)' },
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: { color: 'var(--color-accent)' },
    },
    {
      types: ['function', 'class-name'],
      style: { color: 'var(--color-accent-hover)' },
    },
    {
      types: ['regex', 'important'],
      style: { color: 'var(--color-burgundy)' },
    },
  ],
}

function CodeBlock({ lang, code, filename }: Snippet) {
  const prismLang = PRISM_LANG_MAP[lang]
  return (
    <div className="not-prose">
      {filename && (
        <div className="text-xs font-mono text-text-tertiary px-3 py-1 border border-b-0 border-border bg-surface-elevated rounded-t">
          {filename}
        </div>
      )}
      <Highlight code={code.trim()} language={prismLang} theme={blogPrismTheme}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} overflow-x-auto p-4 text-sm font-mono leading-relaxed ${filename ? 'rounded-b' : 'rounded'}`}
            style={style}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, j) => (
                  <span key={j} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  )
}

export default function CodeTabs({ snippets, caption, className }: CodeTabsProps) {
  if (snippets.length === 0) return null

  // Single snippet → no tablist UI (per ADR-048 tab rendering rule).
  if (snippets.length === 1) {
    const only = snippets[0]
    if (!only) return null
    return (
      <figure className={`my-8 ${className ?? ''}`}>
        <CodeBlock {...only} />
        {caption && (
          <figcaption className="text-sm text-text-tertiary mt-2">{caption}</figcaption>
        )}
      </figure>
    )
  }

  // Multi-snippet → tablist z dokładnie providowanymi langs (NIE empty placeholders).
  const tabsDescriptors: TabDescriptor[] = snippets.map(s => ({
    id: s.lang,
    title: LANG_LABELS[s.lang].title,
    tagline: LANG_LABELS[s.lang].tagline,
  }))

  return (
    <figure className={`my-8 ${className ?? ''}`}>
      <Tabs tabs={tabsDescriptors} ariaLabel="Code samples" hashSync={false}>
        {snippets.map(s => (
          <TabItem key={s.lang} id={s.lang}>
            <CodeBlock {...s} />
          </TabItem>
        ))}
      </Tabs>
      {caption && (
        <figcaption className="text-sm text-text-tertiary mt-2">{caption}</figcaption>
      )}
    </figure>
  )
}
