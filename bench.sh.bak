#!/opt/homebrew/bin/bash
# local-llm-bench — extensible benchmark framework for local coder LLMs.
#
# Reads bench.config.yaml, runs each benchmark prompt against each model via
# ollama HTTP API, extracts code artifacts, runs validators.
#
# Usage:
#   ./bench.sh                 # skip existing outputs (fast re-run)
#   ./bench.sh --force         # regenerate everything
#   ./bench.sh --only todo     # run only the "todo" benchmark
#   ./bench.sh --model glm-4.7-flash   # only one model
#
# Dependencies: ollama running locally, jq, yq, python3, caxi (for web benchmarks).

set -uo pipefail

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$BENCH_DIR/bench.config.json"

# --- CLI flags ---
FORCE=false
ONLY_BENCH=""
ONLY_MODEL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=true ;;
    --only) ONLY_BENCH="$2"; shift ;;
    --model) ONLY_MODEL="$2"; shift ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

# --- Dependency checks ---
for cmd in jq curl python3; do
  command -v "$cmd" >/dev/null || { echo "ERROR: $cmd not installed" >&2; exit 1; }
done
command -v caxi >/dev/null || echo "WARN: caxi not found — web validators will skip browser tests"

# --- Load config ---
KEEP_ALIVE=$(jq -r '.runtime.keep_alive' "$CONFIG")
TIMEOUT_SECS=$(jq -r '.runtime.timeout_secs' "$CONFIG")
OLLAMA_URL=$(jq -r '.runtime.ollama_url' "$CONFIG")
SKIP_EXISTING=$(jq -r '.runtime.skip_if_exists' "$CONFIG")
$FORCE && SKIP_EXISTING=false

mapfile -t MODELS < <(jq -r '.models[]' "$CONFIG")
mapfile -t BENCHMARKS < <(jq -r '.benchmarks[].name' "$CONFIG")

[ -n "$ONLY_MODEL" ] && MODELS=("$ONLY_MODEL")
[ -n "$ONLY_BENCH" ] && BENCHMARKS=("$ONLY_BENCH")

mkdir -p "$BENCH_DIR/logs" "$BENCH_DIR/raw" "$BENCH_DIR/caxi-results"

SUMMARY="$BENCH_DIR/raw/SUMMARY.txt"
: > "$SUMMARY"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

ns_to_s() {
  local ns="$1"
  [ -z "$ns" ] || [ "$ns" = "null" ] && { echo "?"; return; }
  awk -v n="$ns" 'BEGIN {
    s = n / 1e9
    if (s < 1) printf "%.3fms\n", s*1000
    else if (s < 60) printf "%.3fs\n", s
    else { m = int(s/60); r = s - m*60; printf "%dm%.3fs\n", m, r }
  }'
}

api_generate() {
  local model="$1" prompt="$2" out="$3"
  jq -n --arg m "$model" --arg p "$prompt" --arg k "$KEEP_ALIVE" --argjson np 16000 \
    '{model:$m, prompt:$p, stream:false, keep_alive:$k, options:{num_predict:$np}}' \
    | curl -sS --max-time "$TIMEOUT_SECS" \
           -X POST "$OLLAMA_URL/api/generate" \
           -H 'Content-Type: application/json' \
           -d @- > "$out"
  jq -e '.response' "$out" >/dev/null 2>&1
}

