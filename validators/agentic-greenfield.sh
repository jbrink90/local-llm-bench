#!/opt/homebrew/bin/bash
# Validate the agentic greenfield variant: the artifact gate.
#
# Reuses the existing tetris driver (8 functional tiers, Playwright) rather than
# inventing a second definition of "working tetris". The loop transcript is not
# evidence — a model can screenshot, declare done, and ship a blank page.
set -uo pipefail
WORKDIR="$1"
MODEL="$2"
RESULTS="$3"
SAFE=$(echo "$MODEL" | tr ':/' '--')
OUT="$RESULTS/agentic-greenfield-$SAFE.json"
ARTIFACT="$WORKDIR/tetris.html"
DRIVER="$(dirname "$(dirname "$(realpath "$0")")")/drivers/tetris.mjs"

emit_fail() {
  jq -n --arg m "$MODEL" --arg r "$1" \
    '{model:$m, benchmark:"agentic-greenfield", pass:false, reason:$r}' > "$OUT"
  echo "pass=false reason=$1"
  exit 1
}

# A harness failure is not a model failure. Recording one as pass=false puts a
# false zero in the table — six legs of the 2026-08-14 run died on an HTTP
# timeout and were scored as if the models had produced nothing.
emit_invalid() {
  jq -n --arg m "$MODEL" --arg r "$1" \
    '{model:$m, benchmark:"agentic-greenfield", pass:null, invalid:true, reason:$r}' > "$OUT"
  echo "INVALID reason=$1"
  exit 2
}

[ -d "$WORKDIR" ] || emit_fail "no workdir"

# A missing artifact is a model failure ONLY when the loop actually ran. If the
# driver recorded an error, the run never got a fair attempt and must not be
# scored — check that before blaming the model.
LOOP_PRECHECK="$RESULTS/agentic-$SAFE.json"
if [ ! -s "$ARTIFACT" ]; then
  if [ -s "$LOOP_PRECHECK" ] && [ "$(jq -r '(.errors // []) | length' "$LOOP_PRECHECK")" -gt 0 ]; then
    emit_invalid "driver error: $(jq -r '.errors[0]' "$LOOP_PRECHECK")"
  fi
  emit_fail "no tetris.html produced"
fi

source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
FUNC=$(gtimeout 120 node "$DRIVER" "$ARTIFACT" "$RESULTS" "agentic-$SAFE" 2>/dev/null)
[ -n "$FUNC" ] || emit_fail "tetris driver failed"

PASS=$(echo "$FUNC" | jq -r '.pass')
SCORE=$(echo "$FUNC" | jq -r '.score')

# Merge loop + vision metrics so one row carries the verdict, the loop stats, and
# which vision configuration produced it. A paired (sidecar) run must be legible
# as such and never silently compared against a native-vision one.
LOOP="$RESULTS/agentic-$SAFE.json"
if [ -s "$LOOP" ]; then
  jq -n --arg m "$MODEL" --argjson func "$FUNC" --slurpfile loop "$LOOP" \
    '{model:$m, benchmark:"agentic-greenfield",
      pass:$func.pass, score:$func.score, tiers:$func.tiers,
      vision_mode:($loop[0].vision.mode),
      loop:($loop[0] | del(.transcript))}' > "$OUT"
else
  echo "$FUNC" | jq --arg m "$MODEL" \
    '. + {model:$m, benchmark:"agentic-greenfield"}' > "$OUT"
fi

MODE=$(jq -r '.vision_mode // "unknown"' "$OUT")
echo "pass=$PASS score=$SCORE/8 vision=$MODE"
[ "$PASS" = "true" ]
