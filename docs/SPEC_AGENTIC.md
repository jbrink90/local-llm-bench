# Agentic dimension — offline coding agents

**Status:** Design draft, not implemented
**Created:** 2026-08-11

## Why this exists

Every local-model leaderboard, including this repo's current one, measures
**one-shot artifact generation**: one prompt in, one file out. That answers
"which local model writes the prettiest snake."

It does not answer the question that matters on a laptop with no network:
**which local model can drive a coding agent to completion?** Reading files,
running commands, reacting to a failing test, looking at its own output. No
public benchmark covers that cell for local models, which is why it is worth
publishing.

The existing seven benchmarks stay as-is. This is a new dimension alongside
them, not a replacement.

## Non-negotiable: the artifact is still the gate

A model can make twenty clean tool calls and ship a broken game. That run is a
**failure**, not an efficient success.

So agentic metrics are computed **only for runs whose artifact already passes
the existing validators**. Loop quality is a tiebreak among working results, never
a way to pass. Concretely:

```
artifact validates?  no  -> run fails. No agentic score. Loop stats recorded for diagnosis only.
artifact validates? yes  -> agentic metrics apply (turns, recovery, tokens, wall clock).
```

This keeps the repo's existing principle ("correctness > speed, always") intact
and extends it to "correctness > loop elegance."

## What changes about the task

Same deliverables (a working app), reached a harder way. Instead of emitting one
file from one prompt, the model works in a scratch git repo through a tool
surface:

| Tool | Purpose |
|---|---|
| `read_file` | inspect existing source |
| `write_file` | create/modify source |
| `list_dir` | discover structure |
| `run_command` | run the test/build/validator |
| `screenshot` | render the artifact and see it (vision step, below) |

Two seeded starting states, because they test different things:

1. **Greenfield** — empty repo, build the app from scratch through tools.
2. **Bug-fix** — repo pre-seeded with a working app plus one injected defect and
   a failing test. The model must find it, fix it, and get the test green.

The bug-fix variant is the more discriminating of the two: it forces
read-before-write and rewards actually parsing command output.

### Deliberately planted failure

One seeded task ships with a command that fails on first run (missing dep, wrong
path). The metric is **recovery**: does the model read the error and adapt, or
retry the same call? This is the single most useful signal for offline agent
work and no existing benchmark here captures it.

## Vision: required, with a declared fallback

Vision matters for this dimension because game/UI work is inherently visual —
the model should look at what it rendered.

Local capability is uneven, checked against Ollama:

| Model | tools | vision |
|---|---|---|
| `qwen3-vl:30b` | yes | **yes** |
| `qwen3.5:35b-a3b-coding-nvfp4` | yes | **yes** |
| `qwen3-coder:30b` | yes | no |
| `qwen3-coder-next` | yes | no |
| `gemma4:26b-mlx-bf16` | yes | no |
| `laguna-xs.2` | yes | no |
| `gpt-oss:20b` | yes | no |

Weighting vision heavily would rank *availability*, not skill — only two locals
would ever score. So:

- **Every model runs the vision step.** It is not optional and not skipped.
- Models with native vision consume the screenshot directly.
- Models without it use a **sidecar**: the screenshot goes to a local vision
  model (`qwen3-vl:30b` for all paired runs, so the assist is identical across
  the cohort), whose text description is fed back to the coder.
- The configuration is a **published column** (`native-vision` vs
  `coder+sidecar`), so a paired result is never misread as single-model
  capability.

### The sidecar penalty is measured, not invented

A sidecar costs a second model load and an extra round trip per screenshot. That
is real wall-clock and real tokens, and the existing efficiency component already
captures it. **Do not add a hand-tuned handicap on top** — a published number
should come from measurement, not from a fudge factor.

Consequence to accept up front: a strong blind coder plus `qwen3-vl` may
legitimately outrank a weaker native-vision model. That is a real finding about
how to run offline, not a scoring bug.

## Metrics

Recorded per run; only the first group gates.

**Gate (existing validators, unchanged)**
- artifact functional pass/fail
- code review score

