import { spawn } from 'node:child_process';

export const CAPTURE_MAX_BYTES = 200000;
export const DEFAULT_TIMEOUT_SECONDS = 120;
export const TERMINATION_GRACE_MS = 2000;
const KILL_SETTLE_MS = 100;

export function runCommand(args, { cwd, timeout = DEFAULT_TIMEOUT_SECONDS, maxBytes = CAPTURE_MAX_BYTES } = {}) {
  return new Promise((resolve) => {
    const stdout = boundedCapture(maxBytes);
    const stderr = boundedCapture(maxBytes);
    const interleaved = boundedCapture(maxBytes);
    let child;
    let timedOut = false;
    let settled = false;
    let timeoutTimer;
    let forceTimer;
    let settleTimer;

    const finish = (values) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(forceTimer);
      clearTimeout(settleTimer);
      resolve({
        args,
        stdout: stdout.text(),
        stderr: stderr.text(),
        interleaved: interleaved.text(),
        truncated: stdout.truncated || stderr.truncated || interleaved.truncated,
        ...values,
      });
    };

    try {
      child = spawn(args[0], args.slice(1), {
        cwd,
        shell: false,
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      finish({ stderr: `error=subprocess_failed detail=${error.message}`, exitCode: 3 });
      return;
    }

    child.stdout.on('data', (chunk) => { stdout.append(chunk); interleaved.append(chunk); });
    child.stderr.on('data', (chunk) => { stderr.append(chunk); interleaved.append(chunk); });
    child.on('error', (error) => finish({
      stderr: `error=command_not_found command=${error.path ?? args[0]}`,
      exitCode: 127,
      missing: true,
    }));
    child.on('close', (code) => { if (!timedOut) finish({ exitCode: code ?? 3, timedOut: false }); });

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      terminateTree(child, false);
      forceTimer = setTimeout(() => {
        terminateTree(child, true);
        settleTimer = setTimeout(() => finish({ exitCode: 124, timedOut: true }), KILL_SETTLE_MS);
      }, TERMINATION_GRACE_MS);
    }, timeout * 1000);
  });
}

function terminateTree(child, force) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    const args = ['/PID', String(child.pid), '/T', ...(force ? ['/F'] : [])];
    try {
      const killer = spawn('taskkill', args, { shell: false, windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => { try { child.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch {} });
    } catch {
      try { child.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch {}
    }
    return;
  }
  try { process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM'); }
  catch (error) { if (error.code !== 'ESRCH') { try { child.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch {} } }
}

function boundedCapture(maxBytes) {
  const chunks = [];
  let bytes = 0;
  let truncated = false;
  return {
    get truncated() { return truncated; },
    append(chunk) {
      if (bytes >= maxBytes) { truncated = true; return; }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = maxBytes - bytes;
      chunks.push(buffer.subarray(0, remaining));
      bytes += Math.min(buffer.length, remaining);
      if (buffer.length > remaining) truncated = true;
    },
    text() { return Buffer.concat(chunks, bytes).toString('utf8') + (truncated ? '\n...truncated' : ''); },
  };
}
