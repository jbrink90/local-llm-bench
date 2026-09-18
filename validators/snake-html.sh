#!/usr/bin/env bash
# Validate snake-html via Playwright (drivers/snake-html.mjs).
set -uo pipefail
ARTIFACT="$1"
MODEL="$2"
RESULTS="$3"
SAFE=$(echo "$MODEL" | tr ':/' '--')
DRIVER="$(dirname "$(dirname "$(realpath "$0")")")/drivers/snake-html.mjs"

if [ ! -s "$ARTIFACT" ]; then
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"snake-html", pass:false, reason:"empty"}' \
    > "$RESULTS/snake-html-$SAFE.json"
  exit 1
fi

source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
OUTPUT=$(timeout 90 node "$DRIVER" "$ARTIFACT" "$RESULTS" "$SAFE" 2>/dev/null)
if [ -z "$OUTPUT" ]; then
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"snake-html", pass:false, reason:"driver failed"}' \
    > "$RESULTS/snake-html-$SAFE.json"
  exit 1
fi

echo "$OUTPUT" | jq --arg m "$MODEL" '. + {model:$m}' > "$RESULTS/snake-html-$SAFE.json"
SCORE=$(jq -r '.score' "$RESULTS/snake-html-$SAFE.json")
PASS=$(jq -r '.pass' "$RESULTS/snake-html-$SAFE.json")
echo "score=$SCORE/6 pass=$PASS"
[ "$PASS" = "true" ]