# Extract code block from response. $2 = language tag (python/html) or empty.
extract_code() {
  local file="$1" lang="${2:-}"
  if [ -n "$lang" ]; then
    awk -v l="^\`\`\`$lang" '
      $0 ~ l && !in_block { in_block=1; next }
      /^```[[:space:]]*$/ && in_block { exit }
      in_block { print }
    ' "$file"
  else
    # No fence expected — return raw content
    cat "$file"
  fi
}

ext_for_benchmark() {
  jq -r ".benchmarks[] | select(.name == \"$1\") | .ext" "$CONFIG"
}

lang_for_ext() {
  case "$1" in
    py) echo "python" ;;
    html) echo "html" ;;
    *) echo "" ;;
  esac
}

stop_all_models() {
  ollama ps 2>/dev/null | awk 'NR>1 {print $1}' | while read -r m; do
    [ -n "$m" ] && ollama stop "$m" 2>/dev/null || true
  done
}

# --- Main loop ---
log "=== BENCHMARK START: $(date) ==="
log "Models: ${MODELS[*]}"
log "Benchmarks: ${BENCHMARKS[*]}"
log "Skip existing: $SKIP_EXISTING"
echo

for MODEL in "${MODELS[@]}"; do
  SAFE=$(echo "$MODEL" | tr ':/' '--')
  log "=========================================="
  log "MODEL: $MODEL"
  log "=========================================="

  # Pull (no-op if cached)
  if ! ollama pull "$MODEL" 2>&1 | tail -3; then
    log "FAILED to pull $MODEL, skipping"
    {
      echo "=== $MODEL ==="
      echo "  FAILED (pull error)"
      echo
    } >> "$SUMMARY"
    continue
  fi

  for BENCH in "${BENCHMARKS[@]}"; do
    EXT=$(ext_for_benchmark "$BENCH")
    LANG=$(lang_for_ext "$EXT")
    PROMPT_FILE="$BENCH_DIR/prompts/$BENCH.txt"
    OUT_FILE="$BENCH_DIR/output/$BENCH/$SAFE.$EXT"
    RAW_FILE="$BENCH_DIR/raw/$BENCH-$SAFE.json"
    LOG_FILE="$BENCH_DIR/logs/$BENCH-$SAFE.log"
    VALIDATOR="$BENCH_DIR/validators/$BENCH.sh"

    mkdir -p "$(dirname "$OUT_FILE")"

    if [ ! -f "$PROMPT_FILE" ]; then
      log "  [$BENCH] SKIP: no prompts/$BENCH.txt"
      continue
    fi
    if $SKIP_EXISTING && [ -s "$OUT_FILE" ] && [ -f "$RAW_FILE" ]; then
      log "  [$BENCH] SKIP: output exists ($OUT_FILE)"
      continue
    fi

    PROMPT=$(cat "$PROMPT_FILE")
    log "  [$BENCH] prompt: $(echo "$PROMPT" | head -c 60)..."

    # Cold load per benchmark — honest load_duration for every (model, benchmark) pair
    stop_all_models
    sleep 2

    if ! api_generate "$MODEL" "$PROMPT" "$RAW_FILE"; then
      log "  [$BENCH] FAILED API call"
      continue
    fi

    LD=$(jq -r '.load_duration' "$RAW_FILE")
    TD=$(jq -r '.total_duration' "$RAW_FILE")
    EC=$(jq -r '.eval_count' "$RAW_FILE")
    log "  [$BENCH] load=$(ns_to_s "$LD") total=$(ns_to_s "$TD") tokens=$EC"

    # Save human-readable log
    {
      echo "# $MODEL — $BENCH"
      echo "# load=$(ns_to_s "$LD") total=$(ns_to_s "$TD") eval_tokens=$EC"
      echo
      jq -r '.response' "$RAW_FILE"
    } > "$LOG_FILE"

    # Extract artifact
    if [ -n "$LANG" ]; then
      jq -r '.response' "$RAW_FILE" | awk -v fence="^\`\`\`$LANG" '
        $0 ~ fence && !in_block { in_block=1; next }
        /^```[[:space:]]*$/ && in_block { exit }
        in_block { print }
      ' > "$OUT_FILE"
      [ ! -s "$OUT_FILE" ] && {
        log "  [$BENCH] WARN: no $LANG code block found, saving raw response"
        jq -r '.response' "$RAW_FILE" > "$OUT_FILE"
      }
    else
      jq -r '.response' "$RAW_FILE" > "$OUT_FILE"
    fi

    # Run validator
    if [ -x "$VALIDATOR" ]; then
      if "$VALIDATOR" "$OUT_FILE" "$MODEL" "$BENCH_DIR/caxi-results" 2>&1 | sed 's/^/    /'; then
        log "  [$BENCH] VALIDATOR: pass"
      else
        log "  [$BENCH] VALIDATOR: fail"
      fi
    fi
  done

  {
    echo "=== $MODEL ==="
    for BENCH in "${BENCHMARKS[@]}"; do
      RAW_FILE="$BENCH_DIR/raw/$BENCH-$SAFE.json"
      if [ -f "$RAW_FILE" ]; then
        LD=$(jq -r '.load_duration' "$RAW_FILE")
        TD=$(jq -r '.total_duration' "$RAW_FILE")
        EC=$(jq -r '.eval_count' "$RAW_FILE")
        printf "  %-20s load=%s total=%s tokens=%s\n" "$BENCH" "$(ns_to_s "$LD")" "$(ns_to_s "$TD")" "$EC"
      fi
    done
    echo
  } >> "$SUMMARY"

  log "done with $MODEL"
  echo
done

log "=== BENCHMARK DONE: $(date) ==="
echo
echo "=============== FINAL SUMMARY ==============="
cat "$SUMMARY"
