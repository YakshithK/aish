import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commands, dispatch, main } from '../src/cli.js';
import { classifyCommand, normalizeExecutable } from '../src/command-router.js';
import { observeCommand, ARBITRARY_TIMEOUT_DEFAULT } from '../src/command-observer.js';
import { parse as parseBuild } from '../src/parsers/build.js';
import { parse as parseGeneric } from '../src/parsers/generic.js';
import { parse as parseHttp } from '../src/parsers/http.js';
import { parse as parseLogs } from '../src/parsers/logs.js';
import { parse as parseTest } from '../src/parsers/test.js';
import { LOG_GROUP_MAX, sanitizeLogText, segmentLogEvents } from '../src/parsers/logs.js';
import { run as runTestCommand } from '../src/commands/test.js';
import { run as runBuildCommand } from '../src/commands/build.js';

test('help lists every command', async () => {
  const output = await dispatch(['--help']);
  for (const command of commands) assert.match(output.stdout, new RegExp(`\\b${command}\\b`));
});

test('unknown command routes to the external observer', async () => {
  let received;
  const output = await dispatch(['nope', 'literal *'], { observer: async (argv, options) => { received = { argv, options }; return { stdout: 'ok\n', stderr: '', exitCode: 0 }; } });
  assert.deepEqual(received, { argv: ['nope', 'literal *'], options: { timeoutSeconds: 30 } });
  assert.equal(output.exitCode, 0);
});

test('missing command, subcommand help, and unknown options match usage semantics', async () => {
  await assert.rejects(() => dispatch([]), (error) => error.exitCode === 2 && /missing=command/.test(error.message));
  assert.match((await dispatch(['tree', '--help'])).stdout, /usage: aish tree/);
  await assert.rejects(() => dispatch(['tree', '--bogus']), (error) => error.exitCode === 2 && /unknown_option/.test(error.message));
  const writes = { out: '', err: '' };
  const io = { stdout: { write: (value) => { writes.out += value; } }, stderr: { write: (value) => { writes.err += value; } } };
  assert.equal(await main([], io), 2);
});
test('every command exposes subcommand help',async()=>{for(const command of commands)assert.match((await dispatch([command,'--help'])).stdout,new RegExp(`usage: aish ${command}`));});
test('test and build accept the command with or without a leading --, reject empty and unknown-flag forms',async()=>{
  for(const command of['test','build']){
    await assert.rejects(()=>dispatch([command]),error=>error.exitCode===2&&/expected/.test(error.message));
    await assert.rejects(()=>dispatch([command,'--']),error=>error.exitCode===2&&/expected/.test(error.message));
    await assert.rejects(()=>dispatch([command,'--bogus',process.execPath]),error=>error.exitCode===2&&/unknown_option=--bogus/.test(error.message));
    const withSeparator=await dispatch([command,'--',process.execPath,'-e','process.exit(3)']);
    assert.equal(withSeparator.exitCode,3);
    const withoutSeparator=await dispatch([command,process.execPath,'-e','process.exit(3)']);
    assert.equal(withoutSeparator.exitCode,3);
  }
});

test('compound commands route to the equivalent aish subcommand only for narrow, unambiguous shapes', async () => {
  assert.match((await dispatch(['git', 'status'])).stdout, /branch=/);
  assert.match((await dispatch(['git', 'diff'])).stdout, /diff=/);
  assert.match((await dispatch(['git', 'diff', '--staged'])).stdout, /diff=staged/);
  assert.match((await dispatch(['git', 'diff', 'README.md'])).stdout, /file=(?:file:)?README\.md/);
  assert.match((await dispatch(['cat', 'README.md'])).stdout, /file=README.md/);
  assert.match((await dispatch(['find', '.'])).stdout, /project=/);
  assert.match((await dispatch(['ls', '-R'])).stdout, /project=/);
  assert.match((await dispatch(['grep', '-R', 'aish'])).stdout, /query=aish/);
  assert.match((await dispatch(['grep', '-r', 'aish', 'src'])).stdout, /query=aish/);
  let received;
  const observer = async (argv, options) => { received = argv; return { stdout: '', stderr: '', exitCode: 0 }; };
  await dispatch(['find', '.', '-name', '*.js'], { observer });
  assert.deepEqual(received, ['find', '.', '-name', '*.js']);
  await dispatch(['cat', 'a', 'b'], { observer });
  assert.deepEqual(received, ['cat', 'a', 'b']);
  await dispatch(['git', 'diff', 'a', 'b'], { observer });
  assert.deepEqual(received, ['git', 'diff', 'a', 'b']);
});

