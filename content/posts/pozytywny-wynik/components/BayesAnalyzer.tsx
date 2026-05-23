'use client'

// BayesAnalyzer — React port v4 Web Component <bayes-analyzer>.
// Per-instance state, brak global store (ADR-011). Recharts dla wykresów (ADR-009).
// Theme-aware colors przez useTheme + mounted guard (hydration mismatch fix).
// Referencje portu: archive/v4/components/bayes-analyzer/{analyzer.js, math.js, presets.js, analyzer.css}.

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTheme } from 'next-themes'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

import {
  posteriorNaive,
  posteriorReal,
  sStar,
  fStar,
  posteriorAdvanced,
  sequentialUpdate,
  sequentialUpdateNaive,
  detectConflicts,
  formatPercent,
  formatPercentDiff,
  formatParamValue,
  generateSummaryText,
} from './bayes-math'
import type { Clinic } from './bayes-math'
import { PRESETS } from './presets'
import type { PresetId } from './presets'

// ============================================================
// Constants
// ============================================================

const MAX_CLINICS = 7

// Editorial palette hex — verified z prod/app/globals.css :root + .dark.
// SVG `stroke` attribute NIE supportuje CSS var reliably cross-browser → inline hex.
const COLORS = {
  light: {
    naive: '#6B6B6B',      // text-secondary
    real: '#8B2635',       // burgundy
    conflict: '#3B6E47',   // green
    grid: '#E5E0D8',       // border
    text: '#1A1A1A',       // text-primary
    tooltipBg: '#F2EFE8',  // bg-secondary
  },
  dark: {
    naive: '#B5B0A6',
    real: '#D97785',
    conflict: '#7BA887',
    grid: '#383330',
    text: '#F5F2EC',
    tooltipBg: '#221F1C',
  },
} as const

// Ranges suwaków — port z analyzer.js linia 35-43.
const RANGES = {
  pi: { min: 0.001, max: 0.500, step: 0.001 },
  s0: { min: 0.50, max: 0.99, step: 0.01 },
  s1: { min: 0.50, max: 0.99, step: 0.01 },
  f0: { min: 0.01, max: 0.50, step: 0.01 },
  f1: { min: 0.01, max: 0.95, step: 0.01 },
  p0: { min: 0.00, max: 1.00, step: 0.01 },
  p1: { min: 0.00, max: 1.00, step: 0.01 },
} as const

const PARAM_LABELS: Record<string, { symbol: string; description: string }> = {
  pi: { symbol: 'π', description: 'priori — częstość zaburzenia' },
  s0: { symbol: 's₀', description: 'czułość reklamowana' },
  s1: { symbol: 's₁', description: 'czułość pod presją' },
  f0: { symbol: 'f₀', description: 'FPR reklamowana' },
  f1: { symbol: 'f₁', description: 'skuteczność oszustwa' },
  p0: { symbol: 'p₀', description: 'odsetek oszukujących zdrowych' },
  p1: { symbol: 'p₁', description: 'odsetek oszukujących chorych' },
}

// ============================================================
// Props
// ============================================================

interface BayesAnalyzerProps {
  preset?: PresetId
  view?: 'single' | 'sequential' | 'playground'
  mode?: 'light' | 'advanced'
  /** Default true (matches v4 contract per analyzer.js linia 9 + 501). */
  editable?: boolean
  pi?: number
  s0?: number
  s1?: number
  f0?: number
  f1?: number
  p0?: number
  p1?: number
  clinics?: Clinic[]
  height?: number
}

// ============================================================
// Main component
// ============================================================

