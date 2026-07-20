import test from'node:test';import assert from'node:assert/strict';import{run as runTest}from'../src/commands/test.js';import{run as build}from'../src/commands/build.js';
import fs from 'node:fs';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand, CAPTURE_MAX_BYTES } from '../src/subprocess.js';
import { observeCommand } from '../src/command-observer.js';

const ECHO_ARGS_CMD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/echo-args.cmd');
test('test command preserves pass/failure and parser evidence',async()=>{let r=await runTest([process.execPath,'-e',"console.log('3 passed')"]);assert.equal(r.exitCode,0);assert.match(r.stdout,/passed=3/);r=await runTest([process.execPath,'-e',"console.log('FAILED tests/a.py::test_x - AssertionError: no');process.exit(7)"]);assert.equal(r.exitCode,7);assert.match(r.stdout,/FAIL tests\/a.py::test_x AssertionError: no/);});
test('parser matrix covers javascript cargo go and unittest',async()=>{const cases=[["FAIL  src/a.test.js\n × rejects empty\nTests: 1 failed, 3 passed",'javascript'],["---- tests::x stdout ----\nthread x panicked at src/lib.rs:2: bad\ntest result: FAILED. 2 passed; 1 failed",'cargo'],["--- FAIL: TestX (0s)\n x_test.go:2: bad\nFAIL",'go'],["FAIL: test_x (tests.T)\nFAILED (failures=1)",'unittest']];for(const[o,p]of cases){const r=await runTest([process.execPath,'-e',`console.log(${JSON.stringify(o)});process.exit(1)`]);assert.match(r.stdout,new RegExp(`parser=${p}`));}});
test('build extracts warnings/errors, timeout and truncation are bounded',async()=>{let r=await build([process.execPath,'-e',"console.log('Downloading x');console.log('warning: unused')"]);assert.match(r.stdout,/warnings=1/);r=await build([process.execPath,'-e',"console.log('fatal: build failed');process.exit(2)"]);assert.match(r.stdout,/ERROR fatal: build failed/);r=await runTest([process.execPath,'-e','setTimeout(() => {}, 2000)'],{timeout:.02});assert.equal(r.exitCode,124);r=await runTest([process.execPath,'-e',"console.log('x'.repeat(1000))"],{maxBytes:20});assert.match(r.stdout,/truncated=true/);});
test('missing command is compact',async()=>{const r=await runTest(['definitely-not-aish-command']);assert.equal(r.exitCode,127);assert.match(r.stdout,/command_not_found/);});
test('generic tests omit progress noise and failed builds fall back to bounded tails',async()=>{let r=await runTest([process.execPath,'-e',"console.log('collected 3 items');console.log('...');console.log('RuntimeError: no');process.exit(1)"]);assert.doesNotMatch(r.stdout,/TAIL collected 3 items/);assert.doesNotMatch(r.stdout,/TAIL \.\.\./);assert.match(r.stdout,/TAIL RuntimeError: no/);r=await build([process.execPath,'-e',"console.log('banner');console.log('compiler stopped');process.exit(2)"]);assert.match(r.stdout,/TAIL compiler stopped/);});
test('capture discards bytes beyond the cap while the child is still running',async()=>{const r=await runTest([process.execPath,'-e',"process.stdout.write('x'.repeat(1000000))"] ,{maxBytes:64});assert.match(r.stdout,/truncated=true/);assert.ok(r.stdout.length<1000);});
test('subprocess captures stdout, stderr, and arrival-ordered output independently', async () => {
  const script = "console.log('out-1');setTimeout(() => { console.error('err-2'); setTimeout(() => console.log('out-3'), 20); }, 20);";
  const r = await runCommand([process.execPath, '-e', script]);
  assert.equal(r.exitCode, 0);
  assert.equal(r.stdout, 'out-1\nout-3\n');
  assert.equal(r.stderr, 'err-2\n');
  assert.match(r.interleaved, /out-1\nerr-2\nout-3\n/);
});
test('all three subprocess captures are byte bounded', async () => {
  const script = "process.stdout.write('o'.repeat(1000000));process.stderr.write('e'.repeat(1000000))";
  const r = await runCommand([process.execPath, '-e', script]);
  assert.equal(r.truncated, true);
  assert.ok(Buffer.byteLength(r.stdout) <= CAPTURE_MAX_BYTES + 14);
  assert.ok(Buffer.byteLength(r.stderr) <= CAPTURE_MAX_BYTES + 14);
  assert.ok(Buffer.byteLength(r.interleaved) <= CAPTURE_MAX_BYTES + 14);
});
test('timeout preserves partial evidence and terminates promptly', async () => {
  const script = "console.log('started');setTimeout(() => {}, 10000)";
  const started = Date.now();
  const r = await runCommand([process.execPath, '-e', script], { timeout: 0.5 });
  assert.equal(r.exitCode, 124);
  assert.equal(r.timedOut, true);
  assert.match(r.stdout, /started/);
  assert.ok(Date.now() - started < 4000);
});
test('timeout terminates descendants in the isolated POSIX process group', { skip: process.platform === 'win32' }, async () => {
  const script = "import subprocess,sys,time;child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)']);print(child.pid,flush=True);time.sleep(30)";
  const r = await runCommand(['python3', '-c', script], { timeout: 0.5 });
  const pid = Number(r.stdout.trim().split('\n')[0]);
  assert.equal(r.exitCode, 124);
  assert.ok(Number.isInteger(pid));
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    process.kill(pid, 0);
    if (process.platform !== 'linux') assert.fail(`descendant ${pid} still running`);
    const state = (await readFile(`/proc/${pid}/stat`, 'utf8')).split(' ')[2];
    assert.equal(state, 'Z', `descendant ${pid} is still running`);
  } catch (error) {
    if (error.code !== 'ESRCH' && error.code !== 'ENOENT') throw error;
  }
});
test('Windows batch files (.cmd/.bat) run without a shell, argv preserved through escaping', { skip: process.platform !== 'win32' }, async () => {
  // Arguments with spaces, dashes, dots, and colons cover the realistic case
  // (npm/pnpm/yarn test-runner and package flags). Literal ", &, and bare ^ in
  // an argument cannot be round-tripped through a .bat/.cmd file via cmd.exe
  // under any escaping scheme — the same limitation cross-spawn ships with.
  const r = await runCommand([ECHO_ARGS_CMD, 'has space', '--save-dev', 'v1.2.3', 'C:\\path\\to\\file.js']);
  assert.equal(r.exitCode, 7);
  assert.match(r.stdout, /ARG=has space\r?\nARG=--save-dev\r?\nARG=v1\.2\.3\r?\nARG=C:\\path\\to\\file\.js/);
});
test('Windows batch shim rejects quote-breakout arguments before cmd.exe parsing', { skip: process.platform !== 'win32' }, async () => {
  const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aish-cmd-')), 'pwned.txt');
  const r = await runCommand([ECHO_ARGS_CMD, `" & echo PWNED > ${marker} & echo "`]);
  assert.equal(r.exitCode, 3);
  assert.match(r.stderr, /unsupported_cmd_argument/);
  assert.equal(fs.existsSync(marker), false);
});
test('logs observer E2E preserves child exit and multiline interleaved evidence', async () => {
  const script = "console.log('api | Error: failed');setTimeout(() => { console.error('    at worker (x.js:2:1)'); process.exit(11); }, 20);";
  const output = await observeCommand([process.execPath, '-e', script], { family: 'logs' });
  assert.equal(output.exitCode, 11);
  assert.match(output.stdout, /status=failed exit=11 family=logs/);
  assert.match(output.stdout, /Error: failed[\s\S]*at worker/);
  assert.match(output.stdout, /raw_lines=2[\s\S]*accounted_lines=2/);
});