test('classifier covers normalized executable shapes and near misses', () => {
  const cases = [
    [['pytest'], 'test'], [['npm', 'test'], 'test'], [['cargo', 'test'], 'test'], [['go', 'test'], 'test'],
    [['npm', 'run', 'test'], 'test'], [['pnpm', 'run', 'test:unit'], 'test'], [['yarn', 'run', 'build'], 'build'],
    [['pnpm', 'install'], 'build'], [['yarn', 'build'], 'build'], [['bun', 'ci'], 'build'], [['cargo', 'check'], 'build'],
    [['go', 'build'], 'build'], [['pip', 'install'], 'build'], [['uv', 'sync'], 'build'],
    [['docker', 'logs', 'api'], 'logs'], [['docker', 'compose', 'logs'], 'logs'], [['docker-compose', 'logs'], 'logs'], [['kubectl', 'logs'], 'logs'],
    [['/usr/bin/curl'], 'http'], [['C:\\tools\\NPM.CMD', 'TEST'], 'test'], [['npm', 'testing'], 'generic'], [[], 'generic'],
  ];
  for (const [argv, family] of cases) assert.equal(classifyCommand(argv), family, argv.join(' '));
  assert.equal(normalizeExecutable('C:\\Tools\\CURL.EXE'), 'curl');
});

test('observer executes exact argv once and preserves ordinary exits', async () => {
  const argv = ['tool', 'literal *', '$HOME']; let calls = 0;
  const output = await observeCommand(argv, { executor: async (actual) => {
    calls += 1; assert.deepEqual(actual, argv);
    return { stdout: 'hello\n', stderr: '', interleaved: 'hello\n', exitCode: 7, truncated: false };
  } });
  assert.equal(calls, 1); assert.equal(output.exitCode, 7); assert.match(output.stdout, /family=generic/);
});

test('observer owns missing, timeout, forced family, and parser fallback states', async () => {
  let output = await observeCommand(['missing'], { executor: async () => ({ missing: true, stderr: 'error=command_not_found command=missing', exitCode: 127 }) });
  assert.equal(output.exitCode, 127); assert.match(output.stdout, /family=generic/);
  output = await observeCommand(['slow'], { family: 'logs', executor: async () => ({ timedOut: true, stdout: 'partial', stderr: '', interleaved: 'partial', exitCode: 124 }) });
  assert.equal(output.exitCode, 124); assert.match(output.stdout, /timeout=true family=logs/);
  output = await observeCommand(['tool'], { family: 'invalid', executor: async () => ({ stdout: '', stderr: '', interleaved: '', exitCode: 0 }) });
  assert.match(output.stdout, /family=generic/);
  const fallback = parseGeneric({ command: 'x', stdout: '', stderr: '', interleaved: '', exitCode: 0, truncated: false });
  assert.match(fallback.stdout, /no_command_output/);
});

test('logs parser retains causal evidence and counts whole-word markers', () => {
  const output = parseLogs({ command: 'docker logs api', interleaved: 'api ready\napi terror count\napi WARN slow\napi fatal: down\n', stdout: '', stderr: '', exitCode: 1, truncated: false });
  assert.match(output.stdout, /errors=1 warnings=1/);
  assert.match(output.stdout, /api fatal: down[\s\S]*api WARN slow/);
});

