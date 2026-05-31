# v5-12 Performance Baseline (pre-implementation)

**Date:** 2026-05-31
**HEAD:** `aef3c1c` (pre Phase 1-3 refactor; v5-09 + v5-10 + v5-11 shipped on main)
**Lighthouse version:** 13.3.0
**Methodology:** per task.md Pre-confirmed #8 (mobile = `--form-factor=mobile --throttling-method=simulate`; desktop = `--preset=desktop`; single run per page, sequential, Windows EPERM workaround `|| true` on exit code).
**Server:** `npx serve out -l 4173` (static export from `out/`).
**Audit script:** `prod/scripts/v5-12-baseline-audit.sh` (`PHASE=baseline bash …`).
**Raw JSON:** `docs/perf/raw/baseline_*.json` (12 files, gitignored).

## Mobile (Moto G Power emulation, simulate 4G)

| Page | Perf | FCP | LCP | TBT | CLS | TTI | Unused JS |
|---|---|---|---|---|---|---|---|
| `/` | 89 | 0.9 s | 3.5 s | 150 ms | 0.000 | 3.5 s | 26 KB |
| `/blog/` | 91 | 0.9 s | 3.3 s | 140 ms | 0.000 | 3.3 s | 128 KB |
| `/about/` | 92 | 0.9 s | 3.3 s | 70 ms | 0.000 | 3.5 s | 26 KB |
| `/posts/pozytywny-wynik/` | 55 | 2.4 s | 5.0 s | 870 ms | 0.000 | 5.3 s | 70 KB |
| `/posts/pozytywny-wynik/math/` | 65 | 1.7 s | 4.9 s | 560 ms | 0.071 | 5.0 s | 127 KB |
| `/posts/guitar-test/` | 78 | 1.4 s | 4.1 s | 250 ms | 0.000 | 4.1 s | 127 KB |

## Desktop (1350×940, no throttling)

| Page | Perf | FCP | LCP | TBT | CLS | TTI | Unused JS |
|---|---|---|---|---|---|---|---|
| `/` | 100 | 0.3 s | 0.7 s | 0 ms | 0.000 | 0.7 s | 129 KB |
| `/blog/` | 100 | 0.2 s | 0.7 s | 10 ms | 0.000 | 0.7 s | 25 KB |
| `/about/` | 100 | 0.3 s | 0.7 s | 0 ms | 0.000 | 0.7 s | 26 KB |
| `/posts/pozytywny-wynik/` | 99 | 0.4 s | 0.8 s | 10 ms | 0.004 | 0.9 s | 69 KB |
| `/posts/pozytywny-wynik/math/` | 99 | 0.4 s | 0.8 s | 30 ms | 0.004 | 1.1 s | 127 KB |
| `/posts/guitar-test/` | 100 | 0.2 s | 0.7 s | 0 ms | 0.002 | 0.7 s | 127 KB |

## Bundle map (pre-refactor)

JS chunks in `out/_next/static/chunks/` (sorted by size, top 8):

| Chunk | Size | Contents (grep signal) |
|---|---|---|
| `16y_qryh22a7t.js` | **372 KB** | Recharts + BayesAnalyzer (eager-imported on every post route via `page.tsx`) |
| `0l1_47-31-frg.js` | 233 KB | framework/runtime |
| `0owkgqm8z-02-.js` | 151 KB | shared shell |
| `03~yq9q893hmn.js` | 113 KB | shared shell |
| `0n4z.7yu76je-.js` | 55 KB | shared shell |
| `07uz2g0_38qia.js` | 44 KB | shared shell |
| `0pxr.l9-xv_p2.js` | 34 KB | shared shell |
| `07-50gl00-1v~.js` | 28 KB | Fretboard widget (v5-11 chunk-split via raw `dynamic()` — already lazy, but still SSR-rendered) |

Total `out/_next/static/chunks/` = **1.18 MB** (uncompressed).

**Bundle analysis tool:** `next experimental-analyze -o` (Turbopack-native; produces `.next/diagnostics/analyze/`). See "Notes / deviations" below.

## Font transfer (pre-refactor)

Non-KaTeX `out/_next/static/media/*.woff2`: **13 files, 180.8 KB total** (Instrument Serif + Geist full 100-900 range + JetBrains Mono full range, split by Latin + Latin-Ext subsets).

KaTeX fonts (math) bundled via `katex` npm dep — out of scope per ADR-044 §4.2.

## Methodology

Lighthouse command pattern (per Pre-confirmed #8):

```bash
# Mobile
npx lighthouse "${URL}" --quiet \
  --chrome-flags="--headless=new --no-sandbox --user-data-dir=${TMP}" \
  --output=json --output-path="${OUT}" \
  --form-factor=mobile --throttling-method=simulate \
  --only-categories=performance || true

# Desktop
npx lighthouse "${URL}" --quiet \
  --chrome-flags="--headless=new --no-sandbox --user-data-dir=${TMP}" \
  --output=json --output-path="${OUT}" \
  --preset=desktop --only-categories=performance || true
```

Each audit uses a unique `--user-data-dir` to dodge Windows EPERM lock collisions (chrome-launcher cleanup crashes after report write — the JSON is on disk before the error, so `|| true` is safe).

## Notes / deviations

- **`@next/bundle-analyzer` Turbopack incompat (plan §0.9 deviation).** Plan locked `@next/bundle-analyzer@16.2.6` install + `withBundleAnalyzer` wrapper in `next.config.ts`. Empirical reality: `Next Bundle Analyzer is not compatible with Turbopack builds, no report will be generated.` Next.js explicitly suggests `next experimental-analyze` (Turbopack-native) or `--webpack` flag (legacy fallback). Picked `next experimental-analyze -o`: it produces `.next/diagnostics/analyze/` (`analyze.data` + `modules.data` + per-route HTML reports) without rebuilding. The vestigial wrapper + devDep were reverted; `next experimental-analyze` is a built-in CLI, no install needed. Phase 4 post-impl bundle delta uses the same tool.
- **Re-measurement was required** per plan §0.3 baseline freshness — task.md historical baseline (2026-05-31, pre v5-09+v5-11 merge) became reference-historical only; this file is the source of truth for Phase 4 §6.F acceptance gate comparison.
- **v5-11 chunk-split visible:** `07-50gl00-1v~.js` (28 KB) is the Fretboard chunk produced by v5-11's raw `dynamic()` (no `ssr:false`). v5-12 Phase 1 will move it into a Client Component HOC + `ssr:false`.
- **guitar-test post — first baseline of this page.** Did not exist in task.md historical baseline.
- **CLS observations:** `pozytywny-wynik/` mobile = 0.000 (was 0.101 in task.md historical, pre v5-11 chunk-split). Math subpage still has 0.071 (unchanged). v5-11 chunk-split appears to have neutralised the post-mobile CLS spike — Phase 1 HOC pattern must not regress this.
- **Mobile bottleneck = Bayes post (Perf 55, LCP 5.0 s, TBT 870 ms).** Recharts + BayesAnalyzer eager-loaded chunk (372 KB) is the main target for Phase 1.
- **Desktop already saturated** (99-100 on all six pages). Phase 4 acceptance gate §6.F applies "zero regression" — improvements expected dominantly on mobile.
