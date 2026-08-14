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

## 🏆 Leaderboard

All component columns are normalized 0-100. Overall is the weighted blend above.

| # | Model | Function | Visual | PyGame CR | Oi | Efficiency | **Overall** |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | `gemma4-26b-mlx-bf16` | 90.6 | 70.3 | 62 | 100 | 79.1 | **79.4** |
| 2 | `qwen3-coder-next` | 92.8 | 47.4 | 58 | 100 | 100 | **75.8** |
| 3 | `laguna-xs.2` | 61.2 | 71.7 | 48 | 75 | 63.1 | **64** |
| 4 | `qwen3.5-35b-a3b-coding-nvfp4` | 88.1 | 18.6 | 62 | 100 | 84.1 | **63.9** |
| 5 | `qwen3-coder-30b` | 80 | 17 | 78 | 100 | 80.3 | **62.8** |
| 6 | `gpt-oss-20b` | 62.9 | 53.6 | 88 | 97.5 | 0 | **57.9** |

## Functional detail

Playwright/validator scores normalized to 0-100, with raw tier counts in parentheses.

| Model | Todo | Snake | Tetris | Calc | Markdown | Pygame |
|---|---:|---:|---:|---:|---:|---|
| `gemma4-26b-mlx-bf16` | 88 (7/8) | 67 (4/6) | 88 (7/8) | 100 (7/7) | 100 (8/8) | ✅ |
| `qwen3-coder-next` | 100 (8/8) | 83 (5/6) | 88 (7/8) | 100 (7/7) | 88 (7/8) | ✅ |
| `laguna-xs.2` | 88 (7/8) | 67 (4/6) | 38 (3/8) | 86 (6/7) | 13 (1/8) | ✅ |
| `qwen3.5-35b-a3b-coding-nvfp4` | 88 (7/8) | 67 (4/6) | 75 (6/8) | 100 (7/7) | 100 (8/8) | ✅ |
| `qwen3-coder-30b` | 88 (7/8) | 100 (6/6) | 100 (8/8) | 100 (7/7) | 13 (1/8) | ✅ |
| `gpt-oss-20b` | 63 (5/8) | 67 (4/6) | 88 (7/8) | 43 (3/7) | 25 (2/8) | ✅ |

## Visual polish

Pairwise Opus judgments are aggregated with Elo. The table shows each benchmark's Elo normalized to 0-100 across this model set; raw Elo is included in parentheses.

| Model | Snake HTML | Tetris | Todo | Calc | Markdown |
|---|---:|---:|---:|---:|---:|
| `gemma4-26b-mlx-bf16` | 98 (1030) | 75 (1017) | 28 (994) | 100 (1056) | 50 (1002) |
| `qwen3-coder-next` | 100 (1032) | 0 (965) | 41 (1004) | 16 (981) | 80 (1020) |
| `laguna-xs.2` | 46 (987) | 80 (1020) | 100 (1052) | 32 (996) | 100 (1032) |
| `qwen3.5-35b-a3b-coding-nvfp4` | 84 (1018) | 9 (971) | 0 (971) | 0 (967) | 0 (973) |
| `qwen3-coder-30b` | 0 (948) | 42 (993) | 1 (972) | 7 (973) | 35 (993) |
| `gpt-oss-20b` | 42 (984) | 100 (1034) | 46 (1008) | 67 (1026) | 13 (981) |

## Pygame code review

Opus rubric normalized to 0-100. Raw `/50` score is included in parentheses.