test('logs parser groups repeated multiline events across services', () => {
  const interleaved = [
    '\u001b[31m2026-07-10T12:00:00Z api-1 | Error: database unavailable\u001b[0m',
    '    at connect (db.js:10:2)',
    '2026-07-10T12:00:01Z api-2 | Error: database unavailable',
    '    at connect (db.js:10:2)',
    '2026-07-10T12:00:02Z worker | WARN retrying',
  ].join('\r\n');
  const output = parseLogs({ command: 'docker compose logs', interleaved, stdout: '', stderr: '', exitCode: 4, truncated: false });
  assert.equal(output.exitCode, 4);
  assert.match(output.stdout, /raw_lines=5/);
  assert.match(output.stdout, /services=api-1,api-2,worker errors=2 warnings=1/);
  assert.match(output.stdout, /ERROR count=2 services=api-1,api-2/);
  assert.equal((output.stdout.match(/at connect/gu) || []).length, 1);
  assert.doesNotMatch(output.stdout, /\u001b/);
  assert.match(output.stdout, /accounted_lines=5/);
});

test('http parser reports emitted headers and never infers a missing status', () => {
  let output = parseHttp({ command: 'curl http://local', stdout: 'HTTP/1.1 201 Created\nContent-Type: application/json\n{"ok":true}\n', stderr: '', exitCode: 0, truncated: false });
  assert.match(output.stdout, /http_status=201/); assert.match(output.stdout, /Content-Type: application\/json/i);
  output = parseHttp({ command: 'curl http://local', stdout: '{"ok":true}\n', stderr: '', exitCode: 0, truncated: false });
  assert.match(output.stdout, /http_status=\?/);
});

test('explicit test and build adapters produce the same golden output as the bare invocation', async () => {
  const testOutput = await runTestCommand(['pytest', '-q'], { executor: async () => ({ stdout: '3 passed\n', stderr: '', interleaved: '3 passed\n', exitCode: 0, truncated: false }) });
  assert.deepEqual(testOutput, { stdout: 'status=passed exit=0 command="pytest -q"\npassed=3 failed=0\ntruncated=false\n', stderr: '', exitCode: 0 });
  const buildOutput = await runBuildCommand(['npm', 'build'], { executor: async () => ({ stdout: 'warning: unused\n', stderr: '', interleaved: 'warning: unused\n', exitCode: 0, truncated: false }) });
  assert.deepEqual(buildOutput, { stdout: 'status=passed exit=0 warnings=1 command="npm build"\nWARN warning: unused\nomitted=progress,downloads,successful_steps\ntruncated=false\n', stderr: '', exitCode: 0 });
});

test('test and build no longer diverge from the bare path on missing commands or timeouts', async () => {
  const missing = async () => ({ stdout: '', stderr: 'error=command_not_found command=pytest', exitCode: 127, missing: true });
  const testMissing = await runTestCommand(['pytest', '-q'], { executor: missing });
  assert.match(testMissing.stdout, /^status=error exit=127 family=test command="pytest -q"/);
  const buildMissing = await runBuildCommand(['npm', 'build'], { executor: missing });
  assert.match(buildMissing.stdout, /^status=error exit=127 family=build command="npm build"/);

  const timedOut = async () => ({ stdout: '', stderr: '', interleaved: 'running...\n', exitCode: 124, timedOut: true, truncated: false });
  const testTimeout = await runTestCommand(['pytest', '-q'], { executor: timedOut });
  assert.match(testTimeout.stdout, /^status=timeout exit=124 timeout=true family=test command="pytest -q"/);
  const buildTimeout = await runBuildCommand(['npm', 'build'], { executor: timedOut });
  assert.match(buildTimeout.stdout, /^status=timeout exit=124 timeout=true family=build command="npm build"/);
});

test('run bypasses native precedence and passes exact argv after the separator', async () => {
  let received;
  await dispatch(['run', '--timeout', '10.5', '--', 'tree', '$HOME', '*.js'], { observer: async (argv, options) => { received = { argv, options }; return { stdout: '', stderr: '', exitCode: 0 }; } });
  assert.deepEqual(received, { argv: ['tree', '$HOME', '*.js'], options: { timeoutSeconds: 10.5 } });
  const native = await dispatch(['tree', '.']);
  assert.match(native.stdout, /root:/);
});

