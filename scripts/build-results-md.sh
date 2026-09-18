#!/usr/bin/env bash
# Build final RESULTS.md from LEADERBOARD.json + raw data.
#
# Reporting convention:
# - Main score tables use 0-100 normalized scores.
# - Pairwise visual preference keeps Elo as an audit detail, but also shows
#   normalized 0-100 visual scores for readability.
# - Runtime/cost metrics stay raw (seconds, tokens).
#
# Usage: ./build-results-md.sh

set -uo pipefail
BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEADERBOARD="$BENCH_DIR/caxi-results/LEADERBOARD.json"
OUT="$BENCH_DIR/RESULTS.md"

if [ ! -s "$LEADERBOARD" ]; then
  echo "ERROR: $LEADERBOARD not found. Run build-leaderboard.mjs first." >&2
  exit 1
fi

cat > "$OUT" <<'HEADER'
# Results

Benchmarking local coder LLMs on real tasks with objective validation.

**Methodology:** Each model generates artifacts for 7 prompts. Every artifact is
driven by Playwright (games + apps), syntax-checked (pygame), and judged by
Claude Opus 4.7 for visual polish (pairwise), code quality (pygame review), and
text quality (oi greeting).

**Reporting convention:** score tables use a normalized **0-100** scale. Raw
functional tier counts, Elo ratings, timings, and token counts are shown only in
detail sections.

**Overall weighting:** Functional 30%, Visual polish 30%, Pygame code review
15%, Oi text quality 10%, Efficiency 15%.

HEADER

# Master leaderboard
echo "## 🏆 Leaderboard" >> "$OUT"
echo "" >> "$OUT"
echo "All component columns are normalized 0-100. Overall is the weighted blend above." >> "$OUT"
echo "" >> "$OUT"
echo "| # | Model | Function | Visual | PyGame CR | Oi | Efficiency | **Overall** |" >> "$OUT"
echo "|---|---|---:|---:|---:|---:|---:|---:|" >> "$OUT"
jq -r '
  def r: (. * 10 | round) / 10;
  to_entries | .[] |
  "| \(.key + 1) | `\(.value.model)` | \((.value.functional_score / 30 * 100)|r) | \((.value.visual_score / 30 * 100)|r) | \((.value.pygame_review_score / 15 * 100)|r) | \((.value.oi_quality_score / 10 * 100)|r) | \((.value.efficiency_score / 15 * 100)|r) | **\(.value.total|r)** |"
' "$LEADERBOARD" >> "$OUT"
echo "" >> "$OUT"

# Per-benchmark functional
echo "## Functional detail" >> "$OUT"
echo "" >> "$OUT"
echo "Playwright/validator scores normalized to 0-100, with raw tier counts in parentheses." >> "$OUT"
echo "" >> "$OUT"
echo "| Model | Todo | Snake | Tetris | Calc | Markdown | Pygame |" >> "$OUT"
echo "|---|---:|---:|---:|---:|---:|---|" >> "$OUT"
jq -r '
  def pct($x): (($x.score / $x.max * 100) | round);
  def cell($x): "\(pct($x)) (\($x.score)/\($x.max))";
  .[] |
  "| `\(.model)` | \(cell(.functional.todo)) | \(cell(.functional["snake-html"])) | \(cell(.functional.tetris)) | \(cell(.functional.calc)) | \(cell(.functional.markdown)) | \(if .pygame_syntax_ok then "✅" else "❌" end) |"
' "$LEADERBOARD" >> "$OUT"
echo "" >> "$OUT"

# Visual normalized + Elo detail
echo "## Visual polish" >> "$OUT"
echo "" >> "$OUT"
echo "Pairwise Opus judgments are aggregated with Elo. The table shows each benchmark's Elo normalized to 0-100 across this model set; raw Elo is included in parentheses." >> "$OUT"
echo "" >> "$OUT"
echo "| Model | Snake HTML | Tetris | Todo | Calc | Markdown |" >> "$OUT"
echo "|---|---:|---:|---:|---:|---:|" >> "$OUT"
jq -r '
  def norm($all; $b; $v):
    ($all | map(.elo[$b]) | min) as $min |
    ($all | map(.elo[$b]) | max) as $max |
    if $max == $min then 50 else ((($v - $min) / ($max - $min) * 100) | round) end;
  . as $all |
  $all[] |
  "| `\(.model)` | " +
  "\(norm($all; "snake-html"; .elo["snake-html"])) (\(.elo["snake-html"]|round)) | " +
  "\(norm($all; "tetris"; .elo.tetris)) (\(.elo.tetris|round)) | " +
  "\(norm($all; "todo"; .elo.todo)) (\(.elo.todo|round)) | " +
  "\(norm($all; "calc"; .elo.calc)) (\(.elo.calc|round)) | " +
  "\(norm($all; "markdown"; .elo.markdown)) (\(.elo.markdown|round)) |"
