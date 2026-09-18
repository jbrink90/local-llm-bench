
# local-llm-bench

An extensible benchmark framework for **local coding and agent models running through Ollama**.

It prompts each model to build real applications and games, saves the generated artifacts, validates them with automated browser tests, and records generation performance. Optional Claude/Bedrock judging can be used for visual polish, code quality, and text quality.

This fork focuses on making the benchmark **portable and practical on Linux**, including Linux hosts where the benchmark runner and Ollama server are on different machines.

## Why

Most LLM benchmarks are synthetic. This one asks models to **actually build software**.

- Builds real applications and games: todo, Tetris, Snake, calculator, and Markdown previewer
- Saves generated output as real files you can open and run
- Validates web applications with automated browser interaction
- Tests actual behavior rather than relying on screenshots or simple HTML/text matching
- Measures cold model loading and generation time
- Records generated token counts
- Produces functional pass/fail results
- Optionally uses Claude via AWS Bedrock for visual, code, and text-quality judging
- Works with Ollama running locally **or on a separate machine**

The goal is not to determine which model wins an abstract benchmark. The goal is to answer a practical question:

> **Which local model can actually build useful software on my hardware?**

## Architecture

The benchmark runner communicates with Ollama through its HTTP API.

```text
┌──────────────────────────────┐
│ Benchmark Runner             │
│                              │
│ bench.sh                     │
│ validators/                  │
│ drivers/                     │
│ prompts/                     │
└──────────────┬───────────────┘
               │
               │ HTTP
               │ /api/generate
               │ /api/pull
               │ /api/ps
               ▼
┌──────────────────────────────┐
│ Ollama                       │
│                              │
│ Local or remote Linux/Windows│
│ GPU host                     │
└──────────────────────────────┘
````

The benchmark does **not** require the Ollama CLI to be installed on the benchmark runner.

Set the Ollama endpoint in `bench.config.json`:

```json
{
  "runtime": {
    "ollama_url": "http://192.168.1.69:11434"
  }
}
```

This makes it possible to run the benchmark on a lightweight Linux/NAS machine while Ollama runs on a separate GPU workstation.

## Requirements

### Benchmark runner

Linux is the primary supported environment for this fork.

Required:

* Bash
* `curl`
* `jq`
* Python 3
* Node.js / npm
* Playwright/Chromium for browser validation

Check the basic dependencies:

```bash
which bash
which curl
which jq
which python3
node --version
npm --version
```

Install the Node dependencies:

```bash
npm install
```

Install the Playwright browser:

```bash
npx playwright install chromium
```

### Ollama

Ollama must be accessible through its HTTP API.

Verify connectivity:

```bash
curl http://localhost:11434/api/version
```

For a remote Ollama server:

```bash
curl http://192.168.1.69:11434/api/version
```

The benchmark uses the Ollama HTTP API rather than `ollama run`.

This allows the benchmark runner and GPU server to be separate machines.

## Quick start

Clone the repository:

```bash
git clone <your-fork-url>
cd local-llm-bench
```

Install Node dependencies:

```bash
npm install
```

Install Chromium:

```bash
npx playwright install chromium
```

Edit `bench.config.json` and configure your models and Ollama endpoint.

Then run:

```bash
./bench.sh
```

For a single model:

```bash
./bench.sh --model qwen2.5-coder:7b
```

For a single benchmark:

```bash
./bench.sh --only snake-html
```

For a clean rerun:

```bash
./bench.sh --only snake-html --model qwen2.5-coder:7b --force
```

## Configuration

Edit `bench.config.json`:

```json
{
  "models": [
    "qwen2.5-coder:7b",
    "qwen3:14b"
  ],
  "benchmarks": [
    {
      "name": "oi",
      "ext": "txt"
    },
    {
      "name": "todo",
      "ext": "html"
    }
  ],
  "runtime": {
    "keep_alive": "10m",
    "timeout_secs": 7200,
    "ollama_url": "http://localhost:11434",
    "skip_if_exists": true
  }
}
```

### `runtime.ollama_url`

The HTTP endpoint for the Ollama server.

Local:

```text
http://localhost:11434
```

Remote:

```text
http://192.168.1.69:11434
```

### `runtime.keep_alive`

Controls how long Ollama keeps a model loaded after generation.

### `runtime.timeout_secs`

Maximum HTTP request time.

Large coding tasks can take several minutes on larger local models, so the default timeout is intentionally generous.

### `runtime.skip_if_exists`

When `true`, existing artifacts are skipped.

Use `--force` when you want to regenerate them.

## Cold-load behavior

The benchmark intentionally unloads the currently loaded model before each benchmark.

This means each benchmark measures a **cold model load followed by generation**, rather than simply measuring repeated warm inference.

The sequence is approximately:

```text
Unload model
    ↓
Load model
    ↓
Generate response
    ↓
Save artifact
    ↓
Validate artifact
```

This is important when comparing models on hardware with limited VRAM.

The benchmark uses Ollama's HTTP API to unload models, so the runner does not need the Ollama CLI installed locally.

## Benchmarks

| Name           | Artifact | What it tests                                                      |
| -------------- | -------- | ------------------------------------------------------------------ |
| `oi`           | txt      | Basic response generation and cold-load timing                     |
| `snake-pygame` | py       | Python code generation and code review                             |
| `snake-html`   | html     | Game logic, movement, scoring, and browser interaction             |
| `tetris`       | html     | Board state, movement, rotation, line clearing, and scoring        |
| `todo`         | html     | Adding, completing, filtering, deleting, persistence, and counters |
| `calc`         | html     | Arithmetic, precedence, parentheses, decimals, and clearing        |
| `markdown`     | html     | Live preview, headings, formatting, links, and code blocks         |

### Why short prompts?

The web application prompts are intentionally underspecified.

For example:

```text
build me a modern todo app as a single HTML file. make it beautiful.
```

The purpose is to test what the model can produce from a relatively small amount of direction.

If every UI detail is explicitly specified, the benchmark increasingly measures instruction-following rather than the model's ability to make reasonable implementation and design decisions.

## Validation

Web benchmarks generate an artifact and then run an automated browser driver against it.

The basic flow is:

```text
Model
 ↓
