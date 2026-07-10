import test from 'node:test';
import assert from 'node:assert/strict';
import { commands, dispatch, main } from '../src/cli.js';
import { classifyCommand, normalizeExecutable } from '../src/command-router.js';
import { observeCommand, parseGeneric, parseHttp, parseLogs } from '../src/command-observer.js';

test('help lists every command', async () => {
  const output = await dispatch(['--help']);
  for (const command of commands) assert.match(output.stdout, new RegExp(`\\b${command}\\b`));
});

test('unknown command exits usage', async () => {
  await assert.rejects(() => dispatch(['nope']), (error) => error.exitCode === 2 && /unknown_command/.test(error.message));
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
test('test and build require the argument separator',async()=>{for(const command of['test','build'])await assert.rejects(()=>dispatch([command,process.execPath]),error=>error.exitCode===2&&/expected/.test(error.message));});

test('classifier covers normalized executable shapes and near misses', () => {
  const cases = [
    [['pytest'], 'test'], [['npm', 'test'], 'test'], [['cargo', 'test'], 'test'], [['go', 'test'], 'test'],
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
  assert.match(output.stdout, /api WARN slow[\s\S]*api fatal: down/);
});

test('http parser reports emitted headers and never infers a missing status', () => {
  let output = parseHttp({ command: 'curl http://local', stdout: 'HTTP/1.1 201 Created\nContent-Type: application/json\n{"ok":true}\n', stderr: '', exitCode: 0, truncated: false });
  assert.match(output.stdout, /http_status=201/); assert.match(output.stdout, /Content-Type: application\/json/i);
  output = parseHttp({ command: 'curl http://local', stdout: '{"ok":true}\n', stderr: '', exitCode: 0, truncated: false });
  assert.match(output.stdout, /http_status=\?/);
});
