import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CodeTabs from '../CodeTabs'

// Tabs.tsx (immutable v5-04) woła `scrollIntoView` po activate — jsdom nie implementuje.
// Stub żeby keyboard nav test nie generował unhandled rejection.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const csharpSample = {
  lang: 'csharp' as const,
  filename: 'Loan.cs',
  code: 'public sealed class Loan { public int Id { get; } }',
}

const typescriptSample = {
  lang: 'typescript' as const,
  filename: 'loan.ts',
  code: 'export const loan = { id: 1 }',
}

const pythonSample = {
  lang: 'python' as const,
  code: 'def hello():\n    pass',
}

const powershellSample = {
  lang: 'powershell' as const,
  code: 'param([string]$Name)\nWrite-Host "hi $Name"',
}

describe('CodeTabs', () => {
  it('single snippet → no tablist UI', () => {
    render(<CodeTabs snippets={[pythonSample]} />)
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    // Code block ma `<pre>`
    const pres = document.querySelectorAll('pre')
    expect(pres.length).toBeGreaterThan(0)
  })

  it('2 snippets → tablist z 2 buttons + labels matchują LANG_LABELS', () => {
    render(<CodeTabs snippets={[csharpSample, typescriptSample]} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]?.textContent).toContain('C#')
    expect(tabs[1]?.textContent).toContain('TypeScript')
  })

  it('default visible = pierwszy snippet (csharp wybrany, NIE typescript)', () => {
    render(<CodeTabs snippets={[csharpSample, typescriptSample]} />)
    const panel = screen.getByRole('tabpanel')
    expect(panel.textContent).toContain('Loan')
    expect(panel.textContent).not.toContain('loan = { id')
  })

  it('caption prop renders w <figcaption>', () => {
    render(<CodeTabs snippets={[pythonSample]} caption="Python sample caption" />)
    expect(screen.getByText('Python sample caption')).toBeInTheDocument()
  })

  it('filename prop renders w header przed code', () => {
    render(<CodeTabs snippets={[csharpSample]} />)
    expect(screen.getByText('Loan.cs')).toBeInTheDocument()
  })

  it('tab keyboard nav inherits z Tabs — ArrowRight aktywuje następny tab', () => {
    render(<CodeTabs snippets={[csharpSample, typescriptSample]} />)
    const tabs = screen.getAllByRole('tab')
    const firstTab = tabs[0]
    if (!firstTab) throw new Error('First tab missing')
    fireEvent.keyDown(firstTab, { key: 'ArrowRight' })
    // Po ArrowRight: drugi tab powinien być aria-selected="true"
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true')
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('false')
  })

  it('Prism C# coverage — keyword "public" ma token class (NIE plain text)', () => {
    const { container } = render(<CodeTabs snippets={[csharpSample]} />)
    // Po side-effect import prism-csharp `public` → <span class="token keyword">.
    const tokens = container.querySelectorAll('.token.keyword')
    expect(tokens.length).toBeGreaterThan(0)
    const hasPublic = Array.from(tokens).some(t => t.textContent === 'public')
    expect(hasPublic).toBe(true)
  })

  it('Prism PowerShell coverage — keyword "param" ma token class (NIE plain text)', () => {
    const { container } = render(<CodeTabs snippets={[powershellSample]} />)
    // Po side-effect import prism-powershell `param` → token highlight.
    const allTokens = container.querySelectorAll('[class*="token"]')
    const hasParamHighlighted = Array.from(allTokens).some(
      t => t.textContent === 'param',
    )
    expect(hasParamHighlighted).toBe(true)
  })

  it('0 snippets → returns null', () => {
    const { container } = render(<CodeTabs snippets={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
