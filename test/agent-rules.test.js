import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run as init } from '../src/commands/init.js';
import { run as doctor } from '../src/commands/doctor.js';
import { printSkill } from '../src/commands/skill.js';
import { AGENT_INSTRUCTIONS, CURSOR_INSTRUCTIONS, SKILL_INSTRUCTIONS } from '../src/agent-rules.js';
import { installMissingGlobal } from '../src/global-routing.js';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aish-rules-'));

test('init creates, skips, and force-updates repo rules', async () => {
  const d = temp();
  assert.match((await init(d, { noGlobal: true })).stdout, /created=3/);
  assert.match((await init(d, { noGlobal: true })).stdout, /skipped=3/);
  fs.writeFileSync(path.join(d, 'AGENTS.md'), 'old');
  assert.match((await init(d, { force: true, noGlobal: true })).stdout, /updated=3/);
  assert.match(doctor(d).stdout, /agent_rules=ok/);
});

test('init --yes installs missing global routing with injectable home', async () => {
  const d = temp();
  const home = temp();
  const output = await init(d, { yes: true, home });
  assert.match(output.stdout, /global_agent_routing=installed created=4/);
  const file = path.join(home, '.codex/skills/agentshell/SKILL.md');
  assert.equal(fs.readFileSync(file, 'utf8'), printSkill('codex').stdout);
  assert.match(doctor('.', true, home).stdout, /global_codex_skill=present/);
});

test('init without --yes reports missing global routing without installing', async () => {
  const d = temp();
  const home = temp();
  const output = await init(d, { home });
  assert.match(output.stdout, /global_agent_routing=missing/);
  assert.match(output.stdout, /suggestion=run "aish init --yes"/);
  assert.equal(fs.existsSync(path.join(home, '.codex/skills/agentshell/SKILL.md')), false);
});

test('global routing helper writes all host paths', () => {
  const home = temp();
  installMissingGlobal(['claude', 'codex', 'cursor', 'opencode'], home);
  for (const relative of [
    '.claude/skills/agentshell/SKILL.md',
    '.codex/skills/agentshell/SKILL.md',
    '.cursor/rules/agentshell.mdc',
    '.config/opencode/skills/agentshell/SKILL.md',
  ]) assert.equal(fs.existsSync(path.join(home, relative)), true);
});

test('templates retain the complete Python routing guidance', () => {
  for (const line of ['Do not use `cat`', 'Do not dump large test logs', 'query rather than dumping raw output']) {
    assert.match(AGENT_INSTRUCTIONS, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(CURSOR_INSTRUCTIONS, /alwaysApply: true/);
  assert.match(SKILL_INSTRUCTIONS, /Avoid raw commands that dump large human-oriented output/);
});

test('doctor distinguishes missing, partial, and complete local rules', async () => {
  const d = temp();
  assert.match(doctor(d).stdout, /agent_rules=missing/);
  fs.writeFileSync(path.join(d, 'AGENTS.md'), 'x');
  assert.match(doctor(d).stdout, /agent_rules=partial/);
  await init(d, { force: true, noGlobal: true });
  assert.match(doctor(d).stdout, /agent_rules=ok/);
});
