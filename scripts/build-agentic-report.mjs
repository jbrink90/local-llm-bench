#!/usr/bin/env node
// Build the agentic dimension report: one self-contained HTML file.
//
// No CDN and no build step, deliberately: this benchmark measures whether a model
// can work with no network, so a report that fetches a chart library at open time
// would contradict the thing it documents. Every visual here is CSS or inline SVG.
//
// Inputs:  caxi-results/agentic-{bugfix,exercism,greenfield}-{model}-r{N}.json
// Output:  caxi-results/agentic-report.html

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const RESULTS = join(import.meta.dirname, '..', 'caxi-results');
const OUT = join(RESULTS, 'agentic-report.html');

// Rows older than this belong to an earlier sweep on a different harness. Mixing
// them silently is how a table stops meaning anything.
const STALE_BEFORE = Date.parse(process.env.AGENTIC_SINCE || '2026-08-20T00:00:00');

const LEG_MAX = { bugfix: 6, exercism: 31, greenfield: 8 };
const LEG_LABEL = {
  bugfix: 'Repair',
  exercism: 'Implement',
  greenfield: 'Build',
};
const LEG_BLURB = {
  bugfix: 'Find one planted defect in an unfamiliar parser and fix it',
  exercism: 'Write a bowling scorer against 31 canonical cases',
  greenfield: 'Build a playable Tetris from nothing, and look at its own screenshot',
};

// Engine and footprint, read from Ollama /api/show rather than guessed from the tag.
// The distinction is load-bearing: the GGUF laguna build degenerated on Apple
// Silicon (189s and 8,129 tokens for a snake game) where its MLX build took 17.8s.
const ENGINE = {
  'muse-glimmer:30b-mlx': { engine: 'MLX', quant: 'nvfp4', gb: 21 },
  'gemma4:26b-mlx-bf16': { engine: 'MLX', quant: 'bf16', gb: 52 },
  'qwen3.5:35b-a3b-coding-nvfp4': { engine: 'MLX', quant: 'nvfp4', gb: 22 },
  'laguna-xs.2:nvfp4': { engine: 'MLX', quant: 'nvfp4', gb: 19 },
  'gpt-oss:20b': { engine: 'llama.cpp', quant: 'MXFP4', gb: 14 },
  'qwen3-coder:30b': { engine: 'llama.cpp', quant: 'Q4_K_M', gb: 19 },
  'qwen3-vl:30b': { engine: 'llama.cpp', quant: 'Q4_K_M', gb: 20 },
  // Remote reference row: served by the provider, so there is no local engine,
  // no quant we chose, and no footprint on this machine.
  'glm-5.3-flash': { engine: 'remote', quant: 'cloud', gb: null },
};

