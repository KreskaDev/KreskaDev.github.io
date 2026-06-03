// Presety bayesowskie — port 1:1 z archive/v4/components/bayes-analyzer/presets.js.
// 10 z v3 (A1-A3, B1-B3, C1-C2, D1-D2) + 4 case studies v4 (adhd, ai-detection, whiplash, niepoczytalnosc).
import type { Parameters } from './bayes-math'

export type PresetId =
  // A. Dojrzałość metody (z v3)
  | 'A1' | 'A2' | 'A3'
  // B. Typ procedury (z v3)
  | 'B1' | 'B2' | 'B3'
  // C. Kontekst epidemiologiczny (z v3)
  | 'C1' | 'C2'
  // D. Przypadki skrajne (z v3)
  | 'D1' | 'D2'
  // Case studies v4 — slug-id matchuje preset attribute w MDX
  | 'adhd' | 'ai-detection' | 'whiplash' | 'niepoczytalnosc'

export interface PresetData extends Parameters {
  name: string
}

export const PRESETS: Record<PresetId, PresetData> = {
  // A. Dojrzałość metody (z v3)
  A1: { name: 'Pilotaż',        pi: 0.05, s0: 0.65, s1: 0.70, f0: 0.20, f1: 0.75 },
  A2: { name: 'Standardowa',    pi: 0.10, s0: 0.85, s1: 0.92, f0: 0.10, f1: 0.60 },
  A3: { name: 'Złoty standard', pi: 0.10, s0: 0.95, s1: 0.96, f0: 0.03, f1: 0.15 },
  // B. Typ procedury (z v3)
  B1: { name: 'Kwestionariusz', pi: 0.10, s0: 0.80, s1: 0.95, f0: 0.10, f1: 0.85 },
  B2: { name: 'Wywiad',         pi: 0.10, s0: 0.75, s1: 0.78, f0: 0.12, f1: 0.40 },
  B3: { name: 'Z walidacją',    pi: 0.10, s0: 0.90, s1: 0.92, f0: 0.08, f1: 0.20 },
  // C. Kontekst epidemiologiczny (z v3)
  C1: { name: 'Rzadkie',        pi: 0.01, s0: 0.92, s1: 0.94, f0: 0.05, f1: 0.30 },
  C2: { name: 'Powszechne',     pi: 0.25, s0: 0.75, s1: 0.80, f0: 0.20, f1: 0.55 },
  // D. Przypadki skrajne (z v3)
  D1: { name: 'Idealny',        pi: 0.15, s0: 0.98, s1: 0.98, f0: 0.02, f1: 0.05 },
  D2: { name: 'Pesymistyczny',  pi: 0.05, s0: 0.70, s1: 0.75, f0: 0.25, f1: 0.85 },

  // Case studies v4 — slug-id matchuje preset attribute w MDX
  adhd:             { name: 'ADHD u dorosłych',                  pi: 0.07, s0: 0.80, s1: 0.95, f0: 0.10, f1: 0.85 },
  'ai-detection':   { name: 'AI-detection esejów',               pi: 0.15, s0: 0.70, s1: 0.50, f0: 0.05, f1: 0.25 },
  whiplash:         { name: 'Whiplash powypadkowy',              pi: 0.25, s0: 0.78, s1: 0.92, f0: 0.15, f1: 0.70 },
  niepoczytalnosc:  { name: 'Niepoczytalność w procesie karnym', pi: 0.04, s0: 0.95, s1: 0.97, f0: 0.05, f1: 0.20 },
} as const
