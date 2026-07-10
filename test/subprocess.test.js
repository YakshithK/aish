import test from'node:test';import assert from'node:assert/strict';import{run as runTest}from'../src/commands/test.js';import{run as build}from'../src/commands/build.js';
import { readFile } from 'node:fs/promises';
import { runCommand, CAPTURE_MAX_BYTES } from '../src/subprocess.js';
test('test command preserves pass/failure and parser evidence',async()=>{let r=await runTest(['python3','-c',"print('3 passed')"]);assert.equal(r.exitCode,0);assert.match(r.stdout,/passed=3/);r=await runTest(['python3','-c',"print('FAILED tests/a.py::test_x - AssertionError: no');raise SystemExit(7)"]);assert.equal(r.exitCode,7);assert.match(r.stdout,/FAIL tests\/a.py::test_x AssertionError: no/);});
test('parser matrix covers javascript cargo go and unittest',async()=>{const cases=[["FAIL  src/a.test.js\n × rejects empty\nTests: 1 failed, 3 passed",'javascript'],["---- tests::x stdout ----\nthread x panicked at src/lib.rs:2: bad\ntest result: FAILED. 2 passed; 1 failed",'cargo'],["--- FAIL: TestX (0s)\n x_test.go:2: bad\nFAIL",'go'],["FAIL: test_x (tests.T)\nFAILED (failures=1)",'unittest']];for(const[o,p]of cases){const r=await runTest(['python3','-c',`print(${JSON.stringify(o)});raise SystemExit(1)`]);assert.match(r.stdout,new RegExp(`parser=${p}`));}});
test('build extracts warnings/errors, timeout and truncation are bounded',async()=>{let r=await build(['python3','-c',"print('Downloading x');print('warning: unused')"]);assert.match(r.stdout,/warnings=1/);r=await build(['python3','-c',"print('fatal: build failed');raise SystemExit(2)"]);assert.match(r.stdout,/ERROR fatal: build failed/);r=await runTest(['python3','-c','import time; time.sleep(2)'],{timeout:.02});assert.equal(r.exitCode,124);r=await runTest(['python3','-c',"print('x'*1000)"],{maxBytes:20});assert.match(r.stdout,/truncated=true/);});
test('missing command is compact',async()=>{const r=await runTest(['definitely-not-aish-command']);assert.equal(r.exitCode,127);assert.match(r.stdout,/command_not_found/);});
test('generic tests omit progress noise and failed builds fall back to bounded tails',async()=>{let r=await runTest(['python3','-c',"print('collected 3 items');print('...');print('RuntimeError: no');raise SystemExit(1)"]);assert.doesNotMatch(r.stdout,/TAIL collected 3 items/);assert.doesNotMatch(r.stdout,/TAIL \.\.\./);assert.match(r.stdout,/TAIL RuntimeError: no/);r=await build(['python3','-c',"print('banner');print('compiler stopped');raise SystemExit(2)"]);assert.match(r.stdout,/TAIL compiler stopped/);});
test('capture discards bytes beyond the cap while the child is still running',async()=>{const r=await runTest(['python3','-c',"import sys; sys.stdout.write('x'*1000000)"] ,{maxBytes:64});assert.match(r.stdout,/truncated=true/);assert.ok(r.stdout.length<1000);});
test('subprocess captures stdout, stderr, and arrival-ordered output independently', async () => {
  const script = "import sys,time;print('out-1',flush=True);time.sleep(.02);print('err-2',file=sys.stderr,flush=True);time.sleep(.02);print('out-3',flush=True)";
  const r = await runCommand(['python3', '-c', script]);
  assert.equal(r.exitCode, 0);
  assert.equal(r.stdout, 'out-1\nout-3\n');
  assert.equal(r.stderr, 'err-2\n');
  assert.match(r.interleaved, /out-1\nerr-2\nout-3\n/);
});
test('all three subprocess captures are byte bounded', async () => {
  const script = "import sys;sys.stdout.write('o'*1000000);sys.stderr.write('e'*1000000)";
  const r = await runCommand(['python3', '-c', script]);
  assert.equal(r.truncated, true);
  assert.ok(Buffer.byteLength(r.stdout) <= CAPTURE_MAX_BYTES + 14);
  assert.ok(Buffer.byteLength(r.stderr) <= CAPTURE_MAX_BYTES + 14);
  assert.ok(Buffer.byteLength(r.interleaved) <= CAPTURE_MAX_BYTES + 14);
});
test('timeout preserves partial evidence and terminates promptly', async () => {
  const script = "import time;print('started',flush=True);time.sleep(10)";
  const started = Date.now();
  const r = await runCommand(['python3', '-c', script], { timeout: 0.05 });
  assert.equal(r.exitCode, 124);
  assert.equal(r.timedOut, true);
  assert.match(r.stdout, /started/);
  assert.ok(Date.now() - started < 4000);
});
test('timeout terminates descendants in the isolated POSIX process group', { skip: process.platform === 'win32' }, async () => {
  const script = "import subprocess,sys,time;child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)']);print(child.pid,flush=True);time.sleep(30)";
  const r = await runCommand(['python3', '-c', script], { timeout: 0.05 });
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
