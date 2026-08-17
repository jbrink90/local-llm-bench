#!/usr/bin/env node
// Agentic loop driver — runs a local model as a coding agent over a tool surface.
//
// Unlike the one-shot drivers, this holds multi-turn state: the model calls
// tools, sees results, and iterates until it declares done or hits the guard.
// Artifact correctness is judged separately by the variant's validator; this
// driver only produces the loop transcript and its metrics.
//
// Usage: agentic.mjs <workdir> <model> <results-dir> <safe-name> <prompt-file>

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'fs';
import { resolve, join, relative, dirname } from 'path';
import { runContained } from './exec.mjs';
import { screenshot, describeViaSidecar, imageForNative } from './vision.mjs';
import { ollamaPost } from './ollama.mjs';

const [, , workdirArg, model, resultsDir, safeName, promptFile] = process.argv;
const WORKDIR = resolve(workdirArg);
const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';

// A guard against runaway loops, NOT a work budget. A model that reads several
// files before editing is being careful; the spec is explicit that turns are
// reported, never penalized. Only a true runaway should trip this.
const MAX_TURNS = Number(process.env.AGENTIC_MAX_TURNS || 500);
const CMD_TIMEOUT_MS = 120_000;

// Ollama defaults these models to a 131,072-token context, and the loop filled it:
// the 2026-08-15 sweep logged prefills of task.n_tokens = 131011 on turn after
// turn, each one re-processing a full context before emitting a single token. One
// leg took 57 minutes where an earlier identical leg took 7, and the KV cache
// alone claimed 12 GB on top of the weights. Cap it: 32k is ample for this task
// and keeps prefill honest.
const NUM_CTX = Number(process.env.AGENTIC_NUM_CTX || 32768);

// Tool results are the bulk of the transcript, and old ones are dead weight — the
// model has already acted on them. Bound the history so prompt size plateaus
// instead of growing without bound.
//
// Trimming happens in BLOCKS, not one message per turn. Ollama's KV prefix cache
// only survives when the front of the prompt is byte-identical to the previous
// request; a window that slides every turn changes the front every turn and throws
// the cache away. Observed cost of getting this wrong: a 15,034-token prompt reused
// only 693 cached tokens and re-processed the rest, where a stable prefix had been
// reusing 12,476.
//
// So the kept tail only moves when the transcript exceeds the high-water mark, and
// then it drops a whole block at once — the prefix stays stable for many turns.
const KEEP_RECENT_MESSAGES = Number(process.env.AGENTIC_KEEP_RECENT || 24);
const TRIM_BLOCK = Number(process.env.AGENTIC_TRIM_BLOCK || 12);

// How many leading messages are currently dropped. Monotonic: it only ever grows,
// and only in TRIM_BLOCK steps, so a prefix that was valid stays valid.
let trimOffset = 0;

// A single tool result should not be able to eat the window on its own.
const MAX_TOOL_RESULT_CHARS = 6000;

// The greenfield variant renders and inspects its own output; the bug-fix variant
// is pure logic with nothing to look at, so the tool is absent there entirely
// rather than present and useless. See docs/SPEC_AGENTIC.md.
const VISION_ENABLED = process.env.AGENTIC_VISION === '1';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and directories at a path relative to the project root.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative path. Use "." for the project root.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file relative to the project root.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative path to the file.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write full content to a file relative to the project root, replacing it.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file.' },
          content: { type: 'string', description: 'Complete new file content.' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command in the project root and return stdout/stderr and exit code.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'The shell command to run.' } },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'done',
      description: 'Declare the task finished. Call this only when the work is complete and verified.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string', description: 'What was changed and why.' } },
        required: ['summary'],
      },
    },
  },
];

if (VISION_ENABLED) {
  TOOLS.splice(TOOLS.length - 1, 0, {
    type: 'function',
    function: {
      name: 'screenshot',
      description:
        'Render an HTML file in a browser and see how it actually looks. Use this to check your work visually before declaring done.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative path to the HTML file to render.' } },
        required: ['path'],
      },
    },
  });
}

// Resolved at startup from Ollama, never assumed: a model either advertises vision
// or it gets the sidecar. Guessing here would silently mislabel a whole run.
let visionMode = null; // 'native' | 'sidecar' | null when the variant has no vision

const metrics = {
  benchmark: 'agentic',
  model,
  turns: 0,
  tool_calls: 0,
  malformed_calls: 0,      // unknown tool, or missing required args
  wasted_calls: 0,         // re-reading a file already read with no intervening write
  failed_commands: 0,
  repeated_failures: 0,    // same command re-run after it already failed: flailing, not care
  recovered: null,         // did it adapt after a command failed
  declared_done: false,
  hit_guard: false,
  tokens: { prompt: 0, completion: 0 },
  // Durations, so the report can show throughput and not only volume. Prefill rate
  // is the number that matters most in an agentic loop, because every turn
  // re-processes the whole prompt. It also degrades as the prompt grows: observed
  // 721 tok/s at 3k tokens falling to 411 tok/s at 12k within one request, on the
  // same model.
  durations_ns: { load: 0, prompt_eval: 0, eval: 0, total: 0 },
  // Sidecar cost is reported separately so a paired run's overhead is visible
  // rather than buried in the coder's own totals.
  vision: {
    mode: null,            // 'native' | 'sidecar' | null (variant has no vision)
    screenshots: 0,
    sidecar_tokens: { prompt: 0, completion: 0 },
  },
  wall_ms: 0,
  history_trimmed: false,
  errors: [],
};