export default function BayesAnalyzer(props: BayesAnalyzerProps) {
  const presetId: PresetId = props.preset ?? 'A2'
  const preset = PRESETS[presetId] ?? PRESETS.A2
  const view = props.view ?? 'single'
  // `editable` default = true per v4 contract; absence of attribute → true.
  const editable = props.editable ?? true
  const initialMode: 'light' | 'advanced' = props.mode ?? 'light'

  // State — initial values z props/preseta. Brak useEffect [preset] reset (v4 Init-only contract).
  const [pi, setPi] = useState<number>(props.pi ?? preset.pi)
  const [s0, setS0] = useState<number>(props.s0 ?? preset.s0)
  const [s1, setS1] = useState<number>(props.s1 ?? preset.s1)
  const [f0, setF0] = useState<number>(props.f0 ?? preset.f0)
  const [f1, setF1] = useState<number>(props.f1 ?? preset.f1)
  const [p0, setP0] = useState<number | undefined>(props.p0)
  const [p1, setP1] = useState<number | undefined>(props.p1)
  const [mode, setMode] = useState<'light' | 'advanced'>(initialMode)

  // Runtime guard chroni przed `clinics` jako JSON.parse junk (MDX prop może być cokolwiek).
  const initialClinics = Array.isArray(props.clinics) ? props.clinics : []
  const [clinics, setClinics] = useState<Clinic[]>(initialClinics)

  // Computed S*, F*, pNaive, pReal — derived per render.
  // Advanced: p0/p1 modulują S*/F*; light: S* = s1, F* = f1 (p0=p1=1 baked in).
  const S = mode === 'advanced' && p1 !== undefined ? sStar(s0, s1, p1) : s1
  const F = mode === 'advanced' && p0 !== undefined ? fStar(f0, f1, p0) : f1

  const pNaive = posteriorNaive(pi, s0, f0)
  const pReal = mode === 'advanced' ? posteriorAdvanced(pi, S, F) : posteriorReal(pi, s1, f1)

  const summaryText = generateSummaryText(pNaive, pReal, { mode, p0, p1 })

  const showSliders = editable
  const showSequential = view === 'sequential' || view === 'playground'
  const showAdvancedToggle = view === 'playground'

  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-6 my-8 not-prose font-sans">
      <Header presetName={preset.name} view={view} editable={editable} />

      <ResultDisplay
        pNaive={pNaive}
        pReal={pReal}
        summary={summaryText}
        s0={s0}
        f0={f0}
        s1={s1}
        f1={f1}
        S={S}
        F={F}
        mode={mode}
      />

      {showAdvancedToggle && (
        <ModeToggle
          mode={mode}
          onLight={() => {
            setMode('light')
            setP0(undefined)
            setP1(undefined)
          }}
          onAdvanced={() => {
            setMode('advanced')
            setP0(0.5)
            setP1(0.5)
          }}
        />
      )}

      {showSliders && (
        <ParameterSliders
          values={{ pi, s0, s1, f0, f1, p0, p1 }}
          mode={mode}
          onChange={(name, value) => {
            switch (name) {
              case 'pi': setPi(value); break
              case 's0': setS0(value); break
              case 's1': setS1(value); break
              case 'f0': setF0(value); break
              case 'f1': setF1(value); break
              case 'p0': setP0(value); break
              case 'p1': setP1(value); break
            }
          }}
        />
      )}

      {showSequential && (
        <ClinicsSection
          clinics={clinics}
          editable={editable}
          presetS1={preset.s1}
          presetF1={preset.f1}
          onClinicsChange={setClinics}
        />
      )}

      {showSequential && (
        <ChartView
          pi={pi}
          s0={s0}
          f0={f0}
          clinics={clinics}
        />
      )}

      {!editable && (
        <ParamsFooter pi={pi} s0={s0} s1={s1} f0={f0} f1={f1} />
      )}
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

interface HeaderProps {
  presetName: string
  view: 'single' | 'sequential' | 'playground'
  editable: boolean
}

function Header({ presetName, view, editable }: HeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-4 pb-3 border-b border-border">
      <div className="font-display text-lg text-text-primary">{presetName}</div>
      <div className="text-text-tertiary text-xs font-mono">
        view: {view}{editable ? '' : ' · read-only'}
      </div>
    </div>
  )
}

interface ResultDisplayProps {
  pNaive: number
  pReal: number
  summary: string
  s0: number
  f0: number
  s1: number
  f1: number
  S: number
  F: number
  mode: 'light' | 'advanced'
}