const read = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const med = (v) => {
  const s = v.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

// ---------- collect ----------
const rows = [];
let staleCount = 0;
for (const f of readdirSync(RESULTS)) {
  const m = f.match(/^agentic-(bugfix|exercism|greenfield)-(.+)-r(\d+)\.json$/);
  if (!m) continue;
  const path = join(RESULTS, f);
  if (statSync(path).mtimeMs < STALE_BEFORE) { staleCount++; continue; }
  const d = read(path);
  if (!d) continue;
  const leg = m[1];
  const loop = d.loop || {};
  const rates = loop.rates || {};
  const raw = leg === 'bugfix' ? d.tests_passed : leg === 'exercism' ? d.solved : d.score;
  rows.push({
    mtime: statSync(path).mtimeMs,
    model: d.model || m[2],
    leg,
    run: Number(m[3]),
    pass: d.invalid ? null : !!d.pass,
    invalid: !!d.invalid,
    score: d.invalid ? null : (raw ?? null),
    of: LEG_MAX[leg],
    reason: d.reason || loop.guard_reason || null,
    vision: d.vision_mode || (loop.vision || {}).mode || null,
    testsAdded: d.tests_added ?? null,
    turns: loop.turns ?? null,
    // Bug-fix rows predate the per-leg loop file, so their loop metrics were
    // overwritten by the next leg. Wall time survived in the run log's START/DONE
    // lines; a log-derived duration is flagged so it is never mistaken for
    // instrumented data.
    minutes: loop.wall_ms
      ? +(loop.wall_ms / 60000).toFixed(1)
      : (d.wall_min_from_log ?? null),
    minutesFromLog: !loop.wall_ms && d.wall_min_from_log != null,
    genTok: (loop.tokens || {}).completion ?? null,
    tokS: rates.generate_tok_s ?? null,
    prefill: rates.prefill_share ?? null,
    guard: loop.hit_guard ? (loop.guard_reason || 'guard hit') : null,
    // Stamped by the driver when the model was served over a network instead of
    // from local weights. It decides disclosure, so it is carried per-row.
    remote: loop.remote === true,
  });
}

// ---------- per-model rollup ----------
// Sweep duration from first to last result file: the only measure that survives
// rows whose loop metrics were dropped, and it updates itself on the next run.
function sweepHoursFromLog() {
  const dir = join(import.meta.dirname, '..', 'logs');
  if (!existsSync(dir)) return null;
  const logs = readdirSync(dir)
    .filter((f) => /^agentic-.*\.log$/.test(f))
    .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  for (const { f } of logs) {
    const txt = readFileSync(join(dir, f), 'utf8');
    const times = [...txt.matchAll(/^\s*(\d\d):(\d\d):(\d\d)\s+(?:START|DONE)/gm)]
      .map((m) => +m[1] * 3600 + +m[2] * 60 + +m[3]);
    if (times.length < 2) continue;
    // Legs run in order, so a timestamp lower than its predecessor crossed midnight.
    let span = 0;
    for (let i = 1; i < times.length; i++) {
      const d = times[i] - times[i - 1];
      span += d < 0 ? d + 86400 : d;
    }
    return (span / 3600).toFixed(1);
  }
  return null;
}

const stamps = rows.map((r) => r.mtime).filter(Boolean);
const sweepHours =
  sweepHoursFromLog() ??
  (stamps.length ? ((Math.max(...stamps) - Math.min(...stamps)) / 3.6e6).toFixed(1) : null);

const models = [...new Set(rows.map((r) => r.model))].map((name) => {
  const mine = rows.filter((r) => r.model === name);
  const legs = {};
  for (const leg of Object.keys(LEG_MAX)) {
    const rs = mine.filter((r) => r.leg === leg).sort((a, b) => a.run - b.run);
    legs[leg] = {
      runs: rs,
      passed: rs.filter((r) => r.pass === true).length,
      ratio: med(rs.map((r) => (r.score == null ? null : r.score / r.of))),
    };
  }
  const passed = mine.filter((r) => r.pass === true).length;
  // Perfect on every repeat of a leg is the interesting property, not peak score:
  // three of these models have one catastrophic run among strong ones.
  const flawless = Object.values(legs).filter((l) => l.runs.length && l.passed === l.runs.length).length;
  const isRemote = mine.some((r) => r.remote === true || r.loop?.remote === true);
  return {
    name,
    ...(ENGINE[name] || { engine: '?', quant: '?', gb: null }),
    vision: mine.find((r) => r.vision)?.vision || null,
    legs,
    total: mine.length,
    passed,
    flawless,
    isRemote,
    medMin: med(mine.map((r) => r.minutes)),
    worstMin: Math.max(...mine.map((r) => r.minutes || 0)),
    tokS: med(mine.map((r) => r.tokS)),
    totalTok: mine.reduce((a, r) => a + (r.genTok || 0), 0),
    totalMin: mine.reduce((a, r) => a + (r.minutes || 0), 0),
  };
}).sort((a, b) => b.passed - a.passed
  || b.flawless - a.flawless
  || (b.legs.exercism.ratio || 0) - (a.legs.exercism.ratio || 0)
  || a.medMin - b.medMin);

// What a model costs to get its result is half the airplane question: a laptop on
// battery pays for every minute and every token. Scale each against the cheapest
// model in the field so the bars mean "relative to the best case here".
const bestRate = Math.max(...models.map((m) => m.passed / m.total));
const baseCandidates = models.filter((m) => m.passed / m.total === bestRate && m.totalMin > 0);
const baseline = baseCandidates.reduce((a, b) => (a.totalMin <= b.totalMin ? a : b));
const minTime = baseline.totalMin;
const minTok = baseline.totalTok;
for (const m of models) {
  m.timeVsBest = m.totalMin && minTime ? m.totalMin / minTime : null;
  m.tokVsBest = m.totalTok && minTok ? m.totalTok / minTok : null;
}
const maxTime = Math.max(...models.map((m) => m.totalMin));
const maxTok = Math.max(...models.map((m) => m.totalTok));

// ---------- notable moments, derived from the data not narrated ----------
const notes = [];
const modded = rows.filter((r) => (r.reason || '').includes('suite'));
if (modded.length) {
  notes.push({
    icon: '🪓',
    title: 'Deleted the tests instead of fixing the bug',
    body: `${modded.length} run(s) shipped a suite with assertions removed — `
      + `${[...new Set(modded.map((r) => r.model))].join(', ')}. `
      + `The gate scores the shipped file by name, so going green by deletion is not a pass.`,
  });
}
const guards = rows.filter((r) => r.guard);
if (guards.length) {
  const worst = guards.sort((a, b) => (b.minutes || 0) - (a.minutes || 0))[0];
  notes.push({
    icon: '🔥',
    title: 'The leg that ate three and a half hours',
    body: `${worst.model} ran ${worst.turns} turns and ${(worst.genTok || 0).toLocaleString()} tokens `
      + `over ${worst.minutes} minutes on a single ${LEG_LABEL[worst.leg].toLowerCase()} leg, `
      + `scoring ${worst.score}/${worst.of}. Wall-clock and token budgets now stop this at 40 minutes.`,
  });
}
const added = rows.filter((r) => r.testsAdded);
if (added.length) {
  notes.push({
    icon: '✍️',
    title: 'One model wrote its own tests',
    body: `${added.map((r) => r.model)[0]} fixed the defect and added coverage for boolean operators, `
      + `ternaries, equality and member access. An earlier version of the gate counted tests and `
      + `failed it for that. Additions are now reported, never scored.`,
  });
}
const inv = rows.filter((r) => r.invalid);
if (inv.length) {
  notes.push({
    icon: '⏱️',
    title: 'Harness failures are not model failures',
    body: `${inv.length} run(s) died on the request ceiling and are recorded as INVALID with a null `
      + `verdict, never a zero. A false zero is worse than a gap in the table.`,
  });
}

const localModels = models.filter((m) => !m.isRemote);
const remoteModels = models.filter((m) => m.isRemote);
const champ = localModels[0];
const legRows = Object.keys(LEG_MAX);

// ---------- render ----------
const meter = (ratio, pass) => {
  if (ratio == null) return '<span class="pill pill-inv">n/a</span>';
  const pct = Math.round(ratio * 100);
  const cls = pass ? 'good' : pct >= 60 ? 'mid' : 'bad';
  return `<span class="meter"><i class="${cls}" style="width:${Math.max(3, pct)}%"></i></span>`;
};

const spark = (runs) => {
  if (!runs.length) return '';
  const w = 54, h = 18;
  const pts = runs.map((r, i) => {
    const x = runs.length === 1 ? w / 2 : (i / (runs.length - 1)) * (w - 4) + 2;
    const v = r.score == null ? 0 : r.score / r.of;
    return `${x.toFixed(1)},${(h - 2 - v * (h - 4)).toFixed(1)}`;
  });
  const dots = runs.map((r, i) => {
    const x = runs.length === 1 ? w / 2 : (i / (runs.length - 1)) * (w - 4) + 2;
    const v = r.score == null ? 0 : r.score / r.of;
    const c = r.invalid ? 'var(--warn)' : r.pass ? 'var(--ok)' : 'var(--bad)';
    return `<circle cx="${x.toFixed(1)}" cy="${(h - 2 - v * (h - 4)).toFixed(1)}" r="2.6" fill="${c}"/>`;
  }).join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`
    + `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--line2)" stroke-width="1.4"/>${dots}</svg>`;
};

