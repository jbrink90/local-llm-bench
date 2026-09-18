#!/usr/bin/env bash
# Master orchestrator — clean scientific run end to end.
#
# 1. Clean stale artifacts/results (preserves screenshots/, output/snake-pygame/
#    from old runs are wiped too since we regenerate)
# 2. bench.sh --force → generate all artifacts + Playwright functional scores
# 3. run-opus-judgments.sh → pairwise vision + pygame CR + oi quality
# 4. build-leaderboard.mjs → aggregate scores with Elo
# 5. build-results-md.sh → final RESULTS.md
#
# Usage: ./scripts/run-full-benchmark.sh
# Log: overnight.log in repo root

set -uo pipefail
BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BENCH_DIR"

source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
nvm use 20 >/dev/null 2>&1
if [ -z "${AWS_PROFILE:-}" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  echo "ERROR: Set AWS_PROFILE or AWS_ACCESS_KEY_ID before running Opus judgments." >&2
  exit 1
fi

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

START_TIME=$(date +%s)

log "=========================================="
log "FULL BENCHMARK RUN — clean scientific start"
log "=========================================="
log "Models: $(jq -r '.models | join(", ")' bench.config.json)"
log "Benchmarks: $(jq -r '.benchmarks | map(.name) | join(", ")' bench.config.json)"
echo

# ---------- 1. Clean stale artifacts ----------
log "[1/5] Cleaning stale artifacts..."
rm -f raw/*.json raw/SUMMARY.txt raw/*.log
# Wipe all output except screenshots/ which may hold user photos
for dir in oi snake-pygame snake-html tetris todo calc markdown; do
  rm -f output/$dir/*.py output/$dir/*.html output/$dir/*.txt 2>/dev/null || true
done
# Wipe Playwright + Opus judgment artifacts (keep manual screenshots/ dir)
rm -f caxi-results/*.json caxi-results/*.png logs/*.log
# Keep: screenshots/ (user-taken photos), all drivers/ scripts/ prompts/ validators/ bench.sh
log "    cleaned raw/, output/*/, caxi-results/, logs/"
echo

# ---------- 2. Generate artifacts ----------
log "[2/5] Running bench.sh --force (generates + Playwright validates)..."
log "    expected duration: 2-3 hours for 6 models × 7 benchmarks"
./bench.sh --force 2>&1 | tee -a overnight.log
BENCH_EXIT=$?
log "    bench.sh exit=$BENCH_EXIT"
echo

if [ $BENCH_EXIT -ne 0 ]; then
  log "WARNING: bench.sh returned non-zero; continuing anyway"
fi

# ---------- 3. Opus judgments ----------
log "[3/5] Running Opus judgments (pairwise vision + pygame CR + oi quality)..."
log "    expected duration: 10-15 minutes, ~\$0.60"
./scripts/run-opus-judgments.sh 2>&1 | tee -a overnight.log
log "    opus-judgments done"
echo

# ---------- 4. Build leaderboard ----------
log "[4/5] Building leaderboard..."
node scripts/build-leaderboard.mjs 2>&1 | tee -a overnight.log
echo

# ---------- 5. Generate RESULTS.md ----------
log "[5/5] Generating RESULTS.md..."
./scripts/build-results-md.sh 2>&1 | tee -a overnight.log
echo

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
HOURS=$((ELAPSED / 3600))
MINUTES=$(((ELAPSED % 3600) / 60))

log "=========================================="
log "FULL RUN COMPLETE — ${HOURS}h ${MINUTES}m"
log "=========================================="
log "Results: $BENCH_DIR/RESULTS.md"
log "Leaderboard JSON: $BENCH_DIR/caxi-results/LEADERBOARD.json"
echo
echo "Top 3 from LEADERBOARD.json:"
jq -r '.[:3] | .[] | "  \(.model): \(.total|round * 10 / 10)/100 (func=\(.functional_score|round * 10 / 10) visual=\(.visual_score|round * 10 / 10) pycr=\(.pygame_review_score|round * 10 / 10) oi=\(.oi_quality_score|round * 10 / 10) effi=\(.efficiency_score|round * 10 / 10))"' caxi-results/LEADERBOARD.json
