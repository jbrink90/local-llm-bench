// Ollama HTTP client with an explicit, generous timeout.
//
// node's global fetch (undici) enforces a 300s headersTimeout that cannot be
// raised per-request. A local 30B model reasoning over a large tool surface can
// take longer than that to first token, and when it does the request dies with a
// bare "fetch failed" — indistinguishable, in the results, from the model failing
// the task. Six legs of the 2026-08-14 run were lost that way at exactly 5m1s.
//
// node:http has no such cap, so the only limit is the one we choose.

import http from 'node:http';
import { URL } from 'node:url';

// A slow model is not a broken model. This exists to catch a genuinely wedged
// request, not to bound how long careful work may take.
const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 1_800_000);

export function ollamaPost(baseUrl, path, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const url = new URL(path, baseUrl);
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`ollama ${res.statusCode}: ${data.slice(0, 400)}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`ollama returned non-JSON: ${data.slice(0, 200)}`));
          }
        });
      },
    );

    // Idle-socket timeout: fires only when no bytes move at all, so a long
    // generation that is still streaming is never cut off.
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`ollama request idle for ${timeoutMs}ms — no data`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