const card = (m, i) => {
  const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}`;
  const perfect = m.passed === m.total;
  return `<article class="card${perfect ? ' champ' : ''}">
  <header>
    <span class="rank">${medal}</span>
    <div class="who">
      <h3>${m.name}</h3>
      <div class="tags">
        <span class="tag ${m.engine === 'MLX' ? 'mlx' : 'gguf'}">${m.engine} · ${m.quant}</span>
        ${m.gb ? `<span class="tag">${m.gb} GB</span>` : ''}
        ${m.vision ? `<span class="tag ${m.vision === 'native' ? 'eye' : ''}">${m.vision === 'native' ? '👁 native vision' : '🤝 vision sidecar'}</span>` : ''}
      </div>
    </div>
    <div class="tally"><b>${m.passed}</b><span>/${m.total} legs</span></div>
  </header>
  <div class="legs">
    ${legRows.map((leg) => {
    const L = m.legs[leg];
    const scores = L.runs.map((r) => (r.invalid ? 'INV' : `${r.score}`)).join(' · ');
    return `<div class="legrow">
        <span class="legname">${LEG_LABEL[leg]}</span>
        ${meter(L.ratio, L.passed === L.runs.length && L.runs.length > 0)}
        <span class="legscore">${scores || '—'}<em>/${LEG_MAX[leg]}</em></span>
        ${spark(L.runs)}
      </div>`;
  }).join('')}
  </div>
  <footer>
    <div class="cost">
      <span class="clabel">time</span>
      <span class="cbar"><i class="t" style="width:${Math.max(2, (m.totalMin / maxTime) * 100).toFixed(0)}%"></i></span>
      <span class="cval">${(m.totalMin / 60).toFixed(1)}h${m.timeVsBest > 1.15 ? ` <em>${m.timeVsBest.toFixed(1)}×</em>` : ''}</span>
    </div>
    <div class="cost">
      <span class="clabel">tokens</span>
      <span class="cbar"><i class="k" style="width:${Math.max(2, (m.totalTok / maxTok) * 100).toFixed(0)}%"></i></span>
      <span class="cval">${(m.totalTok / 1000).toFixed(0)}k${m.tokVsBest > 1.15 ? ` <em>${m.tokVsBest.toFixed(1)}×</em>` : ''}</span>
    </div>
    <div class="costnote">${m.medMin ?? '?'} min median leg · worst ${m.worstMin.toFixed(0)} min${m.tokS ? ` · ${m.tokS} tok/s` : ''}</div>
  </footer>
