# The harness

Every result in this repo was produced by `drivers/agentic.mjs` — 459 lines of
JavaScript in this repo. Not Aider, not OpenHands, not SWE-agent, not Claude
Code, not Cursor. The only runtime dependencies are `playwright` (screenshots)
and node's own stdlib.

## Why not an existing agent

Benchmarking a model *through* an off-the-shelf agent measures the agent too.
Each one ships its own system prompt, its own tool descriptions, its own
context-window strategy and its own retry behavior — and those choices move
scores as much as the model does. Two models compared inside Aider are partly a
measurement of Aider.

A purpose-built loop is auditable instead. You can read the entire tool surface
in one sitting and know exactly what each model was handed. That is the whole
argument for writing it rather than importing it.

**The tradeoff, stated plainly:** these numbers describe how a model behaves in
a *minimal* agent loop. A model that scores 9/9 here may do worse inside a
harness with forty tools, or better inside one with smarter context management.
Do not read these scores as "how well will this model work in my IDE agent".

## The loop

```
send prompt + tool list  ->  model replies with tool_calls
                         ->  execute them against a real directory
                         ->  append results to the conversation
                         ->  repeat until done() or a guard fires
```

Transport is Ollama `/api/chat`, non-streaming, via `node:http` directly (see
"Timeouts" — the reason is not stylistic).

Six tools, and that is the complete surface:

| tool | what it does |
|---|---|
| `list_dir` | list a directory |
| `read_file` | read a file |
| `write_file` | write a file |
| `run_command` | run a shell command, capture exit code + output |
| `screenshot` | render an HTML file and look at it (greenfield leg only) |
| `done` | declare the work finished |

`done()` is a *claim*, not a verdict. Nothing is scored from what the model
says. Every score comes from running the project's own test suite in the
directory the model actually edited. A model that calls `done("fixed the
precedence bug")` having written nothing scores zero — this is not
hypothetical, it happened on the first smoke run.

## Context and caching

This is the part that took the most iterations to get right, and the part most
worth understanding if you plan to build something similar.

### The failure it exists to prevent

The naive loop appends every tool result to the message list and sends the whole
thing every turn. That works for five turns and collapses at fifty. Measured on
a real run before the fix: prompts arriving at Ollama with
`task.n_tokens = 131011`, `131042`, `131057` — the context window completely
full, on every single request. Each turn re-processed ~131k tokens of prompt
before emitting one output token, with a 12 GB KV cache on top of the weights.
One bug-fix leg took 57 minutes where the same leg had taken 7.

### What the driver does instead

**A context ceiling.** `num_ctx: 32768` on every request. This is a *harness
parameter*, not a neutral default: it bounds prefill cost and shrinks the KV
cache from 12 GB to 3.5 GB, but it also truncates any model that would
legitimately have used more. Disclosed here because it affects results.

**Block trimming, not a sliding window.** The first implementation dropped one
message per turn to stay under the ceiling. That bounded the context and
destroyed the KV cache: Ollama's prefix cache only survives when the *front* of
the prompt is byte-identical to the previous request, and moving the cut every
turn changes the front every turn. Measured cost of that mistake — a
15,034-token prompt reusing **693** cached tokens where a stable prefix had been
reusing **12,476**.

The fix is to advance the cut monotonically and only in whole blocks
(`TRIM_BLOCK = 12`), so the prefix stays identical between advances:

```js
while (rest.length - trimOffset > KEEP_RECENT_MESSAGES + TRIM_BLOCK) {
  trimOffset += TRIM_BLOCK;
}
```

The omission note is worded to name the block count rather than a per-turn
number, because a note whose text changed every turn would itself break the
prefix.

Simulated over 80 turns: **5 cache invalidations instead of 56.**

**Measured across the 63-leg run:** only 12 of 62 legs grew long enough to trim
at all; when trimming happened, the median was **7 cache invalidations for the
entire leg**. Median `prefill_share` — the fraction of wall time spent
re-reading history rather than generating — came out at **0.085**. The worst leg
hit 0.696, and that model was the one thrashing.

