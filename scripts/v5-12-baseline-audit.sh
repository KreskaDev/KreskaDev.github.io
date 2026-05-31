#!/usr/bin/env bash
# v5-12 baseline audit — 6 pages × mobile+desktop = 12 audits
# Per plan §5.0.4. PHASE = "baseline" lub "post" (env var).
# Server must be running on http://localhost:4173 (npx serve out -l 4173).
set -u

PHASE="${PHASE:-baseline}"
OUT_DIR="docs/perf/raw"
SERVER="http://localhost:4173"

mkdir -p "$OUT_DIR"

PAGES=(
  "/|home"
  "/blog/|blog"
  "/about/|about"
  "/posts/pozytywny-wynik/|post"
  "/posts/pozytywny-wynik/math/|math"
  "/posts/guitar-test/|guitar"
)

for entry in "${PAGES[@]}"; do
  page="${entry%%|*}"
  slug="${entry##*|}"
  for form in mobile desktop; do
    tmp_dir=$(mktemp -d)
    out_path="$OUT_DIR/${PHASE}_${slug}_${form}.json"
    echo ">>> ${PHASE} ${slug} ${form} -> ${out_path}"
    if [ "$form" = "mobile" ]; then
      npx lighthouse "${SERVER}${page}" --quiet \
        --chrome-flags="--headless=new --no-sandbox --user-data-dir=${tmp_dir}" \
        --output=json --output-path="${out_path}" \
        --form-factor=mobile --throttling-method=simulate \
        --only-categories=performance || true
    else
      npx lighthouse "${SERVER}${page}" --quiet \
        --chrome-flags="--headless=new --no-sandbox --user-data-dir=${tmp_dir}" \
        --output=json --output-path="${out_path}" \
        --preset=desktop --only-categories=performance || true
    fi
    if [ -f "${out_path}" ]; then
      echo "    ok ($(wc -c < "${out_path}") bytes)"
    else
      echo "    !! missing ${out_path}"
    fi
  done
done

echo ">>> done"
ls -la "$OUT_DIR"
