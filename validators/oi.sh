#!/usr/bin/env bash
# Validate oi response: just needs to be non-empty.
# Usage: ./oi.sh <artifact-file> <model> <results-dir>
set -uo pipefail
ARTIFACT="$1"
MODEL="$2"
RESULTS="$3"
SAFE=$(echo "$MODEL" | tr ':/' '--')

if [ ! -s "$ARTIFACT" ]; then
  echo "FAIL: empty response"
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"oi", pass:false, reason:"empty response"}' \
    > "$RESULTS/oi-$SAFE.json"
  exit 1
fi

WORDS=$(wc -w < "$ARTIFACT")
jq -n --arg m "$MODEL" --argjson w "$WORDS" \
  '{model:$m, benchmark:"oi", pass:true, word_count:$w}' \
  > "$RESULTS/oi-$SAFE.json"
echo "PASS: $WORDS words"
