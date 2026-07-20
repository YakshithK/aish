import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const CAPTURE_MAX_BYTES = 200000;
export const DEFAULT_TIMEOUT_SECONDS = 120;
export const TERMINATION_GRACE_MS = 2000;
const KILL_SETTLE_MS = 100;
const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.com']);
// See https://qntm.org/cmd and node-cross-spawn's lib/util/escape.js, which this mirrors.
const META_CHARS_REGEXP = /([()[\]%!^"`<>&|;, *?])/g;

// Windows cannot execute .cmd/.bat files without a shell (CreateProcess only
// auto-appends .exe for extensionless names), so npm/pnpm/yarn are unreachable
// via spawn(shell:false) as-is. Resolve the real file via PATH/PATHEXT and, if
// it isn't a native .exe/.com, run it through cmd.exe ourselves with every
// argument individually escaped — never by handing Node's own `shell` option
// a joined string.
function resolveWindowsExecutable(command) {
  const hasSeparator = command.includes('/') || command.includes('\\');
  const baseName = hasSeparator ? path.basename(command) : command;
  const searchDirs = hasSeparator ? [path.dirname(command)] : (process.env.PATH ?? '').split(path.delimiter);
  const hasExtension = path.extname(baseName) !== '';
  const pathExt = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);

  for (const dir of searchDirs) {
    if (!dir) continue;
    const base = path.join(dir, baseName);
    if (hasExtension) { if (fs.existsSync(base)) return base; continue; }
    for (const ext of pathExt) { const candidate = base + ext; if (fs.existsSync(candidate)) return candidate; }
  }
  return null;
}

function escapeCmdCommand(command) { return command.replace(META_CHARS_REGEXP, '^$1'); }

function escapeCmdArgument(arg, doubleEscapeMetaChars) {
  let value = String(arg);
  value = value.replace(/(\\*)"/g, '$1$1\\"');
  value = value.replace(/(\\*)$/, '$1$1');
  value = `"${value}"`;
  value = value.replace(META_CHARS_REGEXP, '^$1');
  if (doubleEscapeMetaChars) value = value.replace(META_CHARS_REGEXP, '^$1');
  return value;
}

function windowsCmdShim(executable, childArgs) {
  const resolved = resolveWindowsExecutable(executable);
  if (!resolved || EXECUTABLE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) return null;
  // npm's own package-local .cmd shims (node_modules/.bin/*.cmd) re-run cmd.exe's
  // own ^-escapes a second time internally, so they need double escaping; the
  // real npm/pnpm/yarn global commands we actually target do not.
  const doubleEscapeMetaChars = /node_modules[\\/]\.bin[\\/][^\\/]+\.cmd$/i.test(resolved);
  const normalized = path.normalize(resolved);
  const shellCommand = [escapeCmdCommand(normalized), ...childArgs.map((arg) => escapeCmdArgument(arg, doubleEscapeMetaChars))].join(' ');
  return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${shellCommand}"`] };
}

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

    const shim = process.platform === 'win32' ? windowsCmdShim(args[0], args.slice(1)) : null;

    try {
      child = spawn(shim ? shim.file : args[0], shim ? shim.args : args.slice(1), {
        cwd,
        shell: false,
        detached: process.platform !== 'win32',
        windowsHide: true,
        windowsVerbatimArguments: Boolean(shim),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      finish({ stderr: `error=subprocess_failed detail=${error.message}`, exitCode: 3 });
      return;
    }

    child.stdout.on('data', (chunk) => { stdout.append(chunk); interleaved.append(chunk); });
    child.stderr.on('data', (chunk) => { stderr.append(chunk); interleaved.append(chunk); });
    child.on('error', (error) => finish({
      stderr: `error=command_not_found command=${shim ? args[0] : error.path ?? args[0]}`,
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
