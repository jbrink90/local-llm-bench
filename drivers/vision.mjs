#!/usr/bin/env node
// Vision step for the agentic greenfield variant.
//
// Renders an HTML artifact and returns what the model can "see". Two paths:
//
//   native  — the coder model has vision; hand it the screenshot directly
//   sidecar — the coder is blind; a local vision model describes the screenshot
//             and the coder receives that text
//
// The sidecar is not handicapped by a fudge factor. It costs a second model load
// and an extra round trip, and that real cost lands in the wall-clock and token
// metrics on its own. See docs/SPEC_AGENTIC.md.

import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const SIDECAR_MODEL = process.env.AGENTIC_SIDECAR_MODEL || 'qwen3-vl:30b';

// Asking the sidecar to judge quality would make it the grader. Its job is to
// report what is on screen so the coder can decide what to fix.
const DESCRIBE_PROMPT =
  'Describe this screenshot of a web app precisely and literally: layout, visible ' +
  'text, controls, colors, and anything that looks broken, blank, overlapping, or ' +
  'unstyled. Do not rate quality or suggest improvements.';

export async function screenshot(htmlPath, pngPath) {
  const browser = await chromium.launch();
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: 15_000 });
    await page.waitForTimeout(600); // let entry animations settle
    // Force a composited frame before capturing. A freshly extracted headless shell
    // was observed returning a screenshot with the canvas layer blank while
    // getImageData showed the pixels present — a model told its game renders nothing
    // would go "fix" working code.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: pngPath, fullPage: false });
  } finally {
    await browser.close();
  }
  return { pngPath, errors: errors.slice(0, 5) };
}

export async function describeViaSidecar(pngPath) {
  const img = readFileSync(pngPath).toString('base64');
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: SIDECAR_MODEL,
      stream: false,
      messages: [{ role: 'user', content: DESCRIBE_PROMPT, images: [img] }],
    }),
  });
  if (!res.ok) throw new Error(`sidecar ${SIDECAR_MODEL} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    text: data.message?.content || '',
    tokens: {
      prompt: data.prompt_eval_count || 0,
      completion: data.eval_count || 0,
    },
  };
}

export function imageForNative(pngPath) {
  return readFileSync(pngPath).toString('base64');
}
