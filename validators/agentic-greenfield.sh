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

[ -d "$WORKDIR" ] || emit_fail "no workdir"
# The model was told to produce tetris.html. A missing artifact is a failed run,
# not a driver error.
[ -s "$ARTIFACT" ] || emit_fail "no tetris.html produced"

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