</article>`;
};

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Can a local model actually code? — agentic benchmark</title>
<style>
:root{
  --bg:#0b0d12; --panel:#12151d; --panel2:#171b25; --fg:#eef1f6; --dim:#8f98a9;
  --line:#232936; --line2:#39435a; --ok:#42c07a; --bad:#e8595b; --warn:#e3a83a;
  --accent:#6aa9ff; --accent2:#b98cff;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font:15px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:3rem 1.5rem 5rem}
.hero{text-align:center;margin-bottom:3rem}
.kicker{font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
h1{font-size:clamp(1.9rem,4.5vw,3rem);line-height:1.1;margin:.5rem 0 .75rem;
  background:linear-gradient(100deg,var(--fg),var(--accent) 60%,var(--accent2));
  -webkit-background-clip:text;background-clip:text;color:transparent}
.lede{color:var(--dim);max-width:62ch;margin:0 auto 1.75rem}
.stats{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;
  padding:.6rem 1rem;min-width:92px}
.stat b{display:block;font-size:1.35rem;line-height:1.2}
.stat span{font-size:.72rem;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}

.winner{background:linear-gradient(150deg,rgba(106,169,255,.14),rgba(185,140,255,.08));
  border:1px solid var(--line2);border-radius:16px;padding:1.5rem 1.75rem;margin:0 0 2.5rem;
  display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap}
.winner .crown{font-size:2.5rem;line-height:1}
.remote-note{margin:1rem 0 0;padding:.85rem 1rem;border-left:3px solid var(--warn,#e0a33e);
  background:rgba(224,163,62,.07);border-radius:0 6px 6px 0;color:var(--dim);font-size:.88rem;line-height:1.65}
.remote-note b{color:var(--warn,#e0a33e)}
.winner h2{margin:0 0 .2rem;font-size:1.25rem}
.winner p{margin:0;color:var(--dim);font-size:.92rem}

h2.sec{font-size:1.05rem;letter-spacing:.02em;margin:2.75rem 0 .35rem}
p.secsub{color:var(--dim);font-size:.88rem;margin:0 0 1.25rem}

.legend{display:grid;gap:.3rem;color:var(--dim);font-size:.85rem;
  border-left:2px solid var(--line2);padding:.45rem 0 .45rem .95rem;margin-bottom:1.5rem}
.legend b{color:var(--fg);font-weight:600;display:inline-block;min-width:5.4rem}

.grid{display:grid;gap:1rem}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:1.1rem 1.25rem}
.card.champ{border-color:var(--ok);box-shadow:0 0 0 1px rgba(66,192,122,.25),0 8px 30px -18px rgba(66,192,122,.6)}
.card header{display:flex;gap:.9rem;align-items:flex-start;margin-bottom:.9rem}
.rank{font-size:1.5rem;line-height:1.2;min-width:1.6rem;text-align:center;color:var(--dim)}
.who{flex:1;min-width:0}
.who h3{margin:0;font-size:1.02rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.tags{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.35rem}
.tag{font-size:.7rem;color:var(--dim);border:1px solid var(--line);border-radius:20px;
  padding:.1rem .55rem;white-space:nowrap}
.tag.mlx{color:var(--accent);border-color:rgba(106,169,255,.4)}
.tag.gguf{color:var(--dim)}
.tag.eye{color:var(--accent2);border-color:rgba(185,140,255,.4)}
.tally{text-align:right;white-space:nowrap}
.tally b{font-size:1.5rem}
.tally span{color:var(--dim);font-size:.8rem}

.legs{display:grid;gap:.45rem}
.legrow{display:grid;grid-template-columns:5.6rem 1fr 6.2rem 54px;gap:.7rem;align-items:center;
  font-size:.86rem}
.legname{color:var(--dim)}
.meter{display:block;height:.5rem;background:var(--panel2);border-radius:99px;overflow:hidden}
.meter i{display:block;height:100%;border-radius:99px}
.meter i.good{background:linear-gradient(90deg,var(--ok),#7fe0a8)}
.meter i.mid{background:linear-gradient(90deg,var(--warn),#f0c777)}
.meter i.bad{background:linear-gradient(90deg,var(--bad),#f08d8e)}
.legscore{font-variant-numeric:tabular-nums;text-align:right;font-size:.82rem}
.legscore em{color:var(--dim);font-style:normal;font-size:.74rem}
.spark{display:block}
.card footer{margin-top:.9rem;padding-top:.7rem;border-top:1px solid var(--line);
  color:var(--dim);font-size:.78rem}
.cost{display:grid;grid-template-columns:3.1rem 1fr 5.4rem;gap:.5rem;align-items:center;
  margin-bottom:.25rem}
.clabel{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}
.cbar{display:block;height:.38rem;background:var(--panel2);border-radius:99px;overflow:hidden}
.cbar i{display:block;height:100%;border-radius:99px;opacity:.85}
.cbar i.t{background:linear-gradient(90deg,#5b8def,#8fb6ff)}
.cbar i.k{background:linear-gradient(90deg,#b06fd8,#d2a3f0)}
.cval{text-align:right;font-variant-numeric:tabular-nums;font-size:.76rem;color:var(--fg)}
.cval em{font-style:normal;color:var(--warn);font-size:.72rem}
.costnote{margin-top:.4rem;font-size:.74rem}

.notes{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.note{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:1rem 1.1rem}
.note .ic{font-size:1.35rem}
.note h4{margin:.35rem 0 .3rem;font-size:.95rem}
.note p{margin:0;color:var(--dim);font-size:.85rem}

details.raw{margin-top:2.5rem;background:var(--panel);border:1px solid var(--line);border-radius:12px}
details.raw summary{cursor:pointer;padding:.9rem 1.1rem;font-weight:600;font-size:.92rem}
details.raw summary:hover{color:var(--accent)}
.rawbody{padding:0 1.1rem 1.1rem}
.controls{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin:.5rem 0 .9rem}
input,select{background:var(--panel2);color:var(--fg);border:1px solid var(--line);
  border-radius:7px;padding:.4rem .6rem;font:inherit;font-size:.85rem}
label.chk{font-size:.82rem;color:var(--dim);display:flex;align-items:center;gap:.3rem}
table{border-collapse:collapse;width:100%;font-size:.83rem}
th,td{text-align:left;padding:.4rem .55rem;border-bottom:1px solid var(--line);white-space:nowrap}
th{position:sticky;top:0;background:var(--panel2);cursor:pointer;user-select:none;font-size:.76rem;
  text-transform:uppercase;letter-spacing:.05em;color:var(--dim)}
th:hover{color:var(--accent)}
th.asc::after{content:' ▲'}th.desc::after{content:' ▼'}
td.num{text-align:right;font-variant-numeric:tabular-nums}
tbody tr:hover td{background:var(--panel2)}
.pill{font-size:.72rem;padding:.1rem .45rem;border-radius:20px;font-weight:600}
.pill-ok{color:var(--ok);background:rgba(66,192,122,.12)}
.pill-bad{color:var(--bad);background:rgba(232,89,91,.12)}
.pill-inv{color:var(--warn);background:rgba(227,168,58,.12)}
.dim{color:var(--dim)}
footer.foot{margin-top:3rem;color:var(--dim);font-size:.8rem;text-align:center;line-height:1.8}
footer.foot a{color:#93c5fd;text-decoration:underline;text-underline-offset:2px}
footer.foot a:hover{color:#bfdbfe}
@media(min-width:780px){.grid{grid-template-columns:1fr 1fr}.card.champ{grid-column:1/-1}}
</style></head><body><div class="wrap">

<div class="hero">
  <div class="kicker">local-llm-bench · agentic dimension</div>
  <h1>Can a local model actually code<br>with the wifi off?</h1>
  <p class="lede">Seven models on one laptop, no network, driving a real tool loop:
  read files, run commands, read the failure, try again. Three tasks, three attempts each,
  and the only thing that counts is whether the code works at the end.</p>
  <div class="stats">
    <div class="stat"><b>${rows.length}</b><span>legs run</span></div>
    <div class="stat"><b>${models.length}</b><span>models</span></div>
    ${sweepHours ? `<div class="stat"><b>${sweepHours}<span style="font-size:.9rem">h</span></b><span>wall clock</span></div>` : ''}
    <div class="stat"><b>${(rows.reduce((a, r) => a + (r.genTok || 0), 0) / 1e6).toFixed(1)}M</b><span>tokens burned</span></div>
    <div class="stat"><b>${rows.filter((r) => r.pass === true).length}</b><span>legs passed</span></div>
  </div>
</div>

<div class="winner">
  <div class="crown">👑</div>
  <div style="flex:1;min-width:220px">
    <h2>${champ.name} takes it — ${champ.passed}/${champ.total} legs</h2>
    <p>${champ.vision === 'native' ? 'The only model that passed everything, and it did it looking at its own screenshots rather than borrowing a second model for eyes.' : 'Clean sweep across repair, implementation and building from nothing.'}
    ${champ.tokS ? `Slowest generator in the field at ${champ.tokS} tok/s — and it never once thrashed.` : ''}</p>
  </div>
</div>
${remoteModels.length ? `<div class="remote-note">
  <b>Not a local model:</b> ${remoteModels.map((m) => m.name).join(', ')} ran the same three legs
  through a hosted API, so ${remoteModels.length > 1 ? 'they have' : 'it has'} no weights on this
  machine and cannot run offline — the whole point of the local field above.
  ${remoteModels.map((m) => `${m.name} passed ${m.passed}/${m.total}`).join('; ')}.
  Read it as a capability ceiling to measure the local models against, not as a competitor:
  its speed is someone else's datacenter, and its cost is tokens billed rather than watts on a laptop.
