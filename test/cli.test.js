import test from 'node:test';
import assert from 'node:assert/strict';
import { commands, dispatch, main } from '../src/cli.js';

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
