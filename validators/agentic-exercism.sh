#!/opt/homebrew/bin/bash
# Validate the agentic exercism leg: a GRADED breadth gate.
#
# Unlike agentic-bugfix.sh, this does not collapse to pass/fail. The expr-eval
# fixture produced only three outcomes across 21 runs (6/6 fifteen times, 0/6
# five times, 3/6 once) and 57% of models were perfect on every repeat, leaving
# no headroom to separate a 2026 model from a 2025 one. A 31-case canonical suite
# scores continuously, so "solved 22 of 31" is a measurement rather than a
# ceiling.
#
# Contamination is a disclosed caveat, not a defect: these are public Exercism
# problems. Probed on 2026-08-20 against gpt-oss:20b and muse-glimmer:30b-mlx —
# both scored 0/7 on reference-specific naming tells with 0.20 identifier overlap
# and wrote ~30-line solutions where the reference is 100, so they derive rather
# than recall. Every model gets the same exposure regardless.
set -uo pipefail
WORKDIR="$1"
MODEL="$2"
RESULTS="$3"
SAFE="${4:-$(echo "$MODEL" | tr ':/' '--')}"
OUT="$RESULTS/agentic-exercism-$SAFE.json"

# The canonical suite ships 31 cases. A run reporting fewer has had the suite
# edited, which is not a score.
EXPECTED_TESTS=31

emit_fail() {
  jq -n --arg m "$MODEL" --arg r "$1" \
    '{model:$m, benchmark:"agentic-exercism", pass:false, solved:0, reason:$r}' > "$OUT"
  echo "pass=false solved=0 reason=$1"
  exit 1
}

# A harness failure is not a model failure; a false zero is worse than a gap.
emit_invalid() {
  jq -n --arg m "$MODEL" --arg r "$1" \
    '{model:$m, benchmark:"agentic-exercism", pass:null, invalid:true, reason:$r}' > "$OUT"
  echo "INVALID reason=$1"
  exit 2
}

[ -d "$WORKDIR" ] || emit_fail "no workdir"

LOOP="$RESULTS/agentic-exercism-loop-$SAFE.json"
if [ ! -s "$WORKDIR/bowling.py" ]; then
  if [ -s "$LOOP" ] && [ "$(jq -r '(.errors // []) | length' "$LOOP")" -gt 0 ]; then
    emit_invalid "driver error: $(jq -r '.errors[0]' "$LOOP")"
  fi
  emit_fail "bowling.py missing"
fi

TEST_OUT=$(cd "$WORKDIR" && gtimeout 120 python3 -m pytest bowling_test.py -q 2>&1)
PASSED=$(echo "$TEST_OUT" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
FAILED=$(echo "$TEST_OUT" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | head -1)
PASSED=${PASSED:-0}
FAILED=${FAILED:-0}
TOTAL=$((PASSED + FAILED))

if [ "$TOTAL" -lt "$EXPECTED_TESTS" ]; then
  jq -n --arg m "$MODEL" --argjson p "$PASSED" \
    '{model:$m, benchmark:"agentic-exercism", pass:false, solved:$p,
      reason:"test count shrank — suite was modified"}' > "$OUT"
  echo "pass=false reason=suite-modified ($TOTAL/$EXPECTED_TESTS present)"
  exit 1
fi

PASS=false
[ "$FAILED" -eq 0 ] && PASS=true

if [ -s "$LOOP" ]; then
  jq -n --arg m "$MODEL" --argjson pass "$PASS" \
        --argjson solved "$PASSED" --argjson total "$TOTAL" \
        --slurpfile loop "$LOOP" \
    '{model:$m, benchmark:"agentic-exercism", pass:$pass,
      solved:$solved, of:$total,
      loop:($loop[0] | del(.transcript))}' > "$OUT"
else
  jq -n --arg m "$MODEL" --argjson pass "$PASS" \
        --argjson solved "$PASSED" --argjson total "$TOTAL" \
    '{model:$m, benchmark:"agentic-exercism", pass:$pass, solved:$solved, of:$total}' > "$OUT"
fi

echo "pass=$PASS solved=$PASSED/$TOTAL"
[ "$PASS" = "true" ]
