'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from 'next-themes'

// Shared MDX widget — renderuje diagram Mermaid (sequenceDiagram / classDiagram /
// stateDiagram-v2 / erDiagram / C4Context / flowchart). Patrz ADR-047 + ADR-050.
//
// Lifecycle mirror BayesAnalyzer ChartView (mounted guard + useTheme + getComputedStyle
// CSS vars) — re-render reaguje na palette/mode flip dual-palette (ADR-041). Theme
// strategy = per-component dynamic re-render z module-scope race guard (multi-instance
// safety na showcase post z 6 diagramami).

export interface MermaidProps {
  chart: string
  caption?: string
  className?: string
  diagramKind?: 'sequence' | 'class' | 'state' | 'er' | 'c4' | 'flow'
}

// Module-scope singleton state ponad wszystkimi Mermaid instancjami w drzewie.
// Multi-instance race: 6 useEffects firing ~równocześnie po hydration, każdy woła
// mermaid.initialize() (config mutator). Bez guarda concurrent initialize calls mogą
// nadpisać config w trakcie pending render() z innego diagramu. Strategia: lazy import
// + flag per theme-key — pierwszy effect inicjalizuje dla theme'u, pozostałe skip.
let initializedForTheme: string | null = null
let mermaidLib: typeof import('mermaid').default | null = null

async function ensureMermaidInitialized(
  themeKey: string,
  themeVariables: Record<string, string>,
): Promise<typeof import('mermaid').default> {
  if (!mermaidLib) {
    mermaidLib = (await import('mermaid')).default
  }
  if (initializedForTheme !== themeKey) {
    mermaidLib.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables,
      securityLevel: 'strict',
    })
    initializedForTheme = themeKey
  }
  return mermaidLib
}

// Mapping Mermaid themeVariables → nasze CSS vars (dual-palette per ADR-041).
// Pojedyncza definicja, getComputedStyle czyta resolved values per palette/mode.
function readThemeVariables(): Record<string, string> {
  if (typeof document === 'undefined') return {}
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    primaryColor: v('--color-accent-soft'),
    primaryBorderColor: v('--color-accent'),
    primaryTextColor: v('--color-text-primary'),
    lineColor: v('--color-text-secondary'),
    secondaryColor: v('--color-surface-elevated'),
    tertiaryColor: v('--color-bg-secondary'),
    background: v('--color-bg-primary'),
    mainBkg: v('--color-accent-soft'),
    nodeBorder: v('--color-accent'),
    clusterBkg: v('--color-bg-secondary'),
    noteBkgColor: v('--color-burgundy-soft'),
    noteBorderColor: v('--color-burgundy'),
  }
}

export default function Mermaid({ chart, caption, className, diagramKind }: MermaidProps) {
  const reactId = useId()
  const renderCount = useRef(0)
  const hostRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  // Canonical next-themes mount-safe pattern — bez tego SSR/CSR mismatch dla
  // resolvedTheme (undefined w SSR). Spójność z BayesAnalyzer ChartView.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    let cancelled = false
    const themeKey = resolvedTheme ?? 'dark-cool'
    const themeVariables = readThemeVariables()
    renderCount.current += 1
    const id = `mermaid-${reactId.replace(/:/g, '')}-${renderCount.current}`

    ;(async () => {
      try {
        const lib = await ensureMermaidInitialized(themeKey, themeVariables)
        const { svg } = await lib.render(id, chart)
        if (cancelled) return
        if (hostRef.current) {
          hostRef.current.innerHTML = svg
        }
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Mermaid render failed:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mounted, resolvedTheme, chart, reactId])

  // diagramKind to hint dla LazyMermaid placeholder height — sam komponent go nie używa
  // poza pass-through dla LazyMermaid. Underscore w destructure nie idzie bo ESLint chce
  // explicit usage; void reference żeby uniknąć "noUnusedParameters" + dokumentuje intent.
  void diagramKind

  return (
    <figure className={`my-8 -mx-4 sm:mx-0 overflow-x-auto ${className ?? ''}`}>
      <div
        ref={hostRef}
        role="img"
        aria-label={caption ?? 'Diagram'}
        className="mermaid-host text-center"
      />
      {caption && (
        <figcaption className="text-sm text-text-tertiary text-center mt-2">
          {caption}
        </figcaption>
      )}
      {error && (
        <pre className="text-burgundy text-sm p-3 border border-burgundy-soft rounded mt-2 overflow-x-auto">
          Mermaid render error: {error}
        </pre>
      )}
    </figure>
  )
}
