// Port 1:1 z archive/v4/components/bayes-analyzer/smoke.js sekcji math (ST0-ST18 + ST7b).
// 20 testów. Helper `expectWithin(actual, expected, tol)` matches v4 `within()` semantykę 1:1
// (vitest's `toBeCloseTo(value, precision)` używa precision jako liczba decimal digits —
// to nie pasuje do v4 explicit tolerance values).
import { describe, it, expect } from 'vitest'
import {
  posteriorNaive,
  posteriorReal,
  sStar,
  fStar,
  posteriorAdvanced,
  likelihoodRatio,
  sequentialUpdate,
  sequentialUpdateNaive,
  detectConflicts,
  formatPercentDiff,
} from '../bayes-math'
import type { Clinic } from '../bayes-math'
import { PRESETS } from '../presets'

function expectWithin(actual: number, expected: number, tol: number): void {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(
      `expected ${actual} within ${tol} of ${expected}, diff=${Math.abs(actual - expected)}`,
    )
  }
}

describe('bayes-math (port 1:1 z v4 smoke.js)', () => {
  const A2 = PRESETS.A2
  const D1 = PRESETS.D1
  const C1 = PRESETS.C1
  const D2 = PRESETS.D2

  describe('ST0 — likelihoodRatio walidacja', () => {
    it('rzuca jeśli result ∉ {0, 1}', () => {
      expect(() => likelihoodRatio(0.5, 0.1, 2 as unknown as 0 | 1)).toThrow()
      expect(() => likelihoodRatio(0.5, 0.1, '1' as unknown as 0 | 1)).toThrow()
    })
  })

  describe('ST1 — A2 pNaive ≈ 0.486', () => {
    it('returns 0.486 ± 0.001', () => {
      expectWithin(posteriorNaive(A2.pi, A2.s0, A2.f0), 0.486, 0.001)
    })
  })

  describe('ST2 — A2 pReal ≈ 0.146', () => {
    it('returns 0.146 ± 0.001', () => {
      expectWithin(posteriorReal(A2.pi, A2.s1, A2.f1), 0.146, 0.001)
    })
  })

  describe('ST3 — A2 diff ≈ −34.0 pp (kierunek + format)', () => {
    it('zaczyna od Unicode minus i |diff*100| ≈ 34.0', () => {
      const pNaive = posteriorNaive(A2.pi, A2.s0, A2.f0)
      const pReal = posteriorReal(A2.pi, A2.s1, A2.f1)
      const diff = pReal - pNaive
      const formatted = formatPercentDiff(diff)
      expect(formatted.startsWith('−')).toBe(true)
      expectWithin(Math.abs(diff * 100), 34.0, 0.5)
    })
  })

  describe('ST4 — D1 pNaive ≈ 0.896', () => {
    it('returns 0.896 ± 0.002', () => {
      expectWithin(posteriorNaive(D1.pi, D1.s0, D1.f0), 0.896, 0.002)
    })
  })

  describe('ST5 — D1 pReal ≈ 0.776', () => {
    it('returns 0.776 ± 0.005', () => {
      expectWithin(posteriorReal(D1.pi, D1.s1, D1.f1), 0.776, 0.005)
    })
  })

  describe('ST6 — A2, 3 zgodne +: trajektoria realna [0.100, 0.146, 0.207, 0.286]', () => {
    it('returns 4-element trajectory ± 0.005 per element', () => {
      const traj = sequentialUpdate(
        A2.pi,
        Array.from({ length: 3 }, () => ({ s1: A2.s1, f1: A2.f1, result: 1 as const })),
      )
      const expected = [0.100, 0.146, 0.207, 0.286]
      expect(traj).toHaveLength(4)
      expected.forEach((exp, i) => expectWithin(traj[i]!, exp, 0.005))
    })
  })

  describe('ST7 — A2 [+,−,+]: dip jakościowy', () => {
    it('traj[2] < traj[1] && traj[3] > traj[2]', () => {
      const traj = sequentialUpdate(A2.pi, [
        { s1: A2.s1, f1: A2.f1, result: 1 },
        { s1: A2.s1, f1: A2.f1, result: 0 },
        { s1: A2.s1, f1: A2.f1, result: 1 },
      ])
      expect(traj[2]!).toBeLessThan(traj[1]!)
      expect(traj[3]!).toBeGreaterThan(traj[2]!)
    })
  })

  describe('ST7b — A2 [+,−,+] quantitative: [0.100, 0.146, 0.033, 0.050]', () => {
    it('returns trajectory matching v4 reference ± 0.005', () => {
      const traj = sequentialUpdate(A2.pi, [
        { s1: A2.s1, f1: A2.f1, result: 1 },
        { s1: A2.s1, f1: A2.f1, result: 0 },
        { s1: A2.s1, f1: A2.f1, result: 1 },
      ])
      const expected = [0.100, 0.146, 0.033, 0.050]
      expected.forEach((exp, i) => expectWithin(traj[i]!, exp, 0.005))
    })
  })

  describe('ST8 — C1 pReal ≈ 0.031', () => {
    it('returns 0.031 ± 0.002', () => {
      expectWithin(posteriorReal(C1.pi, C1.s1, C1.f1), 0.031, 0.002)
    })
  })

  describe('ST9 — Advanced p₀=p₁=1: S* = s₁, F* = f₁ → identyczne z lekkim', () => {
    it('matches posteriorReal exact (1e-12)', () => {
      const S = sStar(A2.s0, A2.s1, 1)
      const F = fStar(A2.f0, A2.f1, 1)
      const pAdv = posteriorAdvanced(A2.pi, S, F)
      const pReal = posteriorReal(A2.pi, A2.s1, A2.f1)
      expectWithin(pAdv, pReal, 1e-12)
    })
  })

  describe('ST10 — Advanced p₀=p₁=0: S* = s₀, F* = f₀ → identyczne z naiwnym', () => {
    it('matches posteriorNaive exact (1e-12)', () => {
      const S = sStar(A2.s0, A2.s1, 0)
      const F = fStar(A2.f0, A2.f1, 0)
      const pAdv = posteriorAdvanced(A2.pi, S, F)
      const pNaive = posteriorNaive(A2.pi, A2.s0, A2.f0)
      expectWithin(pAdv, pNaive, 1e-12)
    })
  })

  describe('ST11 — Przykład ogólny π=0.10, p₀=0.60, p₁=0.10: pReal ≈ 0.192, LR⁺ ≈ 2.14', () => {
    it('matches v4 reference', () => {
      const S = sStar(0.85, 0.92, 0.10)
      const F = fStar(0.10, 0.60, 0.60)
      const p = posteriorAdvanced(0.10, S, F)
      const lr = S / F
      expectWithin(p, 0.192, 0.005)
      expectWithin(lr, 2.14, 0.05)
    })
  })

  describe('ST12 — Pathological f₁=0.90 > s₁=0.50, π=0.10: pReal ≈ 0.058', () => {
    it('returns 0.058 ± 0.002', () => {
      expectWithin(posteriorReal(0.10, 0.50, 0.90), 0.058, 0.002)
    })
  })

  describe('ST13 — D2 pReal ≈ 0.044', () => {
    it('returns 0.044 ± 0.002', () => {
      expectWithin(posteriorReal(D2.pi, D2.s1, D2.f1), 0.044, 0.002)
    })
  })

  describe('ST14 — A2, 7 zgodnych +: pReal ≈ 0.689', () => {
    it('returns finite 0.689 ± 0.010 (floating-point edge)', () => {
      const traj = sequentialUpdate(
        A2.pi,
        Array.from({ length: 7 }, () => ({ s1: A2.s1, f1: A2.f1, result: 1 as const })),
      )
      expectWithin(traj[7]!, 0.689, 0.010)
      expect(Number.isFinite(traj[7]!)).toBe(true)
    })
  })

  describe('ST15 — π=0.001, s₁=0.99, f₁=0.01: pReal ≈ 0.090', () => {
    it('returns 0.090 ± 0.002', () => {
      expectWithin(posteriorReal(0.001, 0.99, 0.01), 0.090, 0.002)
    })
  })

  describe('ST16 — sequentialUpdateNaive A2 [1,1,1]: [0.100, 0.486, 0.889, 0.986]', () => {
    it('returns 4-element trajectory ± 0.005', () => {
      const traj = sequentialUpdateNaive(A2.pi, A2.s0, A2.f0, [1, 1, 1])
      const expected = [0.100, 0.486, 0.889, 0.986]
      expected.forEach((exp, i) => expectWithin(traj[i]!, exp, 0.005))
    })
  })

  describe('ST17 — detectConflicts [1,1,0,1,0]: [2, 3, 4]', () => {
    it('returns flip indices (1-based)', () => {
      const clinics: Clinic[] = [1, 1, 0, 1, 0].map(r => ({
        s1: 0.9,
        f1: 0.5,
        result: r as 0 | 1,
      }))
      expect(detectConflicts(clinics)).toEqual([2, 3, 4])
    })
  })

  describe('ST18 — sequentialUpdate startuje od π, długość n+1', () => {
    it('respects shape contract', () => {
      const traj = sequentialUpdate(A2.pi, [
        { s1: A2.s1, f1: A2.f1, result: 1 },
        { s1: A2.s1, f1: A2.f1, result: 0 },
      ])
      expect(traj[0]).toBe(A2.pi)
      expect(traj).toHaveLength(3)
    })
  })
})
