#!/usr/bin/env bash
# Run all Opus-based judgments across every model × benchmark combination.
# Assumes bench.sh has already generated artifacts.
#
# - Pairwise vision on web benchmarks (snake-html, tetris, todo, calc, markdown)
# - Code review on pygame artifacts
# - Text quality on oi responses
#
# Usage: ./run-opus-judgments.sh [--force]
#
# Outputs written to caxi-results/
#   pairwise-<bench>-<modelA>-vs-<modelB>.json
#   snake-pygame-review-<model>.json
#   oi-quality-<model>.json

set -uo pipefail

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS="$BENCH_DIR/caxi-results"
RAW="$BENCH_DIR/raw"
OUTPUT="$BENCH_DIR/output"

FORCE=false
[ "${1:-}" = "--force" ] && FORCE=true

source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
nvm use 20 >/dev/null 2>&1
if [ -z "${AWS_PROFILE:-}" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  echo "ERROR: Set AWS_PROFILE or AWS_ACCESS_KEY_ID before running Opus judgments." >&2
  exit 1
fi

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Discover models from existing oi outputs — they're the "who ran" truth
mapfile -t MODELS < <(ls "$RAW"/oi-*.json 2>/dev/null | sed -E 's|.*/oi-(.*)\.json|\1|' | sort -u)
if [ ${#MODELS[@]} -eq 0 ]; then
  echo "ERROR: no models found. Run bench.sh first." >&2
  exit 1
fi
log "models: ${MODELS[*]}"

WEB_BENCHMARKS=(snake-html tetris todo calc markdown)

# ---------- 1. Pairwise vision scoring ----------
log "=== PAIRWISE VISION SCORING ==="
for bench in "${WEB_BENCHMARKS[@]}"; do
  log "--- $bench ---"
  for (( i=0; i<${#MODELS[@]}; i++ )); do
    for (( j=i+1; j<${#MODELS[@]}; j++ )); do
      A="${MODELS[i]}"
      B="${MODELS[j]}"
      OUT="$RESULTS/pairwise-$bench-$A-vs-$B.json"
      if ! $FORCE && [ -s "$OUT" ]; then
        continue
      fi
      IMG_A="$RESULTS/$bench-$A.png"
      IMG_B="$RESULTS/$bench-$B.png"
      if [ ! -s "$IMG_A" ] || [ ! -s "$IMG_B" ]; then
        log "  skip: missing screenshot ($bench-$A or $bench-$B)"
        continue
      fi
      RAW_OUT=$(node "$BENCH_DIR/drivers/vision-pairwise.mjs" "$IMG_A" "$IMG_B" "$bench" 2>/dev/null)
      if [ -z "$RAW_OUT" ]; then
        log "  FAIL: $A vs $B"
        continue
      fi
      echo "$RAW_OUT" > "$OUT"
      winner=$(jq -r '.winner' "$OUT")
      delta=$(jq -r '.delta' "$OUT")
      log "  $A vs $B → winner=$winner delta=$delta"
    done
  done
done

# ---------- 2. Pygame code review ----------
log ""
log "=== PYGAME CODE REVIEW ==="
for MODEL in "${MODELS[@]}"; do
  OUT="$RESULTS/snake-pygame-review-$MODEL.json"
  if ! $FORCE && [ -s "$OUT" ]; then
    continue
  fi
  ARTIFACT="$OUTPUT/snake-pygame/$MODEL.py"
  if [ ! -s "$ARTIFACT" ]; then
    log "  skip: no pygame artifact for $MODEL"
    continue
  fi
  RESULT=$(node "$BENCH_DIR/drivers/opus-code-review.mjs" "$ARTIFACT" "$MODEL" "$RESULTS" 2>&1)
  log "  $MODEL: $RESULT"
done

# ---------- 3. Oi text quality ----------
log ""
log "=== OI TEXT QUALITY ==="
for MODEL in "${MODELS[@]}"; do
  OUT="$RESULTS/oi-quality-$MODEL.json"
  if ! $FORCE && [ -s "$OUT" ]; then
    continue
  fi
  RAW_JSON="$RAW/oi-$MODEL.json"
  if [ ! -s "$RAW_JSON" ]; then
    log "  skip: no oi raw for $MODEL"
    continue
  fi
  RESULT=$(node "$BENCH_DIR/drivers/opus-text-quality.mjs" "$RAW_JSON" "$MODEL" "$RESULTS" 2>&1)
  log "  $MODEL: $RESULT"
done

log ""
log "=== ALL OPUS JUDGMENTS DONE ==="