test('run accepts --timeout and the command without a -- separator', async () => {
  let received;
  const observer = async (argv, options) => { received = { argv, options }; return { stdout: '', stderr: '', exitCode: 0 }; };
  await dispatch(['run', '--timeout', '10.5', 'tree', '$HOME', '*.js'], { observer });
  assert.deepEqual(received, { argv: ['tree', '$HOME', '*.js'], options: { timeoutSeconds: 10.5 } });
  received = undefined;
  await dispatch(['run', 'tree', '$HOME', '*.js'], { observer });
  assert.deepEqual(received, { argv: ['tree', '$HOME', '*.js'], options: { timeoutSeconds: ARBITRARY_TIMEOUT_DEFAULT } });
});

test('invalid run grammar exits usage without invoking the observer', async () => {
  const invalid = [
    ['run'], ['run', '--',], ['run', '--timeout', '--', 'x'], ['run', '--timeout', '1', '--timeout', '2', '--', 'x'],
    ['run', '--bogus', '--', 'x'], ['run', '--timeout', 'NaN', '--', 'x'], ['run', '--timeout', '0', '--', 'x'],
    ['run', '--timeout', '-1', '--', 'x'], ['run', '--timeout', '3601', '--', 'x'],
  ];
  for (const argv of invalid) {
    let called = false;
    await assert.rejects(() => dispatch(argv, { observer: async () => { called = true; } }), error => error.exitCode === 2, argv.join(' '));
    assert.equal(called, false, argv.join(' '));
  }
});

test('implicit and explicit external observations preserve missing and child exit codes', async () => {
  let output = await dispatch(['definitely-not-aish-command']);
  assert.equal(output.exitCode, 127); assert.match(output.stdout, /command_not_found/);
  output = await dispatch(['run', '--', process.execPath, '-e', 'process.exit(9)']);
  assert.equal(output.exitCode, 9); assert.match(output.stdout, /family=generic/);
});

test('a near-miss typo of a real subcommand gets a "did you mean" hint, an unrelated missing binary does not', async () => {
  const missing = async () => ({ stderr: 'error=command_not_found command=int', exitCode: 127, missing: true });
  const output = await dispatch(['int'], { observer: (argv, opts) => observeCommand(argv, { ...opts, executor: missing }) });
  assert.match(output.stdout, /hint=did you mean "aish init"\?/);
  const unrelated = await dispatch(['definitely-not-aish-command']);
  assert.doesNotMatch(unrelated.stdout, /hint=/);
});

test('bare invocation points to --help', async () => {
  await assert.rejects(() => dispatch([]), (error) => error.exitCode === 2 && /hint="aish --help"/.test(error.message));
});

test('parser exceptions fall back to generic output without changing exit', async () => {
  const output = await observeCommand(['tool'], {
    executor: async () => ({ stdout: 'fatal: retained\n', stderr: '', interleaved: 'fatal: retained\n', exitCode: 6, truncated: false }),
    parserRegistry: { generic: () => { throw new Error('parser bug'); } },
  });
  assert.equal(output.exitCode, 6); assert.match(output.stdout, /family=generic/); assert.match(output.stdout, /fatal: retained/);
});

test('family parsers cover empty, noise, truncation, and failure evidence', () => {
  const base = { command: 'x', stdout: '', stderr: '', interleaved: '', exitCode: 0, truncated: false };
  assert.match(parseLogs(base).stdout, /no_log_output/);
  assert.match(parseHttp(base).stdout, /http_status=\?[\s\S]*no_http_output/);
  assert.match(parseGeneric(base).stdout, /no_command_output/);
  assert.match(parseLogs({ ...base, interleaved: '10%\nservice ready\n', truncated: true }).stdout, /LOG count=1 services=-[\s\S]*service ready[\s\S]*truncated=true/);
  assert.match(parseHttp({ ...base, stderr: 'curl: (7) Failed to connect\n', exitCode: 7, truncated: true }).stdout, /curl: \(7\)[\s\S]*truncated=true/);
  assert.match(parseGeneric({ ...base, interleaved: 'same\nsame\nError: bad\n', exitCode: 4 }).stdout, /TAIL Error: bad/);
  assert.match(parseTest({ ...base, stdout: '', exitCode: 1 }).stdout, /parser=generic/);
  assert.match(parseBuild({ ...base, stdout: 'progress only', exitCode: 2 }).stdout, /TAIL progress only/);
});