**Loop quality (working runs only)**
- turns to completion
- tool-call schema validity rate (malformed/rejected calls / total)
- recovery: did it adapt after the planted failure, or repeat the call
- wasted calls (re-reading a file it already read, redundant `list_dir`)

**Cost**
- wall clock to green
- total tokens including the sidecar leg
- peak resident memory (a 51 GB model behaves differently on battery than a 18 GB one)

## Offline discipline

The runtime must work with **no network**, which is the whole premise.

- Models under test: `localhost:11434` only. Any remote host is disqualified
  from this dimension by construction.
- The vision sidecar is local too (`qwen3-vl:30b`).
- **Known tension:** the existing suite uses a cloud model as judge for polish
  and code review. That is post-hoc grading, not part of the offline run, so it
  does not break the premise — but it means a full scoring pass needs network
  even though the benchmark itself does not. State this in the README rather
  than hiding it.

## Fits the existing framework

No new architecture. Following `AGENTS.md`:

- `prompts/agentic-<task>.txt` — the brief
- `validators/agentic-<task>.sh` — bash, honors the existing validator contract
  (`<artifact> <model> <results-dir>`, exit 0/non-zero, writes
  `<results-dir>/<benchmark>-<safe-model>.json`)
- entry in `bench.config.json` `benchmarks`
- artifacts to `output/`, logs to `logs/`, validator output to `caxi-results/`
- README row

Open implementation question: the agent loop itself needs a driver that holds
multi-turn state and dispatches tools. `drivers/*.mjs` is the established place
for anything Playwright-adjacent, and the screenshot step needs a browser
anyway, so a driver is the natural home. Bash stays the orchestrator.

## Open implementation questions

All design questions are settled (below). What remains is calibration that needs a
pilot run rather than a decision: the driver's tool-dispatch shape, and where the
observed turn counts actually land for working models.

## Settled

- **Both variants ship.** Greenfield and bug-fix measure different abilities —
  structuring work from nothing vs reading unfamiliar code and parsing test
  output. A model can be strong at one and weak at the other, and that split is
  itself a publishable result. Scored as separate columns, not averaged into one
  agentic number.
- **No hand-tuned sidecar penalty.** The extra model load and round trip are real
  measured cost; the efficiency component already captures them.
- **Vision splits by variant, and is never forced onto a task with nothing to see.**
  Requiring a screenshot step in a pure-logic task would manufacture exactly the
  handicap this spec already rejects — it would read as "look how bad you are, you
  needed help."

  | Variant | Artifact | Vision |
  |---|---|---|
  | bug-fix | `expr-eval` logic fixture, failing test | **none** — nothing to render |
  | greenfield | UI app | **applies** — native or declared sidecar |

  Every model therefore gets one unasterisked score (bug-fix, identical footing for
  blind and sighted models alike) and one configuration-declared score (greenfield).
  A weaker greenfield result is legible as *how the model saw*, not as a blindness
  penalty. Bug-fix is also the cheaper leg: node running a test, no browser.
- **The fixture ships in-tree.** One vendored copy, byte-identical for every model,
  and the run touches no network — which is the entire premise. Memorization risk is
  real but deferred: a public fixture may eventually land in training data, and the
  answer then is to change the planted defect, not to generate fixtures at run time
  and lose reproducibility.
- **Fixture: `expr-eval` (MIT, zero runtime dependencies).** Verified against the
  npm registry, not a search summary: MIT, `dependencies: {}`. Zero deps is what
  makes vendoring viable at all — a dep tree would force `npm install` mid-run and
  break the offline rule. Operator-precedence defects are the natural plant
  (`2+3*4` returning 20 instead of 14): deterministic, no DOM, no network. Keep
  its LICENSE file intact — MIT's only real obligation is preserving the notice.
- **Peak memory is reported, never gated.** A 51 GB model is not wrong on a 128 GB
  machine, only heavier, and a hard ceiling would disqualify the two largest local
  models before they ran. Publishing the number lets a reader with 32 GB draw their
  own line — which is the more useful artifact than us drawing it for them. Same
  principle as the turn cap: measure and report, let the operator judge.