| Model | Score | Notes |
|---|---:|---|
| `gemma4-26b-mlx-bf16` | 62 (31/50) | The game works and covers the basics (controls, food, self-collision, restart, score), but uses recursive gameLoop() for restart which risks stack growth, and mixes float coordinates with equality checks for food collision that work only because of grid alignment. Naming is inconsistent (snake_List, Length_of_snake vs snake_head), magic numbers like 20.0 are hardcoded instead of using BLOCK_SIZE, and there's little separation of concerns with one large function holding all state.  |
| `gpt-oss-20b` | 88 (44/50) | Clean class-based structure with proper separation of input/update/render, correct use of deque, 180° turn prevention, and collision logic. Minor issues: font is re-created every draw_text call (inefficient), no pygame.quit() on normal loop exit paths beyond sys.exit, and the pending_dir check only blocks reversal relative to current direction (fast multi-key presses within one tick could still reverse). Overall a solid, playable implementation with good docstrings and UX (restart, speed scaling, clear game over screen).  |
| `laguna-xs.2` | 48 (24/50) | Critical bug: calls `your_score()` on the game-over screen but the function is defined as `our_score()`, causing a NameError the moment the player loses. Restart via recursive `game_loop()` call risks stack growth and leaves outer loops dangling. Magic numbers, inconsistent naming (snake_List, Length_of_snake), and no grid alignment for the starting position mean food collision via `==` can be fragile.  |
| `qwen3-coder-30b` | 78 (39/50) | Clean OOP structure with Snake/Food/Game classes and solid direction-reversal prevention. Notable weaknesses: food randomize-on-snake check only loops once (could still spawn on snake), unused imports (math, sys partially), and no handling of key presses during the same tick that could still cause 180° turns if two keys pressed between updates. UX is good with eyes, grid, score, and restart, though fixed FPS=10 never increases difficulty.  |
| `qwen3-coder-next` | 58 (29/50) | The game works for basic play but has bugs: snake_speed is modified as a local variable despite being a global (UnboundLocalError will occur when eating food), and restart uses recursion instead of a loop which could stack overflow. Mixed naming conventions (snake_List, Length_of_snake, gameLoop), many magic numbers, and globals scattered throughout hurt architecture. UX is decent with score display, restart prompt, and reverse-direction prevention, but using `quit()` after pygame.quit() and the recursive restart are questionable.  |
| `qwen3.5-35b-a3b-coding-nvfp4` | 62 (31/50) | Classic working snake implementation with proper event handling, collision detection, and restart functionality. Weaknesses include inconsistent naming (snake_List, Length_of_snake mixing conventions), recursive gameLoop() call on restart which grows the stack, magic number 20 hardcoded instead of using BLOCK_SIZE, and heavy reliance on local state rather than a Snake/Game class. No food-on-snake check when respawning food, and quit() after pygame.quit() is redundant.  |

## Oi text quality

Opus rubric normalized to 0-100. Raw `/40` score and generated token count included.

| Model | Score | Tokens | Notes |
|---|---:|---:|---|
| `gemma4-26b-mlx-bf16` | 100 (40/40) | 166 | Perfect short, warm Portuguese greeting that offers help. No artifacts, though the token count seems high for such a brief output.  |
| `gpt-oss-20b` | 98 (39/40) | 73 | Clean, friendly Portuguese greeting with a natural follow-up offer to help. Token count seems high for such a short output, but the visible response itself is ideal.  |
| `laguna-xs.2` | 75 (30/40) | 13 | The response is clean, short, and polite, but it replies entirely in English instead of Portuguese, which mismatches the 'oi' greeting.  |
| `qwen3-coder-30b` | 100 (40/40) | 12 | Perfect concise Portuguese greeting with a friendly offer to help. No artifacts or issues.  |
| `qwen3-coder-next` | 100 (40/40) | 14 | Perfect short, friendly Portuguese reply with a warm emoji and offer to help. No artifacts.  |
| `qwen3.5-35b-a3b-coding-nvfp4` | 100 (40/40) | 999 | Perfect friendly Portuguese greeting with a natural follow-up question. However, the 999 token generation count is suspicious given the short visible output — possible hidden content, but the displayed response itself is ideal.  |

## Raw generation cost

Cold-loaded per benchmark. Total = cold load + prompt eval + generation. These are raw cost metrics, not normalized quality scores.

| Model | Oi | Snake.py | Snake.html | Tetris | Todo | Calc | Markdown | Tokens total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `gemma4-26b-mlx-bf16` | 39.7s | 1.3m | 2m | 3m | 2.3m | 1.9m | 1.6m | 24448 |
| `qwen3-coder-next` | 12.2s | 44.1s | 1.7m | 2.5m | 2m | 2m | 1.6m | 20615 |
| `laguna-xs.2` | 8.5s | 30.1s | 1.3m | 2.3m | 1.1m | 50.1s | 1.2m | 18749 |
| `qwen3.5-35b-a3b-coding-nvfp4` | 14.3s | 23.7s | 48.6s | 53.8s | 56s | 52.2s | 1m | 22762 |
| `qwen3-coder-30b` | 5.2s | 27.5s | 48.8s | 1.1m | 41.4s | 31.3s | 50.8s | 21379 |
| `gpt-oss-20b` | 4.8s | 28s | 33.1s | 35.1s | 42.3s | 37.8s | 4.3m | 28381 |

## Methodology notes

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

---

# Agentic dimension — offline coding agents

Design: [`docs/SPEC_AGENTIC.md`](docs/SPEC_AGENTIC.md). Unlike the suite above,
this measures whether a model can **drive a coding agent to completion** — read
files, run commands, react to failures — rather than emit one artifact from one
prompt. Every model runs on localhost with no network.

Run: 2026-08-13, Ollama 0.32.1, Apple M4 Max / 128 GB. 14 legs, 7 models.

**The artifact is the only gate.** Loop metrics are reported, never used to pass
or fail. That is not a stylistic choice: on the first smoke run a model called
`done()` reporting "operator precedence logic fixed" having written nothing at
all, and the tests were still failing. A tidy transcript is not evidence.