test('test parser reads node --test summary counts instead of guessing from tail-line count', () => {
  const nodeTestOutput = [
    'ℹ tests 2', 'ℹ suites 0', 'ℹ pass 1', 'ℹ fail 1', 'ℹ cancelled 0', 'ℹ skipped 0', 'ℹ todo 0',
    'ℹ duration_ms 12.3', '✖ failing tests:', 'test at x:1:1', '✖ fails (1ms)', "'test failed'",
  ].join('\n');
  const output = parseTest({ command: 'node --test', stdout: nodeTestOutput, stderr: '', interleaved: '', exitCode: 1, truncated: false });
  assert.match(output.stdout, /passed=1 failed=1 /);
  assert.match(output.stdout, /parser=node/);
});

test('unrecognized failing test output reports an unknown count rather than the tail-line length', () => {
  const opaqueOutput = Array.from({ length: 12 }, (_, i) => `some unrelated diagnostic line ${i}`).join('\n');
  const output = parseTest({ command: 'weird-runner', stdout: opaqueOutput, stderr: '', interleaved: '', exitCode: 1, truncated: false });
  assert.match(output.stdout, /passed=\? failed=\? /);
  assert.doesNotMatch(output.stdout, /failed=12/);
});

test('test parser counts failures on exit zero and avoids repeated-passed ReDoS', () => {
  const suspicious = parseTest({ command: 'jest', stdout: 'Tests: 3 failed, 2 passed\n', stderr: '', interleaved: '', exitCode: 0, truncated: false });
  assert.equal(suspicious.exitCode, 1);
  assert.match(suspicious.stdout, /status=passed_with_failures_in_output/);
  assert.match(suspicious.stdout, /passed=2 failed=3/);
  const started = Date.now();
  const output = parseTest({ command: 'pytest', stdout: '1 passed '.repeat(8000), stderr: '', interleaved: '', exitCode: 1, truncated: false });
  assert.ok(Date.now() - started < 500);
  assert.match(output.stdout, /status=failed/);
});

test('family parsers sanitize ANSI outside logs and build flags ignored errors on exit zero', () => {
  const color = '\u001b[31mFAIL: test_x (tests.T)\u001b[0m\nFAILED (failures=1)';
  const parsed = parseTest({ command: 'python -m unittest', stdout: color, stderr: '', interleaved: '', exitCode: 1, truncated: false });
  assert.doesNotMatch(parsed.stdout, /\u001b/);
  assert.match(parsed.stdout, /FAIL test_x/);
  const build = parseBuild({ command: 'make', stdout: 'error: ignored by wrapper\n', stderr: '', interleaved: '', exitCode: 0, truncated: false });
  assert.equal(build.exitCode, 1);
  assert.match(build.stdout, /status=passed_with_errors_in_output/);
});

test('classifier includes each executable named in the initial registry', () => {
  for (const executable of ['pytest', 'unittest', 'jest', 'vitest', 'mocha']) assert.equal(classifyCommand([executable]), 'test');
  for (const manager of ['npm', 'pnpm', 'yarn', 'bun']) {
    assert.equal(classifyCommand([manager, 'test']), 'test');
    for (const subcommand of ['install', 'build', 'ci']) assert.equal(classifyCommand([manager, subcommand]), 'build');
  }
});

const logFixture = name => readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
const logInput = (interleaved, overrides = {}) => ({ command: 'docker compose logs', interleaved, stdout: '', stderr: '', exitCode: 0, truncated: false, ...overrides });
const metric = (stdout, name) => Number(stdout.match(new RegExp(`(?:^| )${name}=(\\d+)`, 'm'))?.[1]);

test('logs sanitization normalizes terminal controls and preserves printable Unicode', () => {
  const sanitized = sanitizeLogText('\u001b[31mERROR café 🚀\u001b[0m\rnext\u0000line\r\n');
  assert.equal(sanitized, 'ERROR café 🚀\nnextline\n');
});

