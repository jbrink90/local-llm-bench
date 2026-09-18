#!/usr/bin/env bash
# Validate tetris via Playwright (drivers/tetris.mjs).
set -uo pipefail
ARTIFACT="$1"
MODEL="$2"
RESULTS="$3"
SAFE=$(echo "$MODEL" | tr ':/' '--')
DRIVER="$(dirname "$(dirname "$(realpath "$0")")")/drivers/tetris.mjs"

if [ ! -s "$ARTIFACT" ]; then
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"tetris", pass:false, reason:"empty"}' \
    > "$RESULTS/tetris-$SAFE.json"
  exit 1
fi

source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
OUTPUT=$(timeout 90 node "$DRIVER" "$ARTIFACT" "$RESULTS" "$SAFE" 2>/dev/null)
if [ -z "$OUTPUT" ]; then
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"tetris", pass:false, reason:"driver failed"}' \
    > "$RESULTS/tetris-$SAFE.json"
  exit 1
fi

echo "$OUTPUT" | jq --arg m "$MODEL" '. + {model:$m}' > "$RESULTS/tetris-$SAFE.json"
SCORE=$(jq -r '.score' "$RESULTS/tetris-$SAFE.json")
PASS=$(jq -r '.pass' "$RESULTS/tetris-$SAFE.json")
echo "score=$SCORE/8 pass=$PASS"
[ "$PASS" = "true" ]