## Results

| Model | vision | greenfield | bug-fix |
|---|---|---:|---:|
| `gemma4:26b-mlx-bf16` | sidecar | **8/8** | **6/6** |
| `gpt-oss:20b` | sidecar | **8/8** | **6/6** |
| `qwen3-coder:30b` | sidecar | **8/8** | 0/6 |
| `laguna-xs.2` | sidecar | 6/8 | **6/6** |
| `qwen3-coder-next` | sidecar | 4/8 | 3/6 |
| `qwen3.5:35b-a3b-coding-nvfp4` | native | 4/8 | **6/6** |
| `qwen3-vl:30b` | native | 3/8 | 3/6 |

Bug-fix starts at 3/6 (the planted defect), so 3/6 means "changed nothing that
mattered" and 0/6 means the model made it worse.

## Native vision lost to the sidecar

All five sidecar runs beat both native-vision runs. This was the outcome the spec
pre-committed to accepting rather than correcting with a handicap, and it happened
on the first run.

It is not confounded with model skill: `qwen3.5:35b-a3b-coding-nvfp4` passed
bug-fix 6/6 with no vision in the loop, then scored 4/8 on greenfield with its own
eyes. Same model, same night.

Nor is it a broken image path — `qwen3-vl:30b` took three screenshots and visibly
used them, fixing two JavaScript load errors across iterations. Its final render
looks correct: playing field, cyan I-piece, styled score.

The per-tier breakdown explains it. Every failing run passes `loads_clean`,
`has_canvas` and `has_score`, and fails `game_starts`, `gravity_alive`,
`left_moves`, `right_moves`. They build tetris **scenery**, not a game — and a
screenshot of a static frame cannot reveal that. Vision may actively mislead here:
the model sees a correct-looking board and concludes it is finished.

| Model | vision | load | cnvs | strt | grav | left | rght | rot | scor |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `gemma4:26b-mlx-bf16` | sidecar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `gpt-oss:20b` | sidecar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `qwen3-coder:30b` | sidecar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `laguna-xs.2` | sidecar | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ |
| `qwen3-coder-next` | sidecar | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `qwen3.5:35b-a3b-coding-nvfp4` | native | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `qwen3-vl:30b` | native | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

## Writing new code and repairing old code are different skills

`qwen3-coder:30b` scored 8/8 on greenfield and **0/6** on bug-fix — below the 3/6
it started from. It deleted 834 of 1839 lines and re-declared the operator
constants *after* their use, so `var` hoisting left them `undefined` at parse
time. The values were correct; the code was dead.

`gemma4:26b-mlx-bf16` and `gpt-oss:20b` are the only models that passed both legs.

## Sidecar cost, measured not invented

The spec refuses a hand-tuned sidecar penalty: the extra model load and round trip
are real, and they land in the token and wall-clock columns on their own.
Greenfield, completion tokens:

| Model | coder | sidecar | wall |
|---|---:|---:|---:|
| `gpt-oss:20b` | 8,875 | 1,026 | 3.2 min |
| `qwen3-coder:30b` | 14,001 | 2,822 | 7.0 min |
| `laguna-xs.2` | 18,693 | 3,309 | 7.6 min |
| `gemma4:26b-mlx-bf16` | 11,149 | 2,164 | 8.7 min |

Sidecar overhead runs ~12-18% of coder tokens — real, and smaller than the gap it
bought.

## Not yet measured: Muse Glimmer

Glimmer 30B is the model that prompted this whole dimension and it is **absent
from the table**. It is on Ollama (`ollama run muse-glimmer`, tags `30b`,
`30b-mlx`, `latest`), but pulling it returns `412: requires a newer version of
Ollama` — it needs 0.32.7+, and this run was 0.32.1.

Upgrading and adding one row would put two runtimes in one table, which is not a
comparison. The next sweep re-runs all eight models on one version.

Published Glimmer-vs-Qwen numbers exist but are **Meta's own**, against
Qwen3.6-27B rather than any model above, so they are direction only:

| Benchmark | Glimmer 30B | Qwen3.6-27B |
|---|---:|---:|
| MCP-Atlas (tool use) | **75.5** | 62.5 |
| IFBench (instruction following) | **77.0** | 70.8 |
| TerminalBench 2.1 | 51.7 | **60.7** |
| OSWorld-Verified | 65.9 | **75.6** |
| SWE-Bench Verified | 76.0 | **77.2** |

Vendor tables split along the axis this benchmark exists to settle: Glimmer leads
tool use, Qwen leads terminal work. Neither vendor measures an agentic loop with a
large tool surface on a laptop, which is the cell above.
