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
# A 4th argument is the run tag, so repeats of the same model write distinct rows
# instead of overwriting each other. Falls back to the model name when absent.
SAFE="${4:-$(echo "$MODEL" | tr ':/' '--')}"
OUT="$RESULTS/agentic-bugfix-$SAFE.json"

emit_fail() {
  jq -n --arg m "$MODEL" --arg r "$1" \
    '{model:$m, benchmark:"agentic-bugfix", pass:false, reason:$r}' > "$OUT"
  echo "pass=false reason=$1"
  exit 1
}

[ -d "$WORKDIR" ] || emit_fail "no workdir"

# The verdict comes ONLY from the 6 tests the fixture ships, run by name rather
# than by glob. A model that adds its own test file is doing good engineering, and
# the earlier glob-plus-count-guard punished exactly that: gemma4 fixed the defect,
# added 5 legitimate tests for boolean/ternary/equality/member-access, scored 11/11
# and was recorded pass=false. Scoring the whole glob also moves the denominator,
# so 11/11 and 6/6 stop being the same measurement.
#
# Fixed denominator here; anything the model added is a separate reported signal.
EXPECTED_TESTS=6
SHIPPED_TEST=test/precedence.test.mjs

[ -s "$WORKDIR/$SHIPPED_TEST" ] || emit_fail "shipped test file missing"

# Fully offline: node's built-in test runner, no install step.
TEST_OUT=$(cd "$WORKDIR" && gtimeout 120 node --test "$SHIPPED_TEST" 2>&1)
PASSED=$(echo "$TEST_OUT" | grep -oE '^ℹ pass [0-9]+' | grep -oE '[0-9]+' | head -1)
FAILED=$(echo "$TEST_OUT" | grep -oE '^ℹ fail [0-9]+' | grep -oE '[0-9]+' | head -1)
PASSED=${PASSED:-0}
FAILED=${FAILED:-0}
TOTAL=$((PASSED + FAILED))

# Extra test FILES the model wrote. Reported, never gated — same doctrine as turns
# and memory: measure and publish, let the reader judge.
TESTS_ADDED=$(cd "$WORKDIR" && ls test/*.test.mjs 2>/dev/null | grep -v "precedence.test.mjs" | grep -c . || true)
TESTS_ADDED=${TESTS_ADDED:-0}

# Deleting assertions from the shipped file is still cheating, and now the check is
# unambiguous because the denominator cannot be inflated by additions.
if [ "$TOTAL" -lt "$EXPECTED_TESTS" ]; then
  jq -n --arg m "$MODEL" --argjson p "$PASSED" --argjson f "$FAILED" --argjson a "$TESTS_ADDED" \
    '{model:$m, benchmark:"agentic-bugfix", pass:false,
      reason:"shipped suite was modified", tests_passed:$p, tests_failed:$f, tests_added:$a}' > "$OUT"
  echo "pass=false reason=suite-modified ($TOTAL/$EXPECTED_TESTS shipped tests present)"
  exit 1
fi

PASS=false
[ "$FAILED" -eq 0 ] && [ "$PASSED" -eq "$EXPECTED_TESTS" ] && PASS=true

# Merge the loop metrics if the driver wrote them, so one row carries both the
# verdict and the loop stats. Absent metrics must not fail the gate.
LOOP="$RESULTS/agentic-bugfix-loop-$SAFE.json"
if [ -s "$LOOP" ]; then
  jq -n --arg m "$MODEL" --argjson pass "$PASS" \
        --argjson p "$PASSED" --argjson f "$FAILED" --argjson a "$TESTS_ADDED" \
        --slurpfile loop "$LOOP" \
    '{model:$m, benchmark:"agentic-bugfix", pass:$pass,
      tests_passed:$p, tests_failed:$f, tests_added:$a,
      loop:($loop[0] | del(.transcript))}' > "$OUT"
else
  jq -n --arg m "$MODEL" --argjson pass "$PASS" --argjson p "$PASSED" --argjson f "$FAILED" \
        --argjson a "$TESTS_ADDED" \
    '{model:$m, benchmark:"agentic-bugfix", pass:$pass, tests_passed:$p, tests_failed:$f, tests_added:$a}' > "$OUT"
fi

echo "pass=$PASS tests=$PASSED/$TOTAL"
[ "$PASS" = "true" ]