test('logs event segmentation covers timestamps, prefixes, traces, and progress noise', () => {
  const cases = [
    ['2026-07-10T12:00:00Z api | ready\n', 1],
    ['12:00:00.123 [pod/container] ready\n', 1],
    ['plain event\n    at call (x.js:1:1)\n', 1],
    ['Traceback (most recent call last):\n  File "x.py", line 1\nValueError: bad\n', 1],
    ['10%\n\nready\n', 1],
  ];
  for (const [source, expected] of cases) assert.equal(segmentLogEvents(source).events.length, expected, source);
});

test('logs severity uses event boundaries and counts repetitions, not matching lines', () => {
  const source = 'terror metrics\nWARN first warning\nError: first error\nCaused by: Error: nested marker\nError: first error\nCaused by: Error: nested marker\n';
  const output = parseLogs(logInput(source, { exitCode: 3 }));
  assert.match(output.stdout, /errors=2 warnings=1/);
  assert.match(output.stdout, /ERROR count=2/);
  assert.doesNotMatch(output.stdout, /errors=3/);
});

test('compose fixture has exact deterministic grouping and accounting', () => {
  const input = logInput(logFixture('logs-compose-repetition.txt'));
  const first = parseLogs(input);
  const second = parseLogs(input);
  assert.deepEqual(first, second);
  assert.equal(first.stdout, 'status=passed exit=0 family=logs command="docker compose logs"\nraw_lines=6 compact_lines=12 services=api-1,api-2,worker-1 errors=0 warnings=0\nLOG count=3 services=api-1,api-2\n  2026-07-10T12:00:00Z api-1 | server ready on :3000\nLOG count=2 services=worker-1\n  2026-07-10T12:00:03Z worker-1 | processed batch\nLOG count=1 services=api-1\n  2026-07-10T12:00:05Z api-1 | request complete\naccounted_lines=6 emitted_lines=3 collapsed_lines=3 routine_omitted_lines=0 severity_omitted_lines=0 noise_lines=0 blank_lines=0 truncation_lines=0\noverflow_groups=0 overflow_events=0 overflow_lines=0 overflow_errors=0 overflow_warnings=0\nomitted=collapsed_repetitions,routine,noise,blank,overflow,full_output\ntruncated=false\n');
  assert.equal(metric(first.stdout, 'raw_lines'), metric(first.stdout, 'accounted_lines'));
});

test('mixed-service fixture keeps complete JS, Java, and Python events in severity order', () => {
  const output = parseLogs(logInput(logFixture('logs-mixed-multiline.txt'), { exitCode: 8 }));
  assert.equal(output.exitCode, 8);
  assert.match(output.stdout, /errors=3 warnings=1/);
  assert.match(output.stdout, /Error: request failed[\s\S]*at processRequest/);
  assert.match(output.stdout, /IllegalStateException[\s\S]*Caused by:[\s\S]*Queue\.read/);
  assert.match(output.stdout, /Traceback[\s\S]*ValueError: invalid job/);
  assert.match(output.stdout, /ValueError: invalid job[\s\S]*WARN retry scheduled/);
  assert.equal(metric(output.stdout, 'raw_lines'), metric(output.stdout, 'accounted_lines'));
});

test('logs group cap exposes severity overflow and accounts for every line', () => {
  const source = Array.from({ length: LOG_GROUP_MAX + 4 }, (_, index) => `Error: unique-${index}`).join('\n');
  const output = parseLogs(logInput(source, { truncated: true }));
  assert.match(output.stdout, new RegExp(`errors=${LOG_GROUP_MAX + 4}`));
  assert.match(output.stdout, /overflow_groups=4 overflow_events=4 overflow_lines=4 overflow_errors=4/);
  assert.equal(metric(output.stdout, 'raw_lines'), metric(output.stdout, 'accounted_lines'));
  assert.ok(Buffer.byteLength(output.stdout) < 16000);
});

test('high-volume fixture selects a bounded recent tail without splitting events', () => {
  const output = parseLogs(logInput(logFixture('logs-high-volume-unique.txt'), { truncated: true }));
  assert.equal((output.stdout.match(/^LOG count=/gmu) || []).length, 12);
  assert.match(output.stdout, /event unique-20/);
  assert.doesNotMatch(output.stdout, /event unique-01/);
  assert.equal(metric(output.stdout, 'raw_lines'), metric(output.stdout, 'accounted_lines'));
});
