#!/usr/bin/env bash
# local-llm-bench — extensible benchmark framework for local coder LLMs.
#
# Runs benchmark prompts against Ollama via HTTP API, extracts code
# artifacts, and runs validators.
#
# Designed to support a remote Ollama server:
#   benchmark runner (NAS) -> HTTP -> Ollama (Windows)
#
# Usage:
#   ./bench.sh
#   ./bench.sh --force
#   ./bench.sh --only todo
#   ./bench.sh --model qwen3:14b
#
# Dependencies: jq, curl, python3, caxi (for web benchmarks).
#
# IMPORTANT:
# Models are intentionally unloaded before each benchmark so every
# model/benchmark pair gets a cold-load measurement.

set -uo pipefail

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$BENCH_DIR/bench.config.json"

# --- CLI flags ---
FORCE=false
ONLY_BENCH=""
ONLY_MODEL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --force)
      FORCE=true
      ;;
    --only)
      [ $# -ge 2 ] || {
        echo "ERROR: --only requires a benchmark name" >&2
        exit 2
      }
      ONLY_BENCH="$2"
      shift
      ;;
    --model)
      [ $# -ge 2 ] || {
        echo "ERROR: --model requires a model name" >&2
        exit 2
      }
      ONLY_MODEL="$2"
      shift
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 2
      ;;
  esac
  shift
done

# --- Dependency checks ---
for cmd in jq curl python3; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "ERROR: $cmd not installed" >&2
    exit 1
  }
done

command -v caxi >/dev/null 2>&1 || \
  echo "WARN: caxi not found — web validators will skip browser tests"

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

mkdir -p \
  "$BENCH_DIR/logs" \
  "$BENCH_DIR/raw" \
  "$BENCH_DIR/caxi-results"

SUMMARY="$BENCH_DIR/raw/SUMMARY.txt"
: > "$SUMMARY"

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

ns_to_s() {
  local ns="$1"

  [ -z "$ns" ] || [ "$ns" = "null" ] && {
    echo "?"
    return
  }

  awk -v n="$ns" 'BEGIN {
    s = n / 1e9

    if (s < 1)
      printf "%.3fms\n", s * 1000
    else if (s < 60)
      printf "%.3fs\n", s
    else {
      m = int(s / 60)
      r = s - m * 60
      printf "%dm%.3fs\n", m, r
    }
  }'
}

# ---------------------------------------------------------------------------
# Verify remote Ollama
# ---------------------------------------------------------------------------

check_ollama() {
  local response

  response=$(curl -sS \
    --max-time 10 \
    "$OLLAMA_URL/api/version" 2>/dev/null) || {
      echo "ERROR: Cannot reach Ollama at $OLLAMA_URL" >&2
      return 1
    }

  if ! echo "$response" | jq -e '.version' >/dev/null 2>&1; then
    echo "ERROR: Invalid response from Ollama at $OLLAMA_URL" >&2
    echo "$response" >&2
    return 1
  fi

  log "Ollama: $(echo "$response" | jq -r '.version')"
}

# ---------------------------------------------------------------------------
# Pull model through Ollama HTTP API
# ---------------------------------------------------------------------------
#
# This replaces:
#   ollama pull "$MODEL"
#
# stream:false makes the endpoint return one JSON response after the
# download is complete.

pull_model() {
  local model="$1"
  local response
  local status

  response=$(
    jq -n \
      --arg model "$model" \
      '{
        model: $model,
        stream: false
      }' |
    curl -sS \
      --max-time "$TIMEOUT_SECS" \
      -X POST "$OLLAMA_URL/api/pull" \
      -H 'Content-Type: application/json' \
      -d @-
  ) || {
    echo "ERROR: HTTP failure pulling $model" >&2
    return 1
  }

  status=$(echo "$response" | jq -r '.status // empty')

  if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
    echo "ERROR: Ollama failed to pull $model:" >&2
    echo "$response" | jq -r '.error' >&2
    return 1
  fi

  [ -n "$status" ] && echo "    pull: $status"

  return 0
}

# ---------------------------------------------------------------------------
# Unload all currently loaded models through Ollama HTTP API
# ---------------------------------------------------------------------------
#
# This replaces:
#   ollama ps
#   ollama stop "$model"
#
# Ollama unloads a model when /api/generate receives keep_alive:0.
#
# This is intentionally called before EVERY benchmark so each benchmark
# measures a cold model load.

stop_all_models() {
  local models
  local model

  models=$(
    curl -sS \
      --max-time 10 \
      "$OLLAMA_URL/api/ps" 2>/dev/null |
    jq -r '.models[]?.name // empty'
  ) || {
    log "  WARN: Could not query loaded Ollama models"
    return 0
  }

  if [ -z "$models" ]; then
    return 0
  fi

  while IFS= read -r model; do
    [ -n "$model" ] || continue

    log "  unloading: $model"

    jq -n \
      --arg model "$model" \
      '{
        model: $model,
        keep_alive: 0
      }' |
    curl -sS \
      --max-time 30 \
      -X POST "$OLLAMA_URL/api/generate" \
      -H 'Content-Type: application/json' \
      -d @- \
      >/dev/null 2>&1 || true

  done <<< "$models"

  # Give Ollama a moment to finish unloading.
  sleep 2
}

# ---------------------------------------------------------------------------
# Generate benchmark response
# ---------------------------------------------------------------------------

