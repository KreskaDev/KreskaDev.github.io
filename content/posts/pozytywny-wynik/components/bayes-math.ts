// Pure math + formatery dla BayesAnalyzer. Port 1:1 z archive/v4/components/bayes-analyzer/math.js.
// Bez DOM, bez state. Wszystkie funkcje deterministyczne.
// Referencja semantyki: archive/v4/docs/handoff.md, archive/v3/docs/domain.md.

// ============================================================
// Typy domeny
// ============================================================

export interface Parameters {
  pi: number
  s0: number
  s1: number
  f0: number
  f1: number
}

export interface Clinic {
  s1: number
  f1: number
  result: 0 | 1  // 0 = negatyw, 1 = pozytyw (NIE '+'/'−' — to UI concern)
  name?: string
}

export interface AdvancedState {
  mode?: 'light' | 'advanced'
  p0?: number
  p1?: number
}

// ============================================================
// MATH — wariant lekki (p₀=p₁=1 baked in)
// ============================================================

// Bayes denominator: π·S + (1-π)·F. Zero tylko gdy zarówno S jak i F są 0
// (degenerowany test). UI nie pozwala na to (RANGES wymuszają s ≥ 0.50, f ≥ 0.01),
// ale guardujemy defensywnie żeby fail-loud zamiast NaN.
function safeBayes(pi: number, S: number, F: number): number {
  const denom = pi * S + (1 - pi) * F
  if (!Number.isFinite(denom) || denom <= 0) {
    throw new Error(`Bayes denominator = ${denom} (pi=${pi}, S=${S}, F=${F})`)
  }
  return (pi * S) / denom
}

export const posteriorNaive = (pi: number, s0: number, f0: number): number =>
  safeBayes(pi, s0, f0)

export const posteriorReal = (pi: number, s1: number, f1: number): number =>
  safeBayes(pi, s1, f1)

// ============================================================
// MATH — wariant ogólny (advanced mode, p₀/p₁ jako parametry)
// ============================================================

export const sStar = (s0: number, s1: number, p1: number): number =>
  (1 - p1) * s0 + p1 * s1

export const fStar = (f0: number, f1: number, p0: number): number =>
  (1 - p0) * f0 + p0 * f1

export const posteriorAdvanced = (pi: number, S: number, F: number): number =>
  safeBayes(pi, S, F)

// ============================================================
// LR + sekwencyjne
// ============================================================

export function likelihoodRatio(s: number, f: number, result: 0 | 1): number {
  if (result !== 0 && result !== 1) {
    throw new Error(`likelihoodRatio: result musi być 0 lub 1, dostałem ${result} (${typeof result})`)
  }
  return result === 1 ? s / f : (1 - s) / (1 - f)
}

// Realna trajektoria — per-clinic s₁, f₁ (multi-klinika-lekki).
export function sequentialUpdate(prior: number, clinics: Clinic[]): number[] {
  let odds = prior / (1 - prior)
  const trajectory: number[] = [prior]
  for (const clinic of clinics) {
    const lr = likelihoodRatio(clinic.s1, clinic.f1, clinic.result)
    odds *= lr
    trajectory.push(odds / (1 + odds))
  }
  return trajectory
}

// Naiwna trajektoria — GLOBALNE s₀, f₀ jednolicie (naiwny-sekwencyjny).
// Naiwny analityk nie ma per-clinic deception params.
export function sequentialUpdateNaive(
  prior: number,
  s0: number,
  f0: number,
  results: (0 | 1)[],
): number[] {
  let odds = prior / (1 - prior)
  const trajectory: number[] = [prior]
  for (const result of results) {
    const lr = likelihoodRatio(s0, f0, result)
    odds *= lr
    trajectory.push(odds / (1 + odds))
  }
  return trajectory
}

// Wykrywanie flipów wyniku w sekwencji — indeksy konfliktów dla wizualizacji.
export function detectConflicts(clinics: Clinic[]): number[] {
  const conflicts: number[] = []
  for (let i = 1; i < clinics.length; i++) {
    if (clinics[i]!.result !== clinics[i - 1]!.result) {
      conflicts.push(i)
    }
  }
  return conflicts
}

// ============================================================
// FORMATTERS
// ============================================================

export function formatPercent(p: number): string {
  if (!Number.isFinite(p)) {
    throw new Error(`formatPercent: p musi być skończoną liczbą, dostałem ${p}`)
  }
  const pct = p * 100
  if (pct < 0.01) return pct.toFixed(3) + '%'
  if (pct < 0.1) return pct.toFixed(2) + '%'
  return pct.toFixed(1) + '%'
}

export function formatPercentDiff(diff: number): string {
  if (!Number.isFinite(diff)) {
    throw new Error(`formatPercentDiff: diff musi być skończoną liczbą, dostałem ${diff}`)
  }
  const v = (diff * 100).toFixed(1)
  if (v === '-0.0' || v === '0.0') return '0.0 pp'
  if (diff > 0) return '+' + v + ' pp'
  // Unicode minus U+2212 — design decision v4 (typografia).
  return '−' + v.slice(1) + ' pp'
}

export function formatParamValue(name: string, v: number): string {
  // π ma step 0.001 → 3 cyfry; pozostałe step 0.01 → 2 cyfry.
  return name === 'pi' ? v.toFixed(3) : v.toFixed(2)
}

// state = { mode, p0, p1 } — minimum potrzebne do edge case'ów advanced.
export function generateSummaryText(
  pNaive: number,
  pReal: number,
  state: AdvancedState = {},
): string {
  const absDiff = Math.abs(pNaive - pReal)

  // Edge: advanced + p₀=p₁=0 → realny ≡ naiwny z definicji.
  if (state.mode === 'advanced' && state.p0 === 0 && state.p1 === 0) {
    return 'Brak oszustwa (p₀ = p₁ = 0) — realny model degeneruje do naiwnego.'
  }

  // Edge: naiwny NIEDOSZACOWAŁ (pReal > pNaive). Możliwe gdy LR realny > naiwnego.
  if (pReal > pNaive && absDiff > 0.05) {
    return 'Naiwny model niedoszacował pewność — realny model daje wyższą wartość.'
  }

  const naiveOvershoot = pNaive > pReal
  if (absDiff > 0.20 && naiveOvershoot && pReal > 0) {
    const ratio = pNaive / pReal
    return `Naiwny model nadszacował pewność ponad ${ratio.toFixed(1)}-krotnie.`
  }
  if (absDiff > 0.10) return 'Naiwny model wyraźnie nadszacował pewność.'
  if (absDiff > 0.05) return 'Naiwny model nadszacował pewność.'
  return 'Oszustwo ma niewielki wpływ przy tych parametrach.'
}
