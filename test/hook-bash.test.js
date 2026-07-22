import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRewrite, handlePayload } from '../src/hook-bash.js';

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });

test('rewrites narrow compound commands to their aish equivalent', () => {
  assert.equal(computeRewrite(bash('git status')), 'aish status');
  assert.equal(computeRewrite(bash('git diff')), 'aish diff');
  assert.equal(computeRewrite(bash('git diff --staged')), 'aish diff --staged');
  assert.equal(computeRewrite(bash('git diff README.md')), 'aish diff README.md');
  assert.equal(computeRewrite(bash('cat README.md')), 'aish view README.md');
  assert.equal(computeRewrite(bash('find .')), 'aish tree');
  assert.equal(computeRewrite(bash('ls -R')), 'aish tree');
  assert.equal(computeRewrite(bash('grep -R aish')), 'aish search aish');
});

test('wraps recognized test/build commands through aish run', () => {
  assert.equal(computeRewrite(bash('npm test')), 'aish run -- npm test');
  assert.equal(computeRewrite(bash('pytest -q')), 'aish run -- pytest -q');
  assert.equal(computeRewrite(bash('cargo build')), 'aish run -- cargo build');
});

test('leaves unmatched, ambiguous, or non-Bash commands unchanged', () => {
  assert.equal(computeRewrite(bash('find . -name *.js')), null);
  assert.equal(computeRewrite(bash('cat a.js b.js')), null);
  assert.equal(computeRewrite(bash('docker logs -f api')), null);
  assert.equal(computeRewrite(bash('curl http://localhost')), null);
  assert.equal(computeRewrite(bash('npm run dev')), null);
  assert.equal(computeRewrite(bash('git status && echo done')), null);
  assert.equal(computeRewrite(bash('cat "a file.txt"')), null);
  assert.equal(computeRewrite(bash('')), null);
  assert.equal(computeRewrite({ tool_name: 'Read', tool_input: { file_path: 'x' } }), null);
  assert.equal(computeRewrite(null), null);
});

test('handlePayload returns the full PreToolUse updatedInput envelope or null', () => {
  assert.deepEqual(handlePayload(bash('git status')), {
    hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { command: 'aish status' } },
  });
  assert.equal(handlePayload(bash('echo hi')), null);
});
