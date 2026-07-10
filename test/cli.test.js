import test from 'node:test';
import assert from 'node:assert/strict';
import { commands, dispatch } from '../src/cli.js';

test('help lists every command', async () => {
  const output = await dispatch(['--help']);
  for (const command of commands) assert.match(output.stdout, new RegExp(`\\b${command}\\b`));
});

test('unknown command exits usage', async () => {
  await assert.rejects(() => dispatch(['nope']), (error) => error.exitCode === 2 && /unknown_command/.test(error.message));
});
