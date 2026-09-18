#!/usr/bin/env bash
# Validate snake-pygame: Python syntax check only (can't auto-play pygame).
# Usage: ./snake-pygame.sh <artifact-file> <model> <results-dir>
set -uo pipefail
ARTIFACT="$1"
MODEL="$2"
RESULTS="$3"
SAFE=$(echo "$MODEL" | tr ':/' '--')

if [ ! -s "$ARTIFACT" ]; then
  jq -n --arg m "$MODEL" '{model:$m, benchmark:"snake-pygame", pass:false, reason:"empty"}' \
    > "$RESULTS/snake-pygame-$SAFE.json"
  echo "FAIL: empty"
  exit 1
fi

if python3 -c "import ast; ast.parse(open('$ARTIFACT').read())" 2>/dev/null; then
  LINES=$(wc -l < "$ARTIFACT")
  jq -n --arg m "$MODEL" --argjson l "$LINES" \
    '{model:$m, benchmark:"snake-pygame", pass:true, lines:$l, syntax_ok:true}' \
    > "$RESULTS/snake-pygame-$SAFE.json"
  echo "PASS: $LINES lines, syntax OK"
else
  ERR=$(python3 -c "import ast; ast.parse(open('$ARTIFACT').read())" 2>&1 | tail -1)
  jq -n --arg m "$MODEL" --arg e "$ERR" \
    '{model:$m, benchmark:"snake-pygame", pass:false, reason:$e}' \
    > "$RESULTS/snake-pygame-$SAFE.json"
  echo "FAIL: $ERR"
  exit 1
fi