**Tool results are capped** at 6000 chars each. A model that cats a large file
should not be able to blow its own context on one call.

**The first message is never trimmed.** The task brief survives every advance;
losing it mid-leg would change the task.

### What it deliberately does not do

No summarization of dropped history, no vector retrieval over past turns, no
compaction pass. Those are all defensible in a product agent and all add a
variable to a benchmark: a model would then be partly scored on how well the
*summarizer* worked. Dropped turns are simply gone, and the model is told how
many.

## Guards

Every guard here exists because something went wrong first. None were designed
in advance.

| guard | value | why it exists |
|---|---|---|
| turn cap | 500 | runaway loops. Reported, never a scoring penalty — a careful model that reads four files first is not being wasteful |
| leg wall clock | 40 min | one leg consumed **207 minutes** and 741,621 generated tokens before this existed |
| leg tokens | 250k | same incident, caught from the other direction |
| request wall clock | 15 min | a socket sat `ESTABLISHED` and silent for **3h41m**. An idle-socket timeout never fires on a connection that is open but quiet, so this is an absolute ceiling |
| command timeout | 120s | per `run_command` |
| repeated-timeout breaker | 2 | after two timeouts the same command is refused rather than retried |

A guard hit is recorded with its reason, not silently.

## Process containment

`run_command` does **not** use `execFileSync`. That was the original
implementation and it caused a machine-wide incident: a model wrote a parser
that looped forever at EOF, `execFileSync`'s timeout killed only `/bin/sh`, and
the `npm -> node --test -> test-file` descendants were reparented to PID 1 and
kept spinning. The agent then retried the same command every two minutes.
Final state: **307 orphaned processes, 102 of them spinning, 1140% CPU**, load
average 429, the whole Mac unusable.

Every command now runs in its own process group (`detached: true`) and the
timeout kills the **group** — SIGTERM, then SIGKILL after a grace period.
Verified against a child that ignores SIGTERM and against a
child-plus-grandchild tree: zero survivors in both. The runner traps
EXIT/INT/TERM and kills the driver subtree before unloading models, so Ctrl-C
cleans up too.

## Timeouts, and why not `fetch`

Node's global `fetch` (undici) enforces a 300-second `headersTimeout` that
cannot be raised per request. Six legs of one sweep died at exactly `5m01s`
with `500`s in the Ollama log — the model was working fine and the client gave
up. Worse, two of those were recorded as `pass=false, no artifact produced`,
which is indistinguishable from a model that genuinely produced nothing.

The driver uses `node:http` with an explicit idle-socket timeout plus an
absolute wall-clock ceiling. And infrastructure failures now record
`pass=null, invalid=true` — never a zero. A harness that cannot tell "the model
failed" from "the harness failed" produces numbers nobody should trust.

## Isolation

Each leg gets a **fresh copy of the fixture** in its own directory. No leg
inherits another's edits, and repeats of the same leg cannot contaminate each
other. Paths escaping the working directory are refused and counted as
malformed tool calls rather than executed.

## Fully offline

After the fixtures are vendored, a run makes no network calls. Fixtures ship
with zero runtime dependencies and are tested with node's built-in
`node:test` — `expr-eval`'s own suite needs mocha, which would have meant an
`npm install` mid-run and broken the premise. Ollama is local. The only
non-local step in the whole pipeline is the optional cloud judge used by the
older visual-polish benchmarks, which is post-hoc scoring and not part of an
agentic run.

## Tuning

All of it is environment-overridable:

```
AGENTIC_NUM_CTX=32768        # context ceiling
AGENTIC_KEEP_RECENT=24       # messages kept after the brief
AGENTIC_TRIM_BLOCK=12        # advance the cut in blocks this size
AGENTIC_MAX_TURNS=500        # runaway guard
AGENTIC_MAX_LEG_MS=2400000   # 40 min per leg
AGENTIC_MAX_LEG_TOKENS=250000
OLLAMA_HARD_LIMIT_MS=900000  # 15 min per request
AGENTIC_REPEATS=3            # attempts per leg
```

Changing any of these changes the results. If you publish numbers from a
modified harness, say which values you used.
