import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stub mermaid module zanim Mermaid.tsx zaimportuje — vi.mock jest hoistowany.
// renderSpy pozwala assertować że Mermaid.render dostało chart prop bez uruchamiania
// realnej biblioteki (która wymaga DOMParser + heavy bundle, nieidealnie w jsdom).
const renderSpy = vi.fn()
const initializeSpy = vi.fn()

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeSpy,
    render: renderSpy,
  },
}))

// next-themes mock — kontrolujemy resolvedTheme bez owijania w ThemeProvider.
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark-cool' }),
}))

beforeEach(() => {
  renderSpy.mockReset()
  initializeSpy.mockReset()
  // Default resolve — empty SVG. Per-test override jeśli potrzebny inny shape.
  renderSpy.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg"></svg>' })
})

afterEach(() => {
  vi.resetModules()
})

describe('Mermaid', () => {
  it('renderuje <figure> + caption + role="img" z aria-label', async () => {
    const { default: Mermaid } = await import('../Mermaid')
    render(<Mermaid chart="sequenceDiagram\n  A->>B: hi" caption="Test caption" diagramKind="sequence" />)

    const img = screen.getByRole('img', { name: 'Test caption' })
    expect(img).toBeInTheDocument()
    expect(screen.getByText('Test caption')).toBeInTheDocument()
  })

  it('woła mermaid.render() z chart prop po hydration', async () => {
    const { default: Mermaid } = await import('../Mermaid')
    render(<Mermaid chart="flowchart TD\n  A-->B" diagramKind="flow" />)

    await waitFor(() => {
      expect(renderSpy).toHaveBeenCalled()
    })
    const [, chartArg] = renderSpy.mock.calls[0] ?? []
    expect(chartArg).toContain('flowchart TD')
  })

  it('pokazuje error fallback gdy mermaid.render rzuca', async () => {
    renderSpy.mockRejectedValueOnce(new Error('Parse error: bad syntax'))
    const { default: Mermaid } = await import('../Mermaid')
    // Tłumimy console.error noise z error path (intentional log per Hard rule #5).
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<Mermaid chart="bad-chart-syntax" />)

    await waitFor(() => {
      expect(screen.getByText(/Mermaid render error/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Parse error: bad syntax/)).toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it('aria-label fallback = "Diagram" gdy brak caption', async () => {
    const { default: Mermaid } = await import('../Mermaid')
    render(<Mermaid chart="flowchart TD\n  A-->B" />)
    expect(screen.getByRole('img', { name: 'Diagram' })).toBeInTheDocument()
  })
})