function ResultDisplay({
  pNaive,
  pReal,
  summary,
  s0,
  f0,
  s1,
  f1,
  S,
  F,
  mode,
}: ResultDisplayProps) {
  const diff = pReal - pNaive
  // LR display: naive = s0/f0; real-light = s1/f1; real-advanced = S*/F*.
  const lrNaive = Number.isFinite(s0 / f0) ? (s0 / f0).toFixed(2) : '∞'
  const lrReal = (mode === 'advanced' ? S / F : s1 / f1).toFixed(2)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-3" role="group" aria-label="Pojedyncza ocena: naiwny vs realny">
        <div>
          <div className="text-text-tertiary text-xs uppercase tracking-wider font-mono">Naiwny (advertised)</div>
          <div
            className="text-text-primary text-2xl font-display mt-1"
            aria-live="polite"
          >
            {formatPercent(pNaive)}
          </div>
          <div className="text-text-tertiary text-xs font-mono mt-0.5">LR⁺ = {lrNaive}</div>
        </div>
        <div>
          <div className="text-text-tertiary text-xs uppercase tracking-wider font-mono">Realny (pod presją)</div>
          <div
            className="text-burgundy text-2xl font-display mt-1"
            aria-live="polite"
          >
            {formatPercent(pReal)}
          </div>
          <div className="text-text-tertiary text-xs font-mono mt-0.5">LR⁺ = {lrReal}</div>
        </div>
      </div>
      <div className="text-text-secondary text-sm font-mono mb-1">{formatPercentDiff(diff)}</div>
      <div className="text-text-secondary text-sm">{summary}</div>
    </>
  )
}

interface ParameterSlidersProps {
  values: {
    pi: number
    s0: number
    s1: number
    f0: number
    f1: number
    p0: number | undefined
    p1: number | undefined
  }
  mode: 'light' | 'advanced'
  onChange: (name: 'pi' | 's0' | 's1' | 'f0' | 'f1' | 'p0' | 'p1', value: number) => void
}

function ParameterSliders({ values, mode, onChange }: ParameterSlidersProps) {
  const lightParams: ('pi' | 's0' | 's1' | 'f0' | 'f1')[] = ['pi', 's0', 's1', 'f0', 'f1']
  const advancedParams: ('p0' | 'p1')[] = ['p0', 'p1']

  return (
    <div className="mt-6 pt-4 border-t border-border space-y-3">
      {lightParams.map(name => (
        <SliderRow
          key={name}
          name={name}
          value={values[name]}
          onChange={v => onChange(name, v)}
        />
      ))}
      {mode === 'advanced' &&
        advancedParams.map(name => (
          <SliderRow
            key={name}
            name={name}
            value={values[name] ?? 0.5}
            onChange={v => onChange(name, v)}
          />
        ))}
    </div>
  )
}

interface SliderRowProps {
  name: keyof typeof RANGES
  value: number
  onChange: (value: number) => void
}

function SliderRow({ name, value, onChange }: SliderRowProps) {
  const range = RANGES[name]
  const label = PARAM_LABELS[name]
  return (
    <div className="flex items-center gap-3">
      <label className="text-text-primary text-sm font-display w-8 shrink-0" htmlFor={`slider-${name}`}>
        {label?.symbol ?? name}
      </label>
      <input
        id={`slider-${name}`}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        // accent-* Tailwind 4 utility może NIE być auto-generated z @theme tokens
        // (utility families filter); inline style gwarantuje brand accent reliably.
        style={{ accentColor: 'var(--color-burgundy)' }}
        className="flex-1"
      />
      <span className="font-mono text-sm text-text-primary w-12 text-right tabular-nums">
        {formatParamValue(name, value)}
      </span>
      <span className="text-text-tertiary text-xs hidden sm:block w-44 shrink-0">
        {label?.description ?? ''}
      </span>
    </div>
  )
}

interface ModeToggleProps {
  mode: 'light' | 'advanced'
  onLight: () => void
  onAdvanced: () => void
}

