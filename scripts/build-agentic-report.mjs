#!/usr/bin/env node
// Build a self-contained HTML report for the agentic dimension.
//
// Single file, no CDN, no build step: this repo's whole premise is that a run
// works with no network, so a report that fetches a table library at open time
// would contradict the thing being measured. Sort and filter are ~40 lines of
// vanilla JS; the alternative buys nothing.
//
// Inputs:  caxi-results/agentic-{bugfix,exercism,greenfield}-{model}-r{N}.json
// Output:  caxi-results/agentic-report.html

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const BENCH_DIR = join(import.meta.dirname, '..');
const RESULTS = join(BENCH_DIR, 'caxi-results');
const OUT = join(RESULTS, 'agentic-report.html');

// Rows older than this belong to an earlier sweep on a different harness. Mixing
// them silently is how a table stops meaning anything; see the laguna GGUF rows.
const STALE_BEFORE = Date.parse(process.env.AGENTIC_SINCE || '2026-08-20T00:00:00');

const LEGS = { bugfix: 6, exercism: 31, greenfield: 8 };

function read(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

const rows = [];
const stale = [];
for (const f of readdirSync(RESULTS)) {
  const m = f.match(/^agentic-(bugfix|exercism|greenfield)-(.+)-r(\d+)\.json$/);
  if (!m) continue;
  const [, leg, model, run] = m;
  const path = join(RESULTS, f);
  if (statSync(path).mtimeMs < STALE_BEFORE) { stale.push(f); continue; }
  const d = read(path);
  if (!d) continue;
  const loop = d.loop || {};
  const rates = loop.rates || {};
  const scored = leg === 'bugfix' ? d.tests_passed
    : leg === 'exercism' ? d.solved
    : d.score;
  rows.push({
    model: d.model || model,
    leg,
    run: Number(run),
    // null verdict means the harness failed, not the model. Kept distinct from
    // false so a timeout never reads as a zero.
    pass: d.invalid ? null : d.pass,
    invalid: !!d.invalid,
    score: d.invalid ? null : (scored ?? null),
    of: LEGS[leg],
    reason: d.reason || loop.guard_reason || null,
    vision: d.vision_mode || (loop.vision || {}).mode || null,
    tests_added: d.tests_added ?? null,
    turns: loop.turns ?? null,
    minutes: loop.wall_ms ? +(loop.wall_ms / 60000).toFixed(1) : null,
    gen_tok: (loop.tokens || {}).completion ?? null,
    gen_tok_s: rates.generate_tok_s ?? null,
    prefill_share: rates.prefill_share ?? null,
    guard: loop.hit_guard ? (loop.guard_reason || 'guard hit') : null,
  });
}

rows.sort((a, b) => a.model.localeCompare(b.model) || a.leg.localeCompare(b.leg) || a.run - b.run);

// Per-model summary. Median rather than mean: one runaway leg (741,621 tokens
// over 207 minutes) would drag a mean and misrepresent the typical run.
const med = (v) => {
  const s = v.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const byModel = new Map();
for (const r of rows) {
  if (!byModel.has(r.model)) byModel.set(r.model, []);
  byModel.get(r.model).push(r);
}


const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Agentic dimension — local model report</title>
<style>
:root { color-scheme: dark; --bg:#0f1115; --fg:#e6e6e6; --dim:#8b93a1; --line:#262b35;
        --ok:#3ba55d; --bad:#d64545; --warn:#d99b28; --accent:#5b9dd9; }
* { box-sizing: border-box; }
body { margin:0; padding:2rem; background:var(--bg); color:var(--fg);
       font:14px/1.5 ui-sans-serif,-apple-system,"Segoe UI",sans-serif; }
h1 { font-size:1.4rem; margin:0 0 .25rem; }
p.sub { color:var(--dim); margin:0 0 1.5rem; }
table { border-collapse:collapse; width:100%; margin-bottom:2.5rem; }
th, td { text-align:left; padding:.45rem .6rem; border-bottom:1px solid var(--line); }
th { position:sticky; top:0; background:#161a21; cursor:pointer; user-select:none;
     font-weight:600; white-space:nowrap; }
th:hover { color:var(--accent); }
th::after { content:''; color:var(--dim); }
th.asc::after { content:' ▲'; }
th.desc::after { content:' ▼'; }
td.num { text-align:right; font-variant-numeric:tabular-nums; }
tr:hover td { background:#151922; }
.pass { color:var(--ok); font-weight:600; }
.fail { color:var(--bad); font-weight:600; }
.inv  { color:var(--warn); font-weight:600; }
.dim  { color:var(--dim); }
.bar { display:inline-block; height:.55rem; border-radius:2px; background:var(--accent);
       vertical-align:middle; margin-right:.4rem; }
.controls { display:flex; gap:.75rem; align-items:center; margin-bottom:.75rem; flex-wrap:wrap; }
input, select { background:#161a21; color:var(--fg); border:1px solid var(--line);
                border-radius:4px; padding:.35rem .5rem; font:inherit; }
.badge { font-size:.75rem; padding:.1rem .4rem; border:1px solid var(--line);
         border-radius:3px; color:var(--dim); }
.note { color:var(--dim); font-size:.85rem; border-left:2px solid var(--line);
        padding-left:.75rem; margin:1rem 0 2rem; }
</style></head><body>

<h1>Agentic dimension — local coding agents</h1>
<p class="sub">Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} ·
${rows.length} legs · ${byModel.size} models · localhost only, no network during runs</p>

<div class="note">
The artifact is the only gate. Loop metrics (turns, tokens, throughput) are reported
and never used to pass or fail: on the first smoke run a model called <code>done()</code>
reporting "operator precedence logic fixed" having written nothing at all.
<strong>INVALID</strong> means the harness failed, not the model — recorded as
<code>pass=null</code> so a timeout never reads as a zero.
${stale.length ? `<br>${stale.length} row(s) from an earlier sweep excluded.` : ''}
</div>

<h2>Per-leg results</h2>
<div class="controls">
  <input id="q" placeholder="filter model or leg…" size="28">
  <select id="legf">
    <option value="">all legs</option>
    <option value="bugfix">bugfix</option>
    <option value="exercism">exercism</option>
    <option value="greenfield">greenfield</option>
  </select>
  <label class="badge"><input type="checkbox" id="onlyfail"> problems only</label>
  <span class="dim" id="count"></span>
</div>
<table id="t">
<thead><tr>
  <th data-k="model">model</th>
  <th data-k="leg">leg</th>
  <th data-k="run" class="num">run</th>
  <th data-k="verdict">verdict</th>
  <th data-k="score" class="num">score</th>
  <th data-k="vision">vision</th>
  <th data-k="turns" class="num">turns</th>
  <th data-k="minutes" class="num">min</th>
  <th data-k="gen_tok" class="num">gen tok</th>
  <th data-k="gen_tok_s" class="num">tok/s</th>
  <th data-k="prefill_share" class="num">prefill</th>
  <th data-k="tests_added" class="num">+tests</th>
  <th data-k="reason">note</th>
</tr></thead>
<tbody></tbody>
</table>

<script>
const ROWS = ${JSON.stringify(rows)};
const LEGS = ${JSON.stringify(LEGS)};
let sortKey = 'model', sortDir = 1;

const verdict = (r) =>
  r.invalid ? '<span class="inv">INVALID</span>'
  : r.pass ? '<span class="pass">pass</span>'
  : '<span class="fail">fail</span>';

// Score cell doubles as a bar so the eye finds the spread without reading numbers.
const scoreCell = (r) => {
  if (r.score == null) return '<span class="dim">—</span>';
  const pct = Math.round((r.score / r.of) * 100);
  return '<span class="bar" style="width:' + Math.max(2, pct * 0.42) + 'px"></span>' +
         r.score + '/' + r.of;
};

function render() {
  const q = document.getElementById('q').value.toLowerCase();
  const leg = document.getElementById('legf').value;
  const onlyfail = document.getElementById('onlyfail').checked;
  let view = ROWS.filter((r) =>
    (!leg || r.leg === leg) &&
    (!onlyfail || r.pass !== true) &&
    (!q || (r.model + ' ' + r.leg + ' ' + (r.reason || '')).toLowerCase().includes(q)));

  view.sort((a, b) => {
    let x = a[sortKey], y = b[sortKey];
    if (sortKey === 'verdict') { x = a.invalid ? 2 : a.pass ? 0 : 1; y = b.invalid ? 2 : b.pass ? 0 : 1; }
    // Raw score is not comparable across legs with different maxima; sort the ratio.
    if (sortKey === 'score') { x = a.score == null ? -1 : a.score / a.of; y = b.score == null ? -1 : b.score / b.of; }
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sortDir;
  });

  document.querySelector('#t tbody').innerHTML = view.map((r) => \`<tr>
    <td>\${r.model}</td><td>\${r.leg}</td><td class="num">\${r.run}</td>
    <td>\${verdict(r)}</td><td class="num">\${scoreCell(r)}</td>
    <td>\${r.vision || '<span class="dim">—</span>'}</td>
    <td class="num">\${r.turns ?? ''}</td><td class="num">\${r.minutes ?? ''}</td>
    <td class="num">\${r.gen_tok ? r.gen_tok.toLocaleString() : ''}</td>
    <td class="num">\${r.gen_tok_s ?? ''}</td>
    <td class="num">\${r.prefill_share ?? ''}</td>
    <td class="num">\${r.tests_added || ''}</td>
    <td class="dim">\${r.guard || r.reason || ''}</td></tr>\`).join('');
  document.getElementById('count').textContent = view.length + ' of ' + ROWS.length + ' shown';
}

document.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
  const k = th.dataset.k;
  sortDir = (k === sortKey) ? -sortDir : 1;
  sortKey = k;
  document.querySelectorAll('th').forEach((o) => o.classList.remove('asc', 'desc'));
  th.classList.add(sortDir === 1 ? 'asc' : 'desc');
  render();
}));
['q', 'legf', 'onlyfail'].forEach((id) =>
  document.getElementById(id).addEventListener('input', render));
render();
</script>
</body></html>`;

writeFileSync(OUT, html);
console.log(`Wrote ${OUT}`);
console.log(`  ${rows.length} legs, ${byModel.size} models${stale.length ? `, ${stale.length} stale excluded` : ''}`);
