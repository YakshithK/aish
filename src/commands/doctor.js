import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { HOSTS, installsFor, missingGlobalHosts } from '../global-routing.js';
import { joinLines, result } from '../output.js';

const RULES = ['AGENTS.md', 'CLAUDE.md', '.cursor/rules/agentshell.mdc'];
const PACKAGE_JSON_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../package.json');
const VERSION = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')).version;

export function run(root = '.', agents = false, home) {
  const present = RULES.filter((file) => fs.existsSync(path.join(root, file)));
  const missing = RULES.filter((file) => !present.includes(file));
  const state = present.length === RULES.length ? 'ok' : present.length ? 'partial' : 'missing';
  const lines = [
    `aish=installed version=${VERSION}`,
    `git_repo=${spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' }).stdout?.trim() === 'true'}`,
    `rg=${spawnSync('rg', ['--version'], { stdio: 'ignore' }).status === 0}`,
    `agent_rules=${state} present=${present.length} missing=${missing.length}`,
    missing.length ? 'suggestion=run "aish init"' : 'suggestion=ready',
  ];
  if (missing.length) lines.push(`missing=${missing.join(',')}`);
  if (agents) {
    for (const host of HOSTS) {
      const install = installsFor(host, home)[0];
      lines.push(`global_${host}_skill=${fs.existsSync(install.path) ? 'present' : 'missing'} path=${install.path}`);
    }
    lines.push(missingGlobalHosts(home).length ? 'agent_suggestion=aish init --yes' : 'agent_suggestion=ready');
  }
  return result(joinLines(lines));
}
