#!/opt/homebrew/bin/bash
# Validate the agentic bug-fix variant: the artifact gate.
#
# The loop transcript is NOT evidence of success. A model can call tools tidily,
# declare done(), and have changed nothing — observed on the first smoke run. So
# pass/fail is decided here, by running the fixture's own test suite in the
# worktree the model actually edited.
#
# Loop metrics from drivers/agentic.mjs are merged in for reporting, but only a
# green suite sets pass=true.
set -uo pipefail
WORKDIR="$1"
MODEL="$2"
RESULTS="$3"
SAFE=$(echo "$MODEL" | tr ':/' '--')
OUT="$RESULTS/agentic-bugfix-$SAFE.json"

emit_fail() {
  jq -n --arg m "$MODEL" --arg r "$1" \
    '{model:$m, benchmark:"agentic-bugfix", pass:false, reason:$r}' > "$OUT"
  echo "pass=false reason=$1"
  exit 1
}

[ -d "$WORKDIR" ] || emit_fail "no workdir"

# Fully offline: node's built-in test runner, no install step.
TEST_OUT=$(cd "$WORKDIR" && gtimeout 120 node --test 'test/*.test.mjs' 2>&1)
PASSED=$(echo "$TEST_OUT" | grep -oE '^ℹ pass [0-9]+' | grep -oE '[0-9]+' | head -1)
FAILED=$(echo "$TEST_OUT" | grep -oE '^ℹ fail [0-9]+' | grep -oE '[0-9]+' | head -1)
PASSED=${PASSED:-0}
FAILED=${FAILED:-0}

# A model that deletes tests to go green must not pass. The fixture ships 6.
EXPECTED_TESTS=6
TOTAL=$((PASSED + FAILED))

if [ "$TOTAL" -lt "$EXPECTED_TESTS" ]; then
  jq -n --arg m "$MODEL" --argjson p "$PASSED" --argjson f "$FAILED" \
    '{model:$m, benchmark:"agentic-bugfix", pass:false,
      reason:"test count shrank — suite was modified", tests_passed:$p, tests_failed:$f}' > "$OUT"
  echo "pass=false reason=suite-modified ($TOTAL/$EXPECTED_TESTS tests present)"
  exit 1
fi

PASS=false
[ "$FAILED" -eq 0 ] && [ "$PASSED" -eq "$EXPECTED_TESTS" ] && PASS=true

# Merge the loop metrics if the driver wrote them, so one row carries both the
# verdict and the loop stats. Absent metrics must not fail the gate.
LOOP="$RESULTS/agentic-$SAFE.json"
if [ -s "$LOOP" ]; then
  jq -n --arg m "$MODEL" --argjson pass "$PASS" \
        --argjson p "$PASSED" --argjson f "$FAILED" \
        --slurpfile loop "$LOOP" \
    '{model:$m, benchmark:"agentic-bugfix", pass:$pass,
      tests_passed:$p, tests_failed:$f,
      loop:($loop[0] | del(.transcript))}' > "$OUT"
else
  jq -n --arg m "$MODEL" --argjson pass "$PASS" --argjson p "$PASSED" --argjson f "$FAILED" \
    '{model:$m, benchmark:"agentic-bugfix", pass:$pass, tests_passed:$p, tests_failed:$f}' > "$OUT"
fi

echo "pass=$PASS tests=$PASSED/$TOTAL"
[ "$PASS" = "true" ]
