#!/usr/bin/env bash
# Validate todo via Playwright (drivers/todo.mjs).
# Usage: ./todo.sh <artifact-file> <model> <results-dir>
set -uo pipefail
ARTIFACT="$1"
MODEL="$2"
RESULTS="$3"
SAFE=$(echo "$MODEL" | tr ':/' '--')
DRIVER="$(dirname "$(dirname "$(realpath "$0")")")/drivers/todo.mjs"

if [ ! -s "$ARTIFACT" ]; then
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"todo", pass:false, reason:"empty"}' \
    > "$RESULTS/todo-$SAFE.json"
  echo "FAIL: empty artifact"
  exit 1
fi

# Run driver, merge model name into result JSON
source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
OUTPUT=$(timeout 90 node "$DRIVER" "$ARTIFACT" "$RESULTS" "$SAFE" 2>/dev/null)
if [ -z "$OUTPUT" ]; then
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"todo", pass:false, reason:"driver failed"}' \
    > "$RESULTS/todo-$SAFE.json"
  echo "FAIL: driver returned nothing"
  exit 1
fi

echo "$OUTPUT" | jq --arg m "$MODEL" '. + {model:$m}' > "$RESULTS/todo-$SAFE.json"
SCORE=$(jq -r '.score' "$RESULTS/todo-$SAFE.json")
PASS=$(jq -r '.pass' "$RESULTS/todo-$SAFE.json")
echo "score=$SCORE/8 pass=$PASS"
[ "$PASS" = "true" ]
