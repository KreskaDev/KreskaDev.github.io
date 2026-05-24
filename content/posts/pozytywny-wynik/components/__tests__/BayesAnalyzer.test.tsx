// Port 1:1 z archive/v4/components/bayes-analyzer/smoke.js sekcji WC (WC1-WC8).
// 8 component testów. Wrapper z ThemeProvider — useTheme w ChartView wymaga.
// ResizeObserver mock z fixed-size + offsetWidth/Height polyfill żyją w vitest.setup.ts.
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import type { ReactElement } from 'react'
import BayesAnalyzer from '../BayesAnalyzer'
import type { Clinic } from '../bayes-math'

function renderWithTheme(ui: ReactElement) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {ui}
    </ThemeProvider>,
  )
}

describe('BayesAnalyzer (port 1:1 z v4 WC tests)', () => {
  it('WC1 — preset=adhd single, pReal ≈ 7.8%', () => {
    renderWithTheme(<BayesAnalyzer preset="adhd" view="single" editable={false} />)
    // Posterior real dla preset adhd: π=0.07, s1=0.95, f1=0.85 → ~0.078 → "7.8%".
    expect(screen.getByText(/7\.8%/)).toBeInTheDocument()
  })

  it('WC2 — preset=A2 single, pNaive ≈ 48.6%', () => {
    renderWithTheme(<BayesAnalyzer preset="A2" view="single" editable={false} />)
    // Posterior naive dla A2: π=0.10, s0=0.85, f0=0.10 → ~0.486 → "48.6%".
    expect(screen.getByText(/48\.6%/)).toBeInTheDocument()
  })

  it('WC3 — editable={false} → brak sliderów w DOM (NIE disabled)', () => {
    renderWithTheme(<BayesAnalyzer preset="A2" view="single" editable={false} />)
    // V4 contract: read-only = no `<input type="range">` w DOM (pełen unmount).
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
  })

  it('WC4 — invalid clinics fallback (runtime guard, brak throw)', () => {
    // TS port: typowanie wymusza Clinic[], ale `Array.isArray` runtime guard chroni
    // przed JSON.parse junk lub MDX prop typo (np. clinics={'not-array'}).
    const { container } = renderWithTheme(
      <BayesAnalyzer
        preset="A2"
        view="sequential"
        editable={false}
        clinics={'not-array' as unknown as Clinic[]}
      />,
    )
    expect(container.firstChild).not.toBeNull()
    // Read-only mode → params-footer renderowany na dole.
    expect(container.querySelector('.params-footer')).toBeInTheDocument()
  })

  it('WC5 — view=sequential z clinics → chart rendered z 2 datasets', async () => {
    renderWithTheme(
      <BayesAnalyzer
        preset="adhd"
        view="sequential"
        editable={false}
        clinics={[
          { s1: 0.95, f1: 0.85, result: 1, name: 'Test' },
          { s1: 0.90, f1: 0.30, result: 1, name: 'Test 2' },
        ]}
      />,
    )
    // ChartView: mounted guard wymaga useEffect tick → waitFor dla .recharts-wrapper.
    await waitFor(() => {
      expect(document.querySelector('.recharts-wrapper')).toBeInTheDocument()
    })
    // Dwie linie (real + naive). Recharts renderuje <Line> jako .recharts-line.
    const lines = document.querySelectorAll('.recharts-line')
    expect(lines.length).toBeGreaterThanOrEqual(2)
  })

  it('WC6 — unmount → chart cleanup (no leak)', async () => {
    const { unmount } = renderWithTheme(
      <BayesAnalyzer
        preset="A2"
        view="sequential"
        editable={true}
        clinics={[{ s1: 0.95, f1: 0.85, result: 1, name: 'K1' }]}
      />,
    )
    await waitFor(() => {
      expect(document.querySelector('.recharts-wrapper')).toBeInTheDocument()
    })
    unmount()
    expect(document.querySelector('.recharts-wrapper')).toBeNull()
  })

  it('WC7 — mode=advanced z p₀=p₁=0.5 → posteriorAdvanced ≈ 21.9%', () => {
    // S* = 0.5*0.85 + 0.5*0.92 = 0.885; F* = 0.5*0.10 + 0.5*0.60 = 0.350
    // p = (0.10*0.885)/(0.10*0.885 + 0.90*0.350) ≈ 0.2193 ≈ 21.9%.
    // Bypass advanced confirmation modal: pass mode + p0/p1 direct props.
    renderWithTheme(
      <BayesAnalyzer
        preset="A2"
        view="playground"
        mode="advanced"
        editable={true}
        p0={0.5}
        p1={0.5}
      />,
    )
    expect(screen.getByText(/21\.9%/)).toBeInTheDocument()
  })

  it('WC9 — addClinic seeds new clinic z CURRENT s1 state, NIE preset value', () => {
    // Regresja vs v4 fix: preset A2 ma s1=0.92, ale user adjustuje slider do 0.85
    // przed dodaniem kliniki. Nowa klinika powinna mieć s1=0.85 (current state),
    // NIE 0.92 (preset). Matching v4 analyzer.js:773-778 behavior.
    renderWithTheme(
      <BayesAnalyzer preset="A2" view="sequential" editable={true} />,
    )

    // Slider s1 ma id="slider-s1" (SliderRow component, htmlFor matchuje input id).
    const s1Slider = document.getElementById('slider-s1') as HTMLInputElement
    expect(s1Slider).not.toBeNull()
    fireEvent.change(s1Slider, { target: { value: '0.85' } })

    const addBtn = screen.getByRole('button', { name: /dodaj klinikę/i })
    fireEvent.click(addBtn)

    // Nowa klinika row pokazuje "s₁=0.85 f₁=..." text. Verify text obecny w DOM.
    expect(screen.getByText(/s₁=0\.85/)).toBeInTheDocument()
  })

  it('WC8 — XSS defense w clinic name (<script> tag renderowany jako tekst)', () => {
    interface WindowWithXss extends Window { x?: boolean }
    const w = window as WindowWithXss
    delete w.x
    const payload = '<script>window.x=true</script>EVIL'
    renderWithTheme(
      <BayesAnalyzer
        preset="A2"
        view="sequential"
        editable={false}
        clinics={[{ s1: 0.9, f1: 0.5, result: 1, name: payload }]}
      />,
    )
    // React JSX auto-escapuje children → script tag renderowany jako tekst (NIE executes).
    expect(screen.getByText(payload)).toBeInTheDocument()
    expect(w.x).toBeUndefined()
  })
})