api_generate() {
  local model="$1"
  local prompt="$2"
  local out="$3"

  jq -n \
    --arg m "$model" \
    --arg p "$prompt" \
    --arg k "$KEEP_ALIVE" \
    --argjson np 16000 \
    '{
      model: $m,
      prompt: $p,
      stream: false,
      keep_alive: $k,
      options: {
        num_predict: $np
      }
    }' |
  curl -sS \
    --max-time "$TIMEOUT_SECS" \
    -X POST "$OLLAMA_URL/api/generate" \
    -H 'Content-Type: application/json' \
    -d @- \
    > "$out"

  jq -e '.response' "$out" >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# Extract fenced code
# ---------------------------------------------------------------------------

extract_code() {
  local file="$1"
  local lang="${2:-}"

  if [ -n "$lang" ]; then
    awk -v l="^\`\`\`$lang" '
      $0 ~ l && !in_block {
        in_block=1
        next
      }

      /^```[[:space:]]*$/ && in_block {
        exit
      }

      in_block {
        print
      }
    ' "$file"
  else
    cat "$file"
  fi
}

# ---------------------------------------------------------------------------
# Benchmark metadata
# ---------------------------------------------------------------------------

ext_for_benchmark() {
  jq -r \
    ".benchmarks[] | select(.name == \"$1\") | .ext" \
    "$CONFIG"
}

lang_for_ext() {
  case "$1" in
    py)
      echo "python"
      ;;
    html)
      echo "html"
      ;;
    *)
      echo ""
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

log "=== BENCHMARK START: $(date) ==="
log "Ollama: $OLLAMA_URL"
log "Models: ${MODELS[*]}"
log "Benchmarks: ${BENCHMARKS[*]}"
log "Skip existing: $SKIP_EXISTING"
echo

if ! check_ollama; then
  exit 1
fi

echo

for MODEL in "${MODELS[@]}"; do
  SAFE=$(echo "$MODEL" | tr ':/' '--')

  log "=========================================="
  log "MODEL: $MODEL"
  log "=========================================="

  # Pull is idempotent if the model is already cached.
  # This intentionally remains part of the benchmark workflow.
  if ! pull_model "$MODEL"; then
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

    if $SKIP_EXISTING &&
       [ -s "$OUT_FILE" ] &&
       [ -f "$RAW_FILE" ]; then

      log "  [$BENCH] SKIP: output exists ($OUT_FILE)"
      continue
    fi

    PROMPT=$(cat "$PROMPT_FILE")

    log "  [$BENCH] prompt: $(echo "$PROMPT" | head -c 60)..."

    # ---------------------------------------------------------------
    # Cold load per benchmark
    # ---------------------------------------------------------------
    #
    # Every benchmark gets a fresh model load.
    #
    # This preserves the original benchmark's cold-load methodology
    # even though Ollama itself is running on another machine.
    # ---------------------------------------------------------------

    stop_all_models

    if ! api_generate "$MODEL" "$PROMPT" "$RAW_FILE"; then
      log "  [$BENCH] FAILED API call"

      if [ -s "$RAW_FILE" ]; then
        log "  [$BENCH] Ollama response:"
        jq . "$RAW_FILE" 2>/dev/null | head -20
      fi

      continue
    fi

    LD=$(jq -r '.load_duration // null' "$RAW_FILE")
    TD=$(jq -r '.total_duration // null' "$RAW_FILE")
    EC=$(jq -r '.eval_count // null' "$RAW_FILE")

    log "  [$BENCH] load=$(ns_to_s "$LD") total=$(ns_to_s "$TD") tokens=$EC"

    {
      echo "# $MODEL — $BENCH"
      echo "# load=$(ns_to_s "$LD") total=$(ns_to_s "$TD") eval_tokens=$EC"
      echo
      jq -r '.response' "$RAW_FILE"
    } > "$LOG_FILE"

    # ---------------------------------------------------------------
    # Extract generated artifact
    # ---------------------------------------------------------------

    if [ -n "$LANG" ]; then

      jq -r '.response' "$RAW_FILE" |
      awk -v fence="^\`\`\`$LANG" '
        $0 ~ fence && !in_block {
          in_block=1
          next
        }

        /^```[[:space:]]*$/ && in_block {
          exit
        }

        in_block {
          print
        }
      ' > "$OUT_FILE"

      if [ ! -s "$OUT_FILE" ]; then
        log "  [$BENCH] WARN: no $LANG code block found, saving raw response"
        jq -r '.response' "$RAW_FILE" > "$OUT_FILE"
      fi

    else
      jq -r '.response' "$RAW_FILE" > "$OUT_FILE"
    fi

    # ---------------------------------------------------------------
    # Run validator
    # ---------------------------------------------------------------

    if [ -x "$VALIDATOR" ]; then

      if "$VALIDATOR" \
        "$OUT_FILE" \
        "$MODEL" \
        "$BENCH_DIR/caxi-results" \
        2>&1 |
        sed 's/^/    /'; then

        log "  [$BENCH] VALIDATOR: pass"

      else
        log "  [$BENCH] VALIDATOR: fail"
      fi

    fi
  done

  # ---------------------------------------------------------------
  # Model summary
  # ---------------------------------------------------------------

  {
    echo "=== $MODEL ==="

    for BENCH in "${BENCHMARKS[@]}"; do
      RAW_FILE="$BENCH_DIR/raw/$BENCH-$SAFE.json"

      if [ -f "$RAW_FILE" ]; then

        LD=$(jq -r '.load_duration // null' "$RAW_FILE")
        TD=$(jq -r '.total_duration // null' "$RAW_FILE")
        EC=$(jq -r '.eval_count // null' "$RAW_FILE")

        printf \
          "  %-20s load=%s total=%s tokens=%s\n" \
          "$BENCH" \
          "$(ns_to_s "$LD")" \
          "$(ns_to_s "$TD")" \
          "$EC"
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