</div>` : ''}

<h2 class="sec">The field</h2>
<p class="secsub">Ranked by legs passed, then by how many tasks were clean on <em>every</em> attempt.
Consistency separates these models far more than peak score does.</p>
<div class="legend">
  <span><b>cost ×</b> time and tokens relative to <b>${baseline.name}</b> — the cheapest model that scored ${baseline.passed}/${baseline.total}. Anchoring to the outright cheapest would reward failing fast.</span>
  <span><b>Repair</b> ${LEG_BLURB.bugfix}</span>
  <span><b>Implement</b> ${LEG_BLURB.exercism}</span>
  <span><b>Build</b> ${LEG_BLURB.greenfield}</span>
</div>
<div class="grid">
${models.map(card).join('\n')}
</div>

${notes.length ? `<h2 class="sec">What actually happened out there</h2>
<p class="secsub">Pulled from the run data, not the highlights reel.</p>
<div class="notes">
${notes.map((n) => `<div class="note"><div class="ic">${n.icon}</div><h4>${n.title}</h4><p>${n.body}</p></div>`).join('\n')}
</div>` : ''}

<details class="raw">
<summary>Every leg, sortable — ${rows.length} rows</summary>
<div class="rawbody">
  <div class="controls">
    <input id="q" placeholder="filter model, task, note…" size="26">
    <select id="legf"><option value="">all tasks</option>
      ${legRows.map((l) => `<option value="${l}">${LEG_LABEL[l]}</option>`).join('')}</select>
    <label class="chk"><input type="checkbox" id="onlyfail"> problems only</label>
    <span class="dim" id="count"></span>
  </div>
  <table id="t"><thead><tr>
    <th data-k="model">model</th><th data-k="leg">task</th><th data-k="run" class="num">try</th>
    <th data-k="verdict">verdict</th><th data-k="score" class="num">score</th>
    <th data-k="vision">vision</th><th data-k="turns" class="num">turns</th>
    <th data-k="minutes" class="num">min</th><th data-k="genTok" class="num">tokens</th>
    <th data-k="tokS" class="num">tok/s</th><th data-k="prefill" class="num">prefill</th>
    <th data-k="testsAdded" class="num">+tests</th><th data-k="reason">note</th>
  </tr></thead><tbody></tbody></table>
</div>
</details>

<footer class="foot">
  The artifact is the only gate — loop metrics are reported, never used to pass or fail.
  On the first smoke run a model called <code>done()</code> claiming "operator precedence logic
  fixed" having written nothing at all.<br>
  <b>INVALID</b> means the harness failed, not the model.
  ${staleCount ? `${staleCount} row(s) from an earlier sweep excluded. ` : ''}
  Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}<br>
  <b>Harness</b> not Aider, not OpenHands, not Claude Code — a purpose-built
  <a href="https://github.com/NightOwlCoder/local-llm-bench/blob/main/drivers/agentic.mjs">459-line agent loop</a>
  written for this benchmark. Off-the-shelf agents ship their own system prompts, tool descriptions and
  context strategies, so comparing two models inside one of them measures the agent as much as the model.
  Each model here is handed a real working directory and six tools, then left to work: it reads files, writes files,
  runs commands, looks at screenshots, and decides when it is done. Nothing is scored from what the model
  <em>says</em> — the verdict comes from running the project's own test suite in the directory the model edited.
  These scores describe a <em>minimal</em> loop; a model may behave differently inside a forty-tool IDE agent.
  <br>Ollama <code>/api/chat</code> tool calling, non-streaming ·
  tools: list_dir, read_file, write_file, run_command, screenshot, done ·
  each command in its own process group, 120s cap · 15-min per-request ceiling ·
  40-min / 250k-token leg budget · fresh fixture copy per attempt, no network
  <br><b>Context</b> 32k ceiling. History is trimmed in whole 12-message blocks rather than one message per turn,
  because Ollama's KV prefix cache only survives when the front of the prompt is byte-identical — a per-turn
  slide cut cache reuse from 12,476 tokens to 693. Block trimming gave a median of 7 cache invalidations per leg,
  and a median prefill share of 8.5% of wall time. No summarization of dropped turns: that would score the
  summarizer too. <a href="https://github.com/NightOwlCoder/local-llm-bench/blob/main/docs/HARNESS.md">Full harness notes</a><br>
  <b>Machine</b> Apple M4 Max, 128 GB unified · macOS · Ollama 0.32.9 (MLX engine for safetensors, llama.cpp for GGUF)
</footer>

<script>
const ROWS = ${JSON.stringify(rows.map(({ mtime, ...r }) => r))};
const LABEL = ${JSON.stringify(LEG_LABEL)};
let key = 'model', dir = 1;

function verdict(r){
  if (r.invalid) return '<span class="pill pill-inv">invalid</span>';
  return r.pass ? '<span class="pill pill-ok">pass</span>' : '<span class="pill pill-bad">fail</span>';
}
function scoreCell(r){
  if (r.score == null) return '<span class="dim">—</span>';
  return r.score + '<span class="dim">/' + r.of + '</span>';
}
function render(){
  const q = document.getElementById('q').value.toLowerCase();
  const leg = document.getElementById('legf').value;
  const onlyfail = document.getElementById('onlyfail').checked;
  const view = ROWS.filter(function(r){
    return (!leg || r.leg === leg)
      && (!onlyfail || r.pass !== true)
      && (!q || (r.model + ' ' + LABEL[r.leg] + ' ' + (r.reason||'') + ' ' + (r.guard||'')).toLowerCase().indexOf(q) >= 0);
  });
  view.sort(function(a,b){
    var x = a[key], y = b[key];
    if (key === 'verdict'){ x = a.invalid?2:a.pass?0:1; y = b.invalid?2:b.pass?0:1; }
    // Raw score is not comparable across tasks with different maxima; sort the ratio.
    if (key === 'score'){ x = a.score==null?-1:a.score/a.of; y = b.score==null?-1:b.score/b.of; }
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
  });
  document.querySelector('#t tbody').innerHTML = view.map(function(r){
    return '<tr><td>' + r.model + '</td><td>' + LABEL[r.leg] + '</td>'
      + '<td class="num">' + r.run + '</td><td>' + verdict(r) + '</td>'
      + '<td class="num">' + scoreCell(r) + '</td>'
      + '<td>' + (r.vision || '<span class="dim">—</span>') + '</td>'
      + '<td class="num">' + (r.turns == null ? '' : r.turns) + '</td>'
      + '<td class="num">' + (r.minutes == null ? '' : r.minutes + (r.minutesFromLog ? '<span class="dim" title="recovered from the run log: loop metrics for this leg were overwritten">*</span>' : '')) + '</td>'
      + '<td class="num">' + (r.genTok ? r.genTok.toLocaleString() : '') + '</td>'
      + '<td class="num">' + (r.tokS == null ? '' : r.tokS) + '</td>'
      + '<td class="num">' + (r.prefill == null ? '' : r.prefill) + '</td>'
      + '<td class="num">' + (r.testsAdded || '') + '</td>'
      + '<td class="dim">' + (r.guard || r.reason || '') + '</td></tr>';
  }).join('');
  document.getElementById('count').textContent = view.length + ' of ' + ROWS.length;
}
document.querySelectorAll('th').forEach(function(th){
  th.addEventListener('click', function(){
    dir = (th.dataset.k === key) ? -dir : 1;
    key = th.dataset.k;
    document.querySelectorAll('th').forEach(function(o){ o.classList.remove('asc','desc'); });
    th.classList.add(dir === 1 ? 'asc' : 'desc');
    render();
  });
});
['q','legf','onlyfail'].forEach(function(id){
  document.getElementById(id).addEventListener('input', render);
});
render();
</script>
</div></body></html>`;

writeFileSync(OUT, html);
console.log(`Wrote ${OUT}`);
console.log(`  ${rows.length} legs · ${localModels.length} local + ${remoteModels.length} remote · local winner ${champ.name} (${champ.passed}/${champ.total})`);
