#!/usr/bin/env bash
# Validate calc via Playwright (drivers/calc.mjs).
set -uo pipefail
ARTIFACT="$1"
MODEL="$2"
RESULTS="$3"
SAFE=$(echo "$MODEL" | tr ':/' '--')
DRIVER="$(dirname "$(dirname "$(realpath "$0")")")/drivers/calc.mjs"

if [ ! -s "$ARTIFACT" ]; then
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"calc", pass:false, reason:"empty"}' \
    > "$RESULTS/calc-$SAFE.json"
  exit 1
fi

source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
OUTPUT=$(timeout 90 node "$DRIVER" "$ARTIFACT" "$RESULTS" "$SAFE" 2>/dev/null)
if [ -z "$OUTPUT" ]; then
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"calc", pass:false, reason:"driver failed"}' \
    > "$RESULTS/calc-$SAFE.json"
  exit 1
fi

echo "$OUTPUT" | jq --arg m "$MODEL" '. + {model:$m}' > "$RESULTS/calc-$SAFE.json"
SCORE=$(jq -r '.score' "$RESULTS/calc-$SAFE.json")
PASS=$(jq -r '.pass' "$RESULTS/calc-$SAFE.json")
echo "score=$SCORE/7 pass=$PASS"
[ "$PASS" = "true" ]