// Sandbox: a path escaping the workdir is a malformed call, not a filesystem op.
function safePath(p) {
  const abs = resolve(WORKDIR, p ?? '');
  const rel = relative(WORKDIR, abs);
  if (rel.startsWith('..') || resolve(abs) === resolve(WORKDIR, '..')) {
    throw new Error(`path escapes the project root: ${p}`);
  }
  return abs;
}

const readFiles = new Set();      // for wasted-call detection
const failedCommands = new Map(); // command -> times it has failed
// Commands that hit the timeout, and how often. A timed-out command leaves a killed
// process group behind; relaunching it forever is the leak that took the machine down.
const timedOutCommands = new Map();
const MAX_TIMEOUT_RETRIES = 2;

function dispatch(name, args) {
  switch (name) {
    case 'list_dir': {
      const dir = safePath(args.path);
      if (!existsSync(dir)) return `error: no such directory: ${args.path}`;
      return readdirSync(dir, { withFileTypes: true })
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .join('\n') || '(empty)';
    }
    case 'read_file': {
      const file = safePath(args.path);
      if (!existsSync(file) || statSync(file).isDirectory()) {
        return `error: no such file: ${args.path}`;
      }
      if (readFiles.has(file)) metrics.wasted_calls++;
      readFiles.add(file);
      return readFileSync(file, 'utf8');
    }
    case 'write_file': {
      const file = safePath(args.path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, args.content ?? '');
      readFiles.delete(file); // content changed, so re-reading is legitimate again
      return `wrote ${args.path} (${(args.content ?? '').length} bytes)`;
    }
    case 'run_command': {
      const cmd = args.command;
      // A command that already timed out twice is not going to start working, and
      // relaunching it every turn is how one hung test became 102 CPU spinners.
      if ((timedOutCommands.get(cmd) || 0) >= MAX_TIMEOUT_RETRIES) {
        metrics.blocked_retries = (metrics.blocked_retries || 0) + 1;
        return `refused: this command has timed out ${MAX_TIMEOUT_RETRIES} times already. Try a different approach.`;
      }
      return runContained(cmd, { cwd: WORKDIR, timeoutMs: CMD_TIMEOUT_MS }).then((r) => {
        if (r.timedOut) {
          timedOutCommands.set(cmd, (timedOutCommands.get(cmd) || 0) + 1);
          metrics.timed_out_commands = (metrics.timed_out_commands || 0) + 1;
        }
        if (r.code !== 0) {
          metrics.failed_commands++;
          const prior = failedCommands.get(cmd) || 0;
          if (prior > 0) metrics.repeated_failures++;
          failedCommands.set(cmd, prior + 1);
        }
        return `exit ${r.code}\n${r.stdout}\n${r.stderr}`;
      });
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

async function chat(messages) {
  return ollamaPost(OLLAMA, '/api/chat', {
    model,
    stream: false,
    messages: trimHistory(messages),
    tools: TOOLS,
    options: { num_ctx: NUM_CTX },
  });
}

// Keep the brief (dropping it loses the task) plus the most recent window.
// Everything between is tool output the model has already acted on.
function trimHistory(messages) {
  const [brief, ...rest] = messages;

  // Advance the cut only when the tail has grown a full block past the target, and
  // advance it BY a full block. Between advances the prompt prefix is unchanged, so
  // the KV cache holds.
  while (rest.length - trimOffset > KEEP_RECENT_MESSAGES + TRIM_BLOCK) {
    trimOffset += TRIM_BLOCK;
    metrics.history_trimmed = true;
    metrics.trim_advances = (metrics.trim_advances || 0) + 1;
  }
  if (trimOffset === 0) return messages;

  // The omission note names the block count, not a per-turn number, so its text is
  // also stable between advances — a changing note would itself break the prefix.
  return [
    brief,
    { role: 'user', content: `[${trimOffset} earlier messages omitted to bound context]` },
    ...rest.slice(trimOffset),
  ];
}

// Ask Ollama what the model can do rather than maintaining a hand-written list
// that silently rots when a tag is repulled.
async function resolveVisionMode() {
  if (!VISION_ENABLED) return null;
  const caps = (await ollamaPost(OLLAMA, '/api/show', { model })).capabilities || [];
  return caps.includes('vision') ? 'native' : 'sidecar';
}

// Returns what the model sees. Native models get the image on the next message;
// blind models get the sidecar's description as tool text.
async function handleScreenshot(args) {
  const html = safePath(args.path);
  if (!existsSync(html)) return { text: `error: no such file: ${args.path}` };
  const png = join(resultsDir, `agentic-${safeName}-shot${metrics.vision.screenshots + 1}.png`);
  mkdirSync(resultsDir, { recursive: true });
  const { errors } = await screenshot(html, png);
  metrics.vision.screenshots++;
  const jsErr = errors.length ? `\nJavaScript errors on load:\n${errors.join('\n')}` : '';

  if (visionMode === 'native') {
    return { text: `Screenshot captured.${jsErr}`, image: imageForNative(png) };
  }
  const { text, tokens } = await describeViaSidecar(png);
  metrics.vision.sidecar_tokens.prompt += tokens.prompt;
  metrics.vision.sidecar_tokens.completion += tokens.completion;
  return { text: `Screenshot description (via vision model):\n${text}${jsErr}` };
}

const prompt = readFileSync(resolve(promptFile), 'utf8');
const messages = [{ role: 'user', content: prompt }];
const transcript = [];
const started = Date.now();

try {
  visionMode = await resolveVisionMode();
  metrics.vision.mode = visionMode;

  while (metrics.turns < MAX_TURNS) {
    metrics.turns++;
    const res = await chat(messages);
    metrics.tokens.prompt += res.prompt_eval_count || 0;
    metrics.tokens.completion += res.eval_count || 0;
    metrics.durations_ns.load += res.load_duration || 0;
    metrics.durations_ns.prompt_eval += res.prompt_eval_duration || 0;
    metrics.durations_ns.eval += res.eval_duration || 0;
    metrics.durations_ns.total += res.total_duration || 0;

    const msg = res.message || {};
    messages.push(msg);
    const calls = msg.tool_calls || [];

    if (calls.length === 0) {
      // No tool call and no done() — the model is talking, not working. One nudge,
      // then stop: an unprompted prose reply twice over is not a loop making progress.
      transcript.push({ turn: metrics.turns, text: (msg.content || '').slice(0, 2000) });
      if (messages.filter((m) => m.role === 'user').length > 1) break;
      messages.push({
        role: 'user',
        content: 'Continue using the tools. Call done() when the task is complete.',
      });
      continue;
    }

    for (const call of calls) {
      const name = call.function?.name;
      // Ollama returns arguments pre-parsed as an object; tolerate a JSON string too.
      let args = call.function?.arguments ?? {};
      if (typeof args === 'string') {
        try { args = JSON.parse(args); } catch { args = {}; }
      }
      metrics.tool_calls++;

      if (name === 'done') {
        metrics.declared_done = true;
        transcript.push({ turn: metrics.turns, tool: 'done', summary: args.summary });
        break;
      }

      let result;
      let image = null;
      try {
        if (name === 'screenshot') {
          const shot = await handleScreenshot(args);
          result = shot.text;
          image = shot.image ?? null;
        } else {
          result = await dispatch(name, args);
        }
      } catch (e) {
        metrics.malformed_calls++;
        result = `error: ${e.message}`;
      }
      transcript.push({
        turn: metrics.turns,
        tool: name,
        args: name === 'write_file' ? { path: args.path, bytes: (args.content ?? '').length } : args,
        result: String(result).slice(0, 4000),
      });
      const toolMsg = { role: 'tool', content: String(result).slice(0, MAX_TOOL_RESULT_CHARS) };
      // A native-vision model receives the pixels, not a description of them.
      if (image) toolMsg.images = [image];
      messages.push(toolMsg);
    }

    if (metrics.declared_done) break;
  }
  if (metrics.turns >= MAX_TURNS) metrics.hit_guard = true;
} catch (e) {
  metrics.errors.push(e.message);
}

metrics.wall_ms = Date.now() - started;

// Throughput, derived once at the end. Reported, never gated — the same doctrine as
// turns and memory: measure and publish, let the reader judge.
const NS = 1e9;
metrics.rates = {
  prefill_tok_s: metrics.durations_ns.prompt_eval
    ? +(metrics.tokens.prompt / (metrics.durations_ns.prompt_eval / NS)).toFixed(1)
    : null,
  generate_tok_s: metrics.durations_ns.eval
    ? +(metrics.tokens.completion / (metrics.durations_ns.eval / NS)).toFixed(1)
    : null,
  // How much of the run was spent re-reading the prompt instead of producing work.
  // A loop that spends most of its time on prefill is paying for its own history.
  prefill_share: metrics.durations_ns.total
    ? +(metrics.durations_ns.prompt_eval / metrics.durations_ns.total).toFixed(3)
    : null,
};

// Recovery is only meaningful once something actually failed. A model that hit no
// failure gets null, never false — an unmeasured signal is not a failed one.
if (metrics.failed_commands > 0) {
  // Recovery means adapting, so most failures must have been novel rather than the
  // same call fired again. A run with 12 failures of which 9 were repeats is
  // flailing, and an earlier `repeats < failures` test scored that as recovered.
  const novel = metrics.failed_commands - metrics.repeated_failures;
  metrics.recovered = novel > metrics.repeated_failures;
  metrics.novel_failures = novel;
}

mkdirSync(resultsDir, { recursive: true });
writeFileSync(
  join(resultsDir, `agentic-${safeName}.json`),
  JSON.stringify({ ...metrics, transcript }, null, 2),
);
console.log(JSON.stringify(metrics));
