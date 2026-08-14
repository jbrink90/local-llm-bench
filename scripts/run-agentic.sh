#!/opt/homebrew/bin/bash
# Overnight runner for the agentic dimension.
#
# Runs every offline-capable model through both variants, one model at a time so
# a 51 GB model never shares memory with another. Each model+variant gets a fresh
# copy of the fixture, because a model that half-fixes a repo must not hand the
# next model a head start.
#
# Fully offline by construction: models come from localhost, the fixture is
# vendored, and node's built-in test runner needs no install.
#
# Usage: scripts/run-agentic.sh [model ...]
set -uo pipefail

REPO="$(dirname "$(dirname "$(realpath "$0")")")"
RESULTS="$REPO/caxi-results"
RUNS="$REPO/output/agentic"
OLLAMA="${OLLAMA_URL:-http://localhost:11434}"

# Every model here must be pulled locally. Remote or LAN-hosted models are not
# eligible: the premise is a laptop with no network.
DEFAULT_MODELS=(
  "qwen3-coder:30b"
  "qwen3-coder-next"
  "qwen3.5:35b-a3b-coding-nvfp4"
  "qwen3-vl:30b"
  "gemma4:26b-mlx-bf16"
  "laguna-xs.2"
  "gpt-oss:20b"
)
MODELS=("$@")
[ ${#MODELS[@]} -eq 0 ] && MODELS=("${DEFAULT_MODELS[@]}")

mkdir -p "$RESULTS" "$RUNS"

log() { printf '%s  %s\n' "$(date '+%H:%M:%S')" "$*"; }

curl -sf --max-time 5 "$OLLAMA/api/version" > /dev/null || {
  log "FATAL: ollama unreachable at $OLLAMA"; exit 1
}

for MODEL in "${MODELS[@]}"; do
  SAFE=$(echo "$MODEL" | tr ':/' '--')

  # Fail loud on a model that is not pulled, rather than silently substituting one.
  if ! curl -sf --max-time 10 "$OLLAMA/api/show" -d "{\"model\":\"$MODEL\"}" > /dev/null; then
    log "SKIP $MODEL — not pulled locally"
    continue
  fi

  # ---- bug-fix leg (no vision: pure logic, nothing to render) ----
  WORK="$RUNS/bugfix-$SAFE"
  rm -rf "$WORK" && mkdir -p "$WORK"
  cp -R "$REPO/fixtures/expr-eval/." "$WORK/"

  log "START bugfix $MODEL"
  ( cd "$WORK" && AGENTIC_VISION=0 \
      node "$REPO/drivers/agentic.mjs" "$WORK" "$MODEL" "$RESULTS" "$SAFE" \
        "$REPO/prompts/agentic-bugfix.txt" > /dev/null 2>&1 )
  VERDICT=$("$REPO/validators/agentic-bugfix.sh" "$WORK" "$MODEL" "$RESULTS" 2>&1 | tail -1)
  log "DONE  bugfix $MODEL — $VERDICT"

  # ---- greenfield leg (vision applies: native or sidecar, resolved per model) ----
  WORK="$RUNS/greenfield-$SAFE"
  rm -rf "$WORK" && mkdir -p "$WORK"

  log "START greenfield $MODEL"
  ( cd "$WORK" && AGENTIC_VISION=1 \
      node "$REPO/drivers/agentic.mjs" "$WORK" "$MODEL" "$RESULTS" "$SAFE" \
        "$REPO/prompts/agentic-greenfield.txt" > /dev/null 2>&1 )
  VERDICT=$("$REPO/validators/agentic-greenfield.sh" "$WORK" "$MODEL" "$RESULTS" 2>&1 | tail -1)
  log "DONE  greenfield $MODEL — $VERDICT"

  # Free the weights before the next model loads. Two 51 GB models resident at
  # once would measure swap pressure, not the model.
  curl -s --max-time 10 "$OLLAMA/api/generate" \
    -d "{\"model\":\"$MODEL\",\"keep_alive\":0}" > /dev/null 2>&1
  sleep 5
done

log "ALL DONE — results in $RESULTS/agentic-*.json"
