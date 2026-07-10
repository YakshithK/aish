import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { CURSOR_INSTRUCTIONS, SKILL_INSTRUCTIONS } from './agent-rules.js';

export const HOSTS = ['claude', 'codex', 'cursor', 'opencode'];

export function installsFor(host, home = os.homedir()) {
  if (host === 'all') return HOSTS.flatMap((name) => installsFor(name, home));
  const paths = {
    claude: ['.claude/skills/agentshell/SKILL.md', SKILL_INSTRUCTIONS],
    codex: ['.codex/skills/agentshell/SKILL.md', SKILL_INSTRUCTIONS],
    cursor: ['.cursor/rules/agentshell.mdc', CURSOR_INSTRUCTIONS],
    opencode: ['.config/opencode/skills/agentshell/SKILL.md', SKILL_INSTRUCTIONS],
  };
  if (!paths[host]) throw new Error(`unknown_host=${host}`);
  return [{ host, path: path.join(home, paths[host][0]), content: paths[host][1] }];
}

export function missingGlobalHosts(home = os.homedir()) {
  return HOSTS.filter((host) => !fs.existsSync(installsFor(host, home)[0].path));
}

export async function globalRoutingLines({ yes = false, noGlobal = false, home = os.homedir() } = {}) {
  if (noGlobal) {
    const missing = missingGlobalHosts(home);
    return [
      'global_agent_routing=skipped',
      `missing_global_hosts=${missing.join(',')}`,
      'note=repo_rules_installed_global_routing_skipped',
    ];
  }
  const missing = missingGlobalHosts(home);
  if (!missing.length) return ['global_agent_routing=ok missing=0'];
  if (yes || await confirmGlobalInstall(missing)) return installMissingGlobal(missing, home);
  return [
    'global_agent_routing=missing',
    `missing_global_hosts=${missing.join(',')}`,
    'suggestion=run "aish init --yes" to install global agent routing',
  ];
}

async function confirmGlobalInstall(missing) {
  if (!input.isTTY) return false;
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `Global AgentShell routing is not installed for ${missing.join(', ')}. Install it now? [Y/n] `,
    );
    return ['', 'y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

export function installMissingGlobal(missing, home = os.homedir()) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const lines = [];
  for (const host of missing) {
    const install = installsFor(host, home)[0];
    const exists = fs.existsSync(install.path);
    if (exists) {
      skipped += 1;
      lines.push(`skip global host=${host} path=${install.path}`);
      continue;
    }
    fs.mkdirSync(path.dirname(install.path), { recursive: true });
    fs.writeFileSync(install.path, install.content);
    created += 1;
    lines.push(`create global host=${host} path=${install.path}`);
  }
  return [
    `global_agent_routing=installed created=${created} updated=${updated} skipped=${skipped}`,
    ...lines,
    'suggestion=run "aish doctor --agents"',
  ];
}