function ModeToggle({ mode, onLight, onAdvanced }: ModeToggleProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const handleToggle = () => {
    if (mode === 'light') {
      dialogRef.current?.showModal()
    } else {
      onLight()
    }
  }

  const confirm = () => {
    onAdvanced()
    dialogRef.current?.close()
  }

  const cancel = () => {
    dialogRef.current?.close()
  }

  return (
    <>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          className="text-sm font-sans text-burgundy hover:underline focus-visible:ring-2 focus-visible:ring-burgundy focus-visible:outline-none rounded"
        >
          {mode === 'light' ? 'Tryb zaawansowany →' : '← Tryb lekki'}
        </button>
        {mode === 'advanced' && (
          <span className="text-text-tertiary text-xs">parametry p₀, p₁ odblokowane</span>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="adv-modal-title"
        aria-describedby="adv-modal-desc"
        onClose={cancel}
        onClick={e => {
          // Click-outside dismiss: dialog target ≡ click target ⇒ click on backdrop.
          if (e.target === dialogRef.current) cancel()
        }}
        className="rounded-lg border border-border bg-bg-primary text-text-primary p-6 max-w-md backdrop:bg-black/50 not-prose"
      >
        <h3 id="adv-modal-title" className="font-display text-lg mb-3">
          Tryb zaawansowany — ostrzeżenie
        </h3>
        <p id="adv-modal-desc" className="text-text-secondary text-sm font-sans mb-6">
          Tryb zaawansowany odblokowuje parametry <strong>p₀, p₁</strong> — prawdopodobieństwa
          oszustwa wśród zdrowych i chorych. Wymaga znajomości modelu. Zmiana ustawień w tym trybie
          może produkować wyniki niespójne z założeniami modelu lekkiego.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={cancel}
            className="px-4 py-2 text-text-secondary hover:text-text-primary text-sm font-sans"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={confirm}
            autoFocus
            className="px-4 py-2 bg-burgundy text-bg-primary rounded text-sm font-sans hover:opacity-90"
          >
            Rozumiem, kontynuuj
          </button>
        </div>
      </dialog>
    </>
  )
}

interface ClinicsSectionProps {
  clinics: Clinic[]
  editable: boolean
  presetS1: number
  presetF1: number
  onClinicsChange: (clinics: Clinic[]) => void
}

function ClinicsSection({
  clinics,
  editable,
  presetS1,
  presetF1,
  onClinicsChange,
}: ClinicsSectionProps) {
  const addClinic = () => {
    if (clinics.length >= MAX_CLINICS) return
    onClinicsChange([
      ...clinics,
      {
        s1: presetS1,
        f1: presetF1,
        result: 1,
        name: `Klinika ${clinics.length + 1}`,
      },
    ])
  }

  const removeClinic = (i: number) => {
    onClinicsChange(clinics.filter((_, idx) => idx !== i))
  }

  const updateClinic = (i: number, patch: Partial<Clinic>) => {
    onClinicsChange(clinics.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <h4 className="font-display text-sm text-text-primary mb-3">
        Sekwencja klinik (do {MAX_CLINICS})
      </h4>
      {clinics.length === 0 && (
        <p className="text-text-tertiary text-sm mb-3">Brak klinik.</p>
      )}
      <ul className="space-y-2">
        {clinics.map((c, i) => (
          <li
            key={i}
            className="flex items-center gap-3 text-sm"
            data-testid="clinic-row"
          >
            <span className="text-text-tertiary font-mono w-6">{i + 1}.</span>
            {/* React JSX auto-escapuje children → XSS defense per WC8. */}
            <span className="clinic-name text-text-primary flex-1 truncate">{c.name ?? `Klinika ${i + 1}`}</span>
            <span className="text-text-secondary text-xs font-mono">
              s₁={c.s1.toFixed(2)} f₁={c.f1.toFixed(2)}
            </span>
            <span
              className={
                'text-xs font-mono px-2 py-0.5 rounded ' +
                (c.result === 1
                  ? 'text-burgundy bg-burgundy-soft'
                  : 'text-green bg-green-soft')
              }
            >
              {c.result === 1 ? '+' : '−'}
            </span>
            {editable && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    updateClinic(i, { result: c.result === 1 ? 0 : 1 })
                  }
                  className="text-text-tertiary hover:text-text-primary text-xs font-sans"
                  aria-label={`Przełącz wynik kliniki ${i + 1}`}
                >
                  flip
                </button>
                <button
                  type="button"
                  onClick={() => removeClinic(i)}
                  className="text-text-tertiary hover:text-burgundy text-xs font-sans"
                  aria-label={`Usuń klinikę ${i + 1}`}
                >
                  ×
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {editable && clinics.length < MAX_CLINICS && (
        <button
          type="button"
          onClick={addClinic}
          className="mt-3 text-sm font-sans text-burgundy hover:underline"
        >
          + dodaj klinikę
        </button>
      )}
    </div>
  )
}

interface ChartViewProps {
  pi: number
  s0: number
  f0: number
  clinics: Clinic[]
  height?: number
}

function ChartView({ pi, s0, f0, clinics, height = 320 }: ChartViewProps) {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()
  // Canonical next-themes mount-safe pattern (z ich docs) — bez tego SSR/CSR mismatch
  // bo resolvedTheme jest undefined w SSR. Reguła ESLint react-hooks/set-state-in-effect
  // (React 19/Next 16) flaguje pattern domyślnie; ten setState jest jednorazowy on mount,
  // nie cascading. Spójność z v5-02 ThemeToggle deviation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // Trajektorie — derived per render. useMemo redukuje re-compute przy nie-trajectory state change.
  const realTraj = useMemo(() => sequentialUpdate(pi, clinics), [pi, clinics])
  const naiveTraj = useMemo(
    () => sequentialUpdateNaive(pi, s0, f0, clinics.map(c => c.result)),
    [pi, s0, f0, clinics],
  )
  const conflicts = useMemo(() => detectConflicts(clinics), [clinics])

  if (!mounted) {
    // Placeholder same height — zapobiega CLS + hydration mismatch flash.
    return <div style={{ height }} aria-hidden className="mt-6" />
  }

  const colors = COLORS[resolvedTheme === 'dark' ? 'dark' : 'light']

  if (clinics.length === 0) {
    return (
      <div
        style={{ height }}
        className="mt-6 flex items-center justify-center border border-dashed border-border rounded text-text-tertiary text-sm"
      >
        Dodaj klinikę, by zobaczyć aktualizację posteriori.
      </div>
    )
  }

  const data = realTraj.map((real, i) => ({
    step: i,
    real: real * 100,
    naive: (naiveTraj[i] ?? 0) * 100,
  }))

  return (
    <div className="mt-6" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="step"
            stroke={colors.text}
            label={{
              value: 'Klinika',
              position: 'insideBottom',
              offset: -10,
              fill: colors.text,
            }}
          />
          <YAxis
            stroke={colors.text}
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              border: `1px solid ${colors.grid}`,
              color: colors.text,
            }}
            formatter={value => {
              const n = typeof value === 'number' ? value : Number(value)
              return Number.isFinite(n) ? `${n.toFixed(1)}%` : String(value)
            }}
          />
          <Line
            type="monotone"
            dataKey="real"
            stroke={colors.real}
            strokeWidth={2}
            dot={{ fill: colors.real, r: 4 }}
            name="Realna trajektoria"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="naive"
            stroke={colors.naive}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ fill: colors.naive, r: 3 }}
            name="Naiwna trajektoria"
            isAnimationActive={false}
          />
          {conflicts.map(idx => (
            <ReferenceLine
              key={idx}
              x={idx}
              stroke={colors.conflict}
              strokeDasharray="3 3"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface ParamsFooterProps {
  pi: number
  s0: number
  s1: number
  f0: number
  f1: number
}

function ParamsFooter({ pi, s0, s1, f0, f1 }: ParamsFooterProps) {
  return (
    <div
      className="params-footer mt-4 pt-3 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-text-tertiary text-xs font-mono"
      aria-label="parametry preseta"
    >
      <span>π = {formatParamValue('pi', pi)} <em className="font-sans not-italic text-text-tertiary">priori</em></span>
      <span>s₀ = {formatParamValue('s0', s0)} <em className="font-sans not-italic text-text-tertiary">czułość rekl.</em></span>
      <span>s₁ = {formatParamValue('s1', s1)} <em className="font-sans not-italic text-text-tertiary">czułość pod presją</em></span>
      <span>f₀ = {formatParamValue('f0', f0)} <em className="font-sans not-italic text-text-tertiary">FPR rekl.</em></span>
      <span>f₁ = {formatParamValue('f1', f1)} <em className="font-sans not-italic text-text-tertiary">skuteczność oszustwa</em></span>
    </div>
  )
}