' "$LEADERBOARD" >> "$OUT"
echo "" >> "$OUT"

# Pygame code review
echo "## Pygame code review" >> "$OUT"
echo "" >> "$OUT"
echo 'Opus rubric normalized to 0-100. Raw `/50` score is included in parentheses.' >> "$OUT"
echo "" >> "$OUT"
echo "| Model | Score | Notes |" >> "$OUT"
echo "|---|---:|---|" >> "$OUT"
for f in "$BENCH_DIR"/caxi-results/snake-pygame-review-*.json; do
  [ -s "$f" ] || continue
  model=$(jq -r '.model' "$f")
  total=$(jq -r '.total' "$f")
  norm=$(jq -nr --argjson t "$total" '($t / 50 * 100 | round)')
  notes=$(jq -r '.notes' "$f" | tr '\n' ' ' | sed 's/|/\\|/g')
  echo "| \`$model\` | $norm ($total/50) | $notes |" >> "$OUT"
done
echo "" >> "$OUT"

# Oi quality
echo "## Oi text quality" >> "$OUT"
echo "" >> "$OUT"
echo 'Opus rubric normalized to 0-100. Raw `/40` score and generated token count included.' >> "$OUT"
echo "" >> "$OUT"
echo "| Model | Score | Tokens | Notes |" >> "$OUT"
echo "|---|---:|---:|---|" >> "$OUT"
for f in "$BENCH_DIR"/caxi-results/oi-quality-*.json; do
  [ -s "$f" ] || continue
  model=$(jq -r '.model' "$f")
  total=$(jq -r '.total' "$f")
  norm=$(jq -nr --argjson t "$total" '($t / 40 * 100 | round)')
  tokens=$(jq -r '.tokens_used' "$f")
  notes=$(jq -r '.notes' "$f" | tr '\n' ' ' | sed 's/|/\\|/g')
  echo "| \`$model\` | $norm ($total/40) | $tokens | $notes |" >> "$OUT"
done
echo "" >> "$OUT"

# Raw generation cost
echo "## Raw generation cost" >> "$OUT"
echo "" >> "$OUT"
echo "Cold-loaded per benchmark. Total = cold load + prompt eval + generation. These are raw cost metrics, not normalized quality scores." >> "$OUT"
echo "" >> "$OUT"
echo "| Model | Oi | Snake.py | Snake.html | Tetris | Todo | Calc | Markdown | Tokens total |" >> "$OUT"
echo "|---|---:|---:|---:|---:|---:|---:|---:|---:|" >> "$OUT"
jq -r '
  def t($x): if $x == null then "-" elif $x < 60 then "\(($x * 10 | round) / 10)s" else "\(($x / 60 * 10 | round) / 10)m" end;
  .[] |
  "| `\(.model)` | \(t(.timings.oi.total_s)) | \(t(.timings["snake-pygame"].total_s)) | \(t(.timings["snake-html"].total_s)) | \(t(.timings.tetris.total_s)) | \(t(.timings.todo.total_s)) | \(t(.timings.calc.total_s)) | \(t(.timings.markdown.total_s)) | \(.total_tokens) |"
' "$LEADERBOARD" >> "$OUT"
echo "" >> "$OUT"

echo "## Methodology notes" >> "$OUT"
cat >> "$OUT" <<'TAIL'

### Why normalize score tables to 0-100?
Most public LLM leaderboards use percent-style scores for benchmark results,
Elo/Arena ratings for pairwise preferences, and raw latency/cost metrics for
performance. This report follows that convention: primary score tables are
0-100, visual detail keeps Elo as an audit trail, and generation cost stays raw.

### Why pairwise vision?
Independent 0-5 scoring from small vision models couldn't reliably distinguish
polished UIs from plain ones — every app scored roughly the same. Pairwise
comparisons with Opus 4.7 produced more consistent rankings that aligned with
human judgment.

### Why Elo?
Pairwise comparisons need an aggregation method. Elo gives each model a
continuous rating that captures both how often they win and who they beat —
beating a strong model counts more than beating a weak one.

### Why efficiency as a score component?
A model that scores 20/30 functional with 30K tokens is less useful than one
scoring 18/30 with 10K tokens. The efficiency factor rewards models that
produce working code without rambling.

### Why "make it beautiful" without specifying?
If you have to ask for glassmorphism and gradients by name, you're testing
instruction following, not design taste. A good coder LLM should know what
"modern web app" means without a checklist.

TAIL

echo "✓ Generated $OUT"
echo "Preview:"
head -50 "$OUT"
