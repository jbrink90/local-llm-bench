// Run a model-issued shell command under containment.
//
// The model under test writes the code that runs here, and broken code is valid
// benchmark output — one generated parser looped forever at end-of-input. The
// harness must be able to score that without the machine paying for it.
//
// execFileSync could not: on timeout Node terminates /bin/sh, but the
// npm -> node --test -> test-file descendants survive, get reparented to PID 1,
// and keep spinning. The agent then retries the same command every two minutes,
// leaking another family each time. Measured on 2026-08-17: 307 leaked processes,
// 102 live CPU spinners, 1,140% aggregate CPU, 28 GB RSS, load average 429.
//
// So: every command gets its own process group, and the timeout kills the GROUP.

import { spawn } from 'child_process';

const SIGKILL_GRACE_MS = 2000;

export function runContained(cmd, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    // detached:true puts the child in a new process group whose pgid == child pid,
    // so a negative-pid signal reaches every descendant it spawns.
    const child = spawn('/bin/sh', ['-c', cmd], {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const killGroup = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {
        // Group already gone, or we raced its exit. Either way there is nothing
        // left to signal.
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup('SIGTERM');
      // A child that ignores SIGTERM still has to go.
      setTimeout(() => {
        killGroup('SIGKILL');
        // Stop reading: a surviving grandchild holding the pipe open would keep
        // this call from ever settling, which is the original hang in another form.
        child.stdout.destroy();
        child.stderr.destroy();
        finish(124);
      }, SIGKILL_GRACE_MS);
    }, timeoutMs);

    function finish(code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code,
        stdout,
        stderr: timedOut
          ? `${stderr}\ncommand timed out after ${timeoutMs}ms and its process group was killed`
          : stderr,
        timedOut,
      });
    }

    child.on('error', (e) => {
      stderr += e.message;
      finish(127);
    });
    child.on('close', (code) => finish(code ?? 0));
  });
}