Generated HTML
 ↓
Validator
 ↓
Browser driver
 ↓
Functional checks
 ↓
Pass / fail
```

A benchmark should fail when the generated application does not satisfy its required behavior.

This is deliberately different from simply checking whether the model returned valid HTML.

### Validator contract

```text
Usage:
validators/<name>.sh <artifact-file> <model> <results-dir>

Exit:
0     = pass
non-zero = fail

Must write:
<results-dir>/<benchmark>-<safe-model>.json
```

Minimum result:

```json
{
  "model": "<tag>",
  "benchmark": "<name>",
  "pass": true
}
```

Validators should provide enough information to diagnose why an artifact failed.

## Scoring

`./bench.sh` provides the local benchmark results and functional validation.

The optional full benchmark adds Claude/Bedrock judging for:

* Visual polish of web artifacts
* Code quality of pygame artifacts
* Text quality of the `oi` benchmark
* Aggregated leaderboard generation

Current weighting:

* Functional: 30 points
* Visual polish: 30 points
* Pygame code review: 15 points
* OI response quality: 10 points
* Efficiency: 15 points

The functional benchmark is intended to remain useful **without access to a cloud model**.

## Optional Claude / AWS Bedrock judging

The Bedrock judging pipeline is optional.

You do **not** need AWS credentials to run the local generation and functional benchmark.

For the full judging pipeline:

```bash
export AWS_PROFILE=your-bedrock-profile
./scripts/run-full-benchmark.sh
```

This adds model-generated judging for visual polish, code quality, and text quality.

The local benchmark itself still runs entirely through Ollama.

## Adding a benchmark

1. Add a prompt:

```text
prompts/<name>.txt
```

2. Add a validator:

```text
validators/<name>.sh
```

3. For a web artifact, add a browser driver:

```text
drivers/<name>.mjs
```

4. Add the benchmark to `bench.config.json`:

```json
{
  "name": "<name>",
  "ext": "html"
}
```

5. Run a smoke test:

```bash
./bench.sh --only <name> --model <cached-model> --force
```

A new validator should be tested independently before running the complete model matrix.

## Adding a model

Add the Ollama model tag to `models` in `bench.config.json`.

For example:

```json
{
  "models": [
    "qwen2.5-coder:7b",
    "qwen3:14b",
    "hf.co/unsloth/Qwen3.5-9B-GGUF:Q5_K_M"
  ]
}
```

The benchmark uses Ollama's `/api/pull` endpoint to ensure the requested model is available before testing it.

You can inspect the models available on your Ollama server with:

```bash
curl -s http://localhost:11434/api/tags | jq -r '.models[].name'
```

For a remote server:

```bash
curl -s http://192.168.1.69:11434/api/tags | jq -r '.models[].name'
```

Model tags do not have to correspond to the standard Ollama library URL format. Hugging Face-backed Ollama tags such as:

```text
hf.co/unsloth/Qwen3.5-9B-GGUF:Q5_K_M
```

are valid as long as Ollama can pull and run them.

## CLI

```bash
./bench.sh
```

Run the configured benchmark matrix.

```bash
./bench.sh --force
```

Regenerate existing artifacts.

```bash
./bench.sh --only todo
```

Run only one benchmark.

```bash
./bench.sh --model qwen3:14b
```

Run only one model.

Flags can be combined:

```bash
./bench.sh --only todo --model qwen3:14b --force
```

## Output

```text
output/<benchmark>/<model>.<ext>
    Generated artifacts

logs/<benchmark>-<model>.log
    Generation and timing logs

raw/<benchmark>-<model>.json
    Raw Ollama API responses

caxi-results/
    Historical result directory containing validator results,
    screenshots, and leaderboard data

screenshots/
    Manual screenshots from exploratory runs
```

`caxi-results/` retains its historical name for compatibility with the original project. The current web validation architecture uses browser drivers rather than relying on the directory name.

## Results

See:

```text
RESULTS.md
```

Individual validator results can also be found under:

```text
caxi-results/
```

Raw model responses are stored under:

```text
raw/
```

and generated applications are stored under:

```text
output/
```

## Platform notes

This fork is intended to run cleanly on Linux.

The original project contains assumptions from its macOS development environment, including paths such as:

```text
/opt/homebrew/bin/bash
```

and macOS-specific utilities.

The fork replaces those assumptions with portable Linux-compatible tooling where possible.

Shell scripts should use:

```bash
#!/usr/bin/env bash
```

and Unix line endings.

If you are contributing from Windows or macOS, check shell scripts for CRLF line endings before committing.

## Design principles

The benchmark follows a few principles:

### Test real work

Prefer tasks that require the model to produce functioning software rather than synthetic questions.

### Correctness over speed

A model that generates code quickly but produces broken applications should not automatically beat a slower model that produces working software.

### Test behavior

Whenever possible, validate the generated application by actually interacting with it.

### Keep prompts small

Avoid turning every benchmark into a giant specification.

### Keep runtime local

The model being benchmarked should run through Ollama. Cloud judging is optional and separate from model generation.

### Make the results reproducible

Record the model, timing, generated artifact, raw response, and validator result.

## License

MIT