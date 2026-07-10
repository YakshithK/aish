import { spawn } from 'node:child_process';

export const CAPTURE_MAX_BYTES = 200000;
export const DEFAULT_TIMEOUT_SECONDS = 120;

export function runCommand(args, { cwd, timeout = DEFAULT_TIMEOUT_SECONDS, maxBytes = CAPTURE_MAX_BYTES } = {}) {
  return new Promise((resolve) => {
    const stdout = boundedCapture(maxBytes);
    const stderr = boundedCapture(maxBytes);
    let child;
    let timedOut = false;
    let settled = false;

    try {
      child = spawn(args[0], args.slice(1), { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ args, stdout: '', stderr: `error=subprocess_failed detail=${error.message}`, exitCode: 3 });
      return;
    }

    child.stdout.on('data', (chunk) => stdout.append(chunk));
    child.stderr.on('data', (chunk) => stderr.append(chunk));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ args, stdout: stdout.text(), stderr: `error=command_not_found command=${error.path}`, exitCode: 127, missing: true, truncated: stdout.truncated || stderr.truncated });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ args, stdout: stdout.text(), stderr: stderr.text(), exitCode: timedOut ? 124 : (code ?? 3), timedOut, truncated: stdout.truncated || stderr.truncated });
    });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout * 1000);
  });
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
      if (buffer.length > remaining) {
        chunks.push(buffer.subarray(0, remaining));
        bytes += remaining;
        truncated = true;
      } else {
        chunks.push(buffer);
        bytes += buffer.length;
      }
    },
    text() { return Buffer.concat(chunks, bytes).toString('utf8') + (truncated ? '\n...truncated' : ''); },
  };
}
