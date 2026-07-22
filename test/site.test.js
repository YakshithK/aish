import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteDir = join(__dirname, '..', 'docs');
const html = () => readFileSync(join(siteDir, 'index.html'), 'utf8');
const css = () => readFileSync(join(siteDir, 'styles.css'), 'utf8');
const js = () => readFileSync(join(siteDir, 'script.js'), 'utf8');

test('index.html has no placeholder markers', () => {
  const content = html();
  assert.doesNotMatch(content, /TODO|TBD|FIXME/i);
});

test('index.html includes the install command and GitHub/npm links', () => {
  const content = html();
  assert.match(content, /npm i -g @yakshith\/agentshell/);
  assert.match(content, /https:\/\/github\.com\/YakshithK\/aish/);
  assert.match(content, /https:\/\/www\.npmjs\.com\/package\/@yakshith\/agentshell/);
});

test('index.html includes all required sections', () => {
  const content = html();
  for (const id of ['demo', 'before-after', 'how-it-works', 'agents', 'stats']) {
    assert.match(content, new RegExp(`id="${id}"`));
  }
});

test('index.html references demo assets that exist on disk', () => {
  const content = html();
  const matches = [...content.matchAll(/(?:src|poster)="(assets\/[^"]+)"/g)];
  assert.ok(matches.length > 0, 'expected at least one asset reference');
  for (const [, relPath] of matches) {
    const assetPath = join(siteDir, relPath);
    assert.ok(existsSync(assetPath), `missing asset: ${relPath}`);
  }
});

test('styles.css defines the brand color tokens', () => {
  const content = css();
  assert.match(content, /#0b0d0b/);
  assert.match(content, /#6de08a/);
});

test('script.js wires up the copy-to-clipboard handler', () => {
  const content = js();
  assert.match(content, /copy-install/);
  assert.match(content, /clipboard/i);
});